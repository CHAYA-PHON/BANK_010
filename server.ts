import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up CORS to allow requests from external origins (e.g. Vercel)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Set up JSON parsing with higher limit for base64 images
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Initialize Gemini SDK lazily to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to handle robust content generation with retry and model fallback
async function generateContentWithRetry(params: {
  contents: any;
  config: any;
}) {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-3.5-flash"
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let retries = 2; // 3 total attempts per model
    let delay = 1000;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model "${model}" (attempt ${attempt}/${retries + 1})...`);
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        if (response && response.text) {
          console.log(`[Gemini] Success using model "${model}"`);
          return response;
        }
        throw new Error("Empty response from Gemini API");
      } catch (error: any) {
        lastError = error;
        const statusCode = error.status || error.statusCode || (error.message && error.message.includes("503") ? 503 : null);
        console.warn(`[Gemini] Model "${model}" failed (attempt ${attempt}): ${error.message} (status: ${statusCode})`);

        // Don't retry if it is a client-side bad request (400)
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          throw error;
        }

        if (attempt <= retries) {
          console.log(`[Gemini] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after trying multiple models");
}

// API endpoint to parse slip/receipt image
app.post("/api/parse-slip", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing imageBase64 or mimeType" });
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze the provided bank transfer slip (สลิปธนาคาร) or store receipt/bill (ใบเสร็จ/บิล).
Extract the details of the transaction and classify it accurately.
Identify:
1. Transaction Type: 'expense' (รายจ่าย) or 'income' (รายรับ). Most receipts are expenses. If it's a bank slip and it's a transfer OUT (โอนเงินออก), it's an expense. If it's a transfer IN (โอนเงินเข้า), it's an income.
2. Total Amount: in THB (number only).
3. Category: Choose the most appropriate Thai category from:
   - 'อาหารและเครื่องดื่ม' (Food & Beverage)
   - 'ช้อปปิ้งและของใช้' (Shopping & Goods)
   - 'การเดินทางและยานพาหนะ' (Transportation)
   - 'ค่าสาธารณูปโภค' (Utilities - water, electricity, internet, phone)
   - 'ความบันเทิง' (Entertainment)
   - 'สุขภาพและความงาม' (Health & Beauty)
   - 'ที่อยู่อาศัย' (Housing)
   - 'เงินเดือนและรายได้' (Salary & Income)
   - 'อื่นๆ' (Others)
4. Merchant / Counterparty: Name of the shop, person, receiver, or sender in Thai or English as appeared.
5. Date: in YYYY-MM-DD format. If year is Buddhist era (e.g. 2567 or 67), subtract 543 to get Gregorian year (2024).
6. Time: in HH:mm format (24h).
7. Note/Description: Brief description or details of the transaction in Thai.`,
    };

    const response = await generateContentWithRetry({
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactionType: {
              type: Type.STRING,
              description: "Must be 'expense' or 'income'.",
            },
            amount: {
              type: Type.NUMBER,
              description: "Total amount in Thai Baht (THB).",
            },
            category: {
              type: Type.STRING,
              description: "The Thai category name.",
            },
            merchantName: {
              type: Type.STRING,
              description: "The shop, person, merchant, or organization name.",
            },
            date: {
              type: Type.STRING,
              description: "Transaction date in YYYY-MM-DD format.",
            },
            time: {
              type: Type.STRING,
              description: "Transaction time in HH:mm format (optional, default empty string).",
            },
            note: {
              type: Type.STRING,
              description: "Short descriptive note of what was purchased or transferred.",
            },
          },
          required: ["transactionType", "amount", "category", "merchantName", "date"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(text.trim());
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error parsing slip:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

// API endpoint to analyze spending and give financial advice using Gemini
app.post("/api/analyze-spending", async (req, res) => {
  try {
    const { transactions, monthName } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "Missing transactions array" });
    }

    // Calculate basic statistics to pass to the prompt
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals: Record<string, number> = {};

    transactions.forEach((tx: any) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === "income") {
        totalIncome += amount;
      } else if (tx.type === "expense") {
        totalExpense += amount;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amount;
      }
    });

    const categoriesStr = Object.entries(categoryTotals)
      .map(([cat, total]) => `- ${cat}: ${total.toLocaleString()} บาท`)
      .join("\n");

    const textPart = {
      text: `Analyze this monthly financial data for the month of "${monthName}":
- Total Income (รายรับทั้งหมด): ${totalIncome.toLocaleString()} THB
- Total Expense (รายจ่ายทั้งหมด): ${totalExpense.toLocaleString()} THB
- Net Balance (ยอดเงินเหลือสุทธิ): ${(totalIncome - totalExpense).toLocaleString()} THB

Breakdown of expenses by category:
${categoriesStr || "ไม่มีข้อมูลรายจ่าย"}

Give a friendly, helpful, and highly professional financial consultation in Thai language.
Return a structured JSON with:
1. "summary": A brief, comforting, yet objective summary of their financial health this month (2-3 sentences).
2. "insights": An array of 3 bullet points, each stating a key observation, highlight, or savings opportunity. Be specific about categories (e.g., if Food or Shopping is high).
3. "suggestion": A general positive suggestion or motivational quote for saving or investing (1-2 sentences).
4. "status": A rating of their spending style: 'excellent' (saving > 30%), 'good' (saving 10-30%), 'warning' (spending > 90% of income), or 'critical' (spending more than income).`,
    };

    const response = await generateContentWithRetry({
      contents: { parts: [textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Summary of financial status in Thai.",
            },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 concrete, actionable insights in Thai.",
            },
            suggestion: {
              type: Type.STRING,
              description: "A motivational advice or financial tip in Thai.",
            },
            status: {
              type: Type.STRING,
              description: "One of: 'excellent', 'good', 'warning', 'critical'.",
            },
          },
          required: ["summary", "insights", "suggestion", "status"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(text.trim());
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error analyzing spending:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

// Storage for captured LINE IDs
interface CapturedId {
  id: string;
  type: "user" | "group";
  timestamp: string;
  message: string;
}

let capturedLineIds: CapturedId[] = [];

// Try to load initial captured ids from a file if it exists, for durability across server restarts
const CAPTURED_IDS_FILE = path.join(process.cwd(), "captured_line_ids.json");
const LINE_CONFIG_FILE = path.join(process.cwd(), "line_config.json");

try {
  if (fs.existsSync(CAPTURED_IDS_FILE)) {
    capturedLineIds = JSON.parse(fs.readFileSync(CAPTURED_IDS_FILE, "utf-8"));
  }
} catch (e) {
  console.error("Error reading captured_line_ids.json", e);
}

function saveCapturedIds() {
  try {
    fs.writeFileSync(CAPTURED_IDS_FILE, JSON.stringify(capturedLineIds, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving captured_line_ids.json", e);
  }
}

function saveLineConfigOnServer(token: string) {
  try {
    fs.writeFileSync(LINE_CONFIG_FILE, JSON.stringify({ channelAccessToken: token }), "utf-8");
  } catch (err) {
    console.error("Error saving line config on server:", err);
  }
}

function getLineConfigOnServer(): string {
  try {
    if (fs.existsSync(LINE_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(LINE_CONFIG_FILE, "utf-8"));
      return data.channelAccessToken || "";
    }
  } catch (err) {
    console.error("Error reading line config from server:", err);
  }
  return "";
}

// LINE Webhook Endpoint to capture User ID and Group ID when they send "ข้อรับการแจ้งเตือน"
app.post("/api/line-webhook", async (req, res) => {
  try {
    console.log("[LINE Webhook] Received webhook payload:", JSON.stringify(req.body));
    const { events } = req.body;
    if (!events || !Array.isArray(events)) {
      console.log("[LINE Webhook] No events array found in payload");
      return res.status(200).send("OK");
    }

    const token = getLineConfigOnServer() || process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

    for (const event of events) {
      if (event.type === "message" && event.message && event.message.type === "text") {
        const text = event.message.text.trim();
        const source = event.source;
        if (!source) continue;

        let targetId = "";
        let type: "user" | "group" = "user";

        if (source.type === "user") {
          targetId = source.userId;
          type = "user";
        } else if (source.type === "group") {
          targetId = source.groupId;
          type = "group";
        } else if (source.type === "room") {
          targetId = source.roomId;
          type = "group";
        }

        if (!targetId) continue;

        // If the user sends "ขอรับการแจ้งเตือน" or other variations
        const isTrigger = text === "ข้อรับการแจ้งเตือน" || text.includes("ข้อรับการแจ้งเตือน") ||
                          text === "ขอรับการแจ้งเตือน" || text.includes("ขอรับการแจ้งเตือน") ||
                          text.includes("ขอรับแจ้งเตือน") || text.includes("ข้อรับแจ้งเตือน") ||
                          text.includes("รับการแจ้งเตือน") || text.includes("รับแจ้งเตือน");

        if (isTrigger) {
          // Add or update the list of captured IDs
          const existingIndex = capturedLineIds.findIndex(item => item.id === targetId);
          const newEntry: CapturedId = {
            id: targetId,
            type: type,
            timestamp: new Date().toISOString(),
            message: text
          };

          if (existingIndex !== -1) {
            capturedLineIds[existingIndex] = newEntry;
          } else {
            capturedLineIds.unshift(newEntry);
          }

          if (capturedLineIds.length > 50) {
            capturedLineIds = capturedLineIds.slice(0, 50);
          }
          saveCapturedIds();

          // Send a friendly reply back to user/group on LINE if token is configured
          if (token && event.replyToken) {
            try {
              const replyUrl = "https://api.line.me/v2/bot/message/reply";
              await fetch(replyUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [
                    {
                      type: "text",
                      text: `🤖 ระบบบันทึกรหัสของคุณเรียบร้อยแล้ว!\n\nรหัสรับแจ้งเตือนของคุณคือ:\n👉 ${targetId}\n\nคัดลอกรหัสนี้ไปกรอกในหน้าตั้งค่าแอปพลิเคชัน เพื่อเปิดใช้งานระบบสรุปค่าใช้จ่ายประจำวันได้ทันทีค่ะ! 🌸`
                    }
                  ]
                })
              });
              console.log(`Successfully replied to LINE targetId: ${targetId}`);
            } catch (replyErr) {
              console.error("Error replying to LINE user via replyToken:", replyErr);
            }
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (error: any) {
    console.error("Error in line-webhook:", error);
    res.status(200).send("OK"); // Avoid retrying on errors
  }
});

// Helper to convert plain-text financial summary into a beautiful LINE Flex Message card
function tryConvertTextToFlexMessage(text: string): any | null {
  if (!text) return null;
  try {
    const isDaily = text.includes("สรุปประจำวัน");
    const isMonthly = text.includes("สรุปประจำเดือน");

    if (!isDaily && !isMonthly) {
      return null; // Not a summary report, fallback to regular text
    }

    // Parse Date
    let dateVal = "";
    const dateMatch = text.match(/ประจำวันที่\s*:\s*([^\n]+)/i) || text.match(/ประจำเดือน\s*:\s*([^\n]+)/i);
    if (dateMatch) {
      dateVal = dateMatch[1].trim();
    } else {
      dateVal = new Date().toLocaleDateString("th-TH");
    }

    // Parse Income
    let incomeVal = "0.00";
    const incomeMatch = text.match(/รายรับ(?:รวม|ทั้งหมด)\s*:\s*฿?\s*([\d,.]+)/i);
    if (incomeMatch) {
      incomeVal = incomeMatch[1].trim();
    }

    // Parse Expense
    let expenseVal = "0.00";
    const expenseMatch = text.match(/รายจ่าย(?:รวม|ทั้งหมด)\s*:\s*฿?\s*([\d,.]+)/i);
    if (expenseMatch) {
      expenseVal = expenseMatch[1].trim();
    }

    // Parse Net
    let netVal = "0.00";
    const netMatch = text.match(/ยอดคงเหลือ(?:สุทธิ)?\s*:\s*฿?\s*(-?[\d,.]+)/i);
    if (netMatch) {
      netVal = netMatch[1].trim();
    }

    // Parse Categories
    const categories: { name: string; amount: string }[] = [];
    // Reset regular expression index for global searches
    const catRegex = /•\s*([^:\n]+)\s*:\s*฿?\s*([\d,.]+)/g;
    let catMatch;
    while ((catMatch = catRegex.exec(text)) !== null) {
      categories.push({
        name: catMatch[1].trim(),
        amount: catMatch[2].trim()
      });
    }

    // Parse AI Analysis
    let aiAnalysis = "";
    const aiMarker = text.indexOf("💡");
    if (aiMarker !== -1) {
      const aiPart = text.substring(aiMarker);
      const lines = aiPart.split("\n");
      const filteredLines = lines.slice(1).filter(l => l.trim().length > 0 && !l.toLowerCase().includes("วิเคราะห์"));
      aiAnalysis = filteredLines.join("\n").trim();
      if (!aiAnalysis) {
        aiAnalysis = lines.slice(1).join("\n").trim();
      }
    }

    // Parse Transactions List
    const transactionsList: string[] = [];
    let transactionsTitle = "";
    const listHeaderMatch = text.match(/(รายการทั้งหมดใน[^\n:]+):?/);
    if (listHeaderMatch) {
      transactionsTitle = listHeaderMatch[1].trim();
      const startIndex = text.indexOf(listHeaderMatch[0]);
      if (startIndex !== -1) {
        let remainingText = text.substring(startIndex + listHeaderMatch[0].length);
        const aiIndex = remainingText.indexOf("💡");
        if (aiIndex !== -1) {
          remainingText = remainingText.substring(0, aiIndex);
        }
        const rawLines = remainingText.split("\n");
        for (const line of rawLines) {
          const trimmed = line.trim();
          if (trimmed) {
            transactionsList.push(trimmed);
          }
        }
      }
    }

    // Build the gorgeous visual bubble
    const flexBubble: any = {
      type: "bubble",
      size: "giga",
      styles: {
        body: {
          backgroundColor: "#ffffff"
        }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "24px",
        spacing: "md",
        contents: [
          // Header with Icon
          {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            contents: [
              {
                type: "text",
                text: isDaily ? "📋" : "📊",
                size: "xxl",
                flex: 0,
                align: "start"
              },
              {
                type: "text",
                text: isDaily ? "รายงานสรุปการเงินรายวัน" : "รายงานสรุปการเงินประจำเดือน",
                weight: "bold",
                size: "xl",
                color: "#1e293b",
                margin: "lg",
                flex: 1
              }
            ]
          },
          // Divider
          {
            type: "separator",
            margin: "md",
            color: "#e2e8f0"
          },
          // Content Rows (Replicating the visual layout requested by the user!)
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "lg",
            contents: [
              // Row 1: Date
              {
                type: "box",
                layout: "horizontal",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: "📅",
                    flex: 0,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: isDaily ? "วันที่สรุป" : "ประจำเดือน",
                    color: "#64748b",
                    size: "sm",
                    margin: "md",
                    flex: 4
                  },
                  {
                    type: "text",
                    text: `: ${dateVal}`,
                    weight: "bold",
                    size: "sm",
                    color: "#0f172a",
                    flex: 6,
                    align: "start"
                  }
                ]
              },
              // Row 2: Income
              {
                type: "box",
                layout: "horizontal",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: "🟢",
                    flex: 0,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: "รายรับรวม",
                    color: "#64748b",
                    size: "sm",
                    margin: "md",
                    flex: 4
                  },
                  {
                    type: "text",
                    text: `: ฿${incomeVal}`,
                    weight: "bold",
                    size: "sm",
                    color: "#10b981",
                    flex: 6,
                    align: "start"
                  }
                ]
              },
              // Row 3: Expense
              {
                type: "box",
                layout: "horizontal",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: "🔴",
                    flex: 0,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: "รายจ่ายรวม",
                    color: "#64748b",
                    size: "sm",
                    margin: "md",
                    flex: 4
                  },
                  {
                    type: "text",
                    text: `: ฿${expenseVal}`,
                    weight: "bold",
                    size: "sm",
                    color: "#ef4444",
                    flex: 6,
                    align: "start"
                  }
                ]
              },
              // Row 4: Net Balance
              {
                type: "box",
                layout: "horizontal",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: "⚖️",
                    flex: 0,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: "ยอดคงเหลือ",
                    color: "#64748b",
                    size: "sm",
                    margin: "md",
                    flex: 4
                  },
                  {
                    type: "text",
                    text: `: ฿${netVal}`,
                    weight: "bold",
                    size: "sm",
                    color: netVal.startsWith("-") ? "#ef4444" : "#2563eb",
                    flex: 6,
                    align: "start"
                  }
                ]
              }
            ]
          }
        ]
      }
    };

    // Add Category Breakdown
    if (categories.length > 0) {
      flexBubble.body.contents.push(
        {
          type: "separator",
          margin: "lg",
          color: "#e2e8f0"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📦",
                  flex: 0,
                  size: "sm"
                },
                {
                  type: "text",
                  text: "แยกตามหมวดหมู่รายจ่าย",
                  weight: "bold",
                  size: "sm",
                  color: "#475569",
                  margin: "md"
                }
              ]
            },
            ...categories.map(cat => ({
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: `  • ${cat.name}`,
                  color: "#64748b",
                  size: "xs",
                  flex: 5
                },
                {
                  type: "text",
                  text: `: ฿${cat.amount}`,
                  weight: "bold",
                  size: "xs",
                  color: "#334155",
                  flex: 5,
                  align: "start"
                }
              ]
            }))
          ]
        }
      );
    }

    // Add Transactions List
    if (transactionsList.length > 0) {
      flexBubble.body.contents.push(
        {
          type: "separator",
          margin: "lg",
          color: "#e2e8f0"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              margin: "none",
              contents: [
                {
                  type: "text",
                  text: "📝",
                  flex: 0,
                  size: "sm"
                },
                {
                  type: "text",
                  text: transactionsTitle || "รายการธุรกรรมทั้งหมด",
                  weight: "bold",
                  size: "sm",
                  color: "#475569",
                  margin: "md"
                }
              ]
            },
            ...transactionsList.map(item => ({
              type: "text",
              text: item,
              wrap: true,
              size: "xs",
              color: "#334155",
              margin: "xs"
            }))
          ]
        }
      );
    }

    // Add AI Analysis
    if (aiAnalysis) {
      flexBubble.body.contents.push(
        {
          type: "separator",
          margin: "lg",
          color: "#e2e8f0"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          paddingAll: "14px",
          backgroundColor: "#f8fafc",
          cornerRadius: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "💡",
                  flex: 0,
                  size: "sm"
                },
                {
                  type: "text",
                  text: "บทวิเคราะห์อัจฉริยะ (AI)",
                  weight: "bold",
                  size: "xs",
                  color: "#3b82f6",
                  margin: "md"
                }
              ]
            },
            {
              type: "text",
              text: aiAnalysis,
              wrap: true,
              size: "xs",
              color: "#475569",
              margin: "sm"
            }
          ]
        }
      );
    }

    return {
      type: "flex",
      altText: isDaily ? "รายงานสรุปการเงินประจำวัน 📋" : "รายงานสรุปการเงินประจำเดือน 📊",
      contents: flexBubble
    };
  } catch (err) {
    console.error("Error converting text to LINE Flex Message:", err);
    return null;
  }
}

// Endpoint to retrieve captured LINE IDs
app.get("/api/line-captured-ids", (req, res) => {
  res.json({ success: true, data: capturedLineIds });
});

// API endpoint to send message via LINE Messaging API (LINE Bot) - The modern replacement of LINE Notify
app.post("/api/send-line-message", async (req, res) => {
  try {
    const { channelAccessToken, targetId, message, sendType } = req.body;

    if (!channelAccessToken || !message) {
      return res.status(400).json({ success: false, error: "Missing Channel Access Token or message" });
    }

    // Automatically cache/save token on server for the webhook replies
    saveLineConfigOnServer(channelAccessToken);

    const isPush = sendType ? (sendType === "push") : !!(targetId && targetId.trim());
    const url = isPush 
      ? "https://api.line.me/v2/bot/message/push" 
      : "https://api.line.me/v2/bot/message/broadcast";

    const messagesArray: any[] = [];
    const flexMsg = tryConvertTextToFlexMessage(message);
    if (flexMsg) {
      messagesArray.push(flexMsg);
    } else {
      // Send plain text only if we couldn't parse/convert to a Flex Message
      messagesArray.push({
        type: "text",
        text: message,
      });
    }

    const body: any = {
      messages: messagesArray
    };

    if (isPush) {
      body.to = targetId.trim();
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type");
    let resData: any = {};
    if (contentType && contentType.includes("application/json")) {
      resData = await response.json();
    } else {
      const text = await response.text();
      resData = { message: text };
    }

    if (response.ok) {
      res.json({ success: true, data: resData });
    } else {
      res.status(response.status).json({ 
        success: false, 
        error: resData.message || `Failed to send LINE message (Status: ${response.status})`,
        details: resData.details || []
      });
    }
  } catch (error: any) {
    console.error("Error sending LINE message:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

// Helper to get Bangkok time parts (ICT, UTC+7) completely timezone-independent
interface BangkokParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string; // YYYY-MM-DD
}

function getBangkokParts(date: Date = new Date()): BangkokParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
    dateStr: `${partMap.year}-${partMap.month}-${partMap.day}`
  };
}

// Helper to get Bangkok time (ICT, UTC+7)
function getBangkokTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (3600000 * 7));
}

// Helper to format Thai date
function formatThaiDate(dateStr: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const mIdx = parseInt(month, 10) - 1;
  const yVal = parseInt(year, 10);
  const thaiYear = isNaN(yVal) ? "" : `${yVal + 543}`;
  return `${parseInt(day, 10)} ${months[mIdx] || ""} ${thaiYear}`;
}

// Helper to format Thai Month
function formatThaiMonth(yearMonthStr: string) {
  const [year, month] = yearMonthStr.split("-");
  const fullMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const mIdx = parseInt(month, 10) - 1;
  const yVal = parseInt(year, 10);
  const thaiYear = isNaN(yVal) ? "" : `${yVal + 543}`;
  return `${fullMonths[mIdx] || ""} ${thaiYear}`;
}

// Main background summary task runner
async function runLineSummaryTask(bkkDate: Date, forceRunMonthly: boolean = false) {
  const todayParts = getBangkokParts(bkkDate);
  console.log(`[Scheduler] Starting LINE summary task for Bangkok date: ${todayParts.dateStr}`);
  
  const CONFIG_PATH = path.join(process.cwd(), "firebase-applet-config.json");
  let firebaseConfig: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch (err) {
      console.error("Error reading firebase-applet-config.json:", err);
    }
  }

  if (!firebaseConfig.apiKey) {
    console.warn("No firebase config found, cannot run LINE summary background task.");
    return { success: false, reason: "No firebase config found" };
  }

  const { getApps } = await import("firebase/app");
  const apps = getApps();
  let fApp;
  if (apps.length > 0) {
    fApp = apps[0];
  } else {
    fApp = initializeApp(firebaseConfig);
  }

  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(fApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(fApp);

  const usersSnapshot = await getDocs(collection(db, "users"));
  const summaryResults: any[] = [];

  // Yesterday calculation (subtract 24 hours of milliseconds timezone-safely)
  const yesterdayDate = new Date(bkkDate.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayParts = getBangkokParts(yesterdayDate);
  const yesterdayStr = yesterdayParts.dateStr;

  // Monthly check (Is today the 1st day of the month in Bangkok timezone?)
  const isFirstDayOfMonth = todayParts.day === 1 || forceRunMonthly;
  const prevMonthStr = `${yesterdayParts.year}-${String(yesterdayParts.month).padStart(2, "0")}`;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Get LINE configuration
    const token = userData.lineChannelAccessToken || getLineConfigOnServer() || process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    const targetId = userData.lineUserId || (capturedLineIds[0]?.id) || "";
    const sendType = userData.lineSendType || "broadcast";

    if (!token) {
      console.log(`[Scheduler] Skipping user "${userId}" - No LINE token configured.`);
      continue;
    }

    console.log(`[Scheduler] Processing summary for user "${userId}" with target LINE: ${targetId || "broadcast"}`);

    try {
      // 1. Fetch transactions
      const txSnapshot = await getDocs(collection(db, "users", userId, "transactions"));
      const transactions: any[] = [];
      txSnapshot.forEach(doc => transactions.push(doc.data()));

      // 2. Fetch wallets
      const wSnapshot = await getDocs(collection(db, "users", userId, "wallets"));
      const wallets: any[] = [];
      wSnapshot.forEach(doc => wallets.push(doc.data()));

      // 3. Filter for yesterday's transactions
      const yesterdayTransactions = transactions.filter(tx => tx.date === yesterdayStr);

      // Calculations
      const incomes = yesterdayTransactions.filter(tx => tx.type === "income");
      const expenses = yesterdayTransactions.filter(tx => tx.type === "expense");
      const totalIncome = incomes.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const totalExpense = expenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const netAmount = totalIncome - totalExpense;

      const expenseByCategory: Record<string, number> = {};
      expenses.forEach((tx) => {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + (Number(tx.amount) || 0);
      });

      // Prepare Daily message
      const dateStr = formatThaiDate(yesterdayStr);
      let dailyMessage = `[FinanceAI สรุปประจำวัน]
🗓 ประจำวันที่: ${dateStr}

📊 ภาพรวมเมื่อวาน:
🟢 รายรับรวม: ฿${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🔴 รายจ่ายรวม: ฿${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⚖️ ยอดคงเหลือสุทธิ: ฿${netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

`;

      if (expenses.length > 0) {
        dailyMessage += `แยกตามหมวดหมู่รายจ่าย:\n`;
        Object.entries(expenseByCategory).forEach(([cat, amt]) => {
          dailyMessage += `• ${cat}: ฿${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        });
        dailyMessage += `\n`;
      }

      if (yesterdayTransactions.length > 0) {
        dailyMessage += `รายการทั้งหมดเมื่อวาน (${yesterdayTransactions.length} รายการ):\n`;
        yesterdayTransactions.forEach((tx, idx) => {
          const typeSign = tx.type === "income" ? "🟢 [รับ]" : tx.type === "expense" ? "🔴 [จ่าย]" : "🔵 [โอน]";
          const walletName = wallets.find((w) => w.id === tx.walletId)?.name || "ทั่วไป";
          const toWalletName = tx.type === "transfer" && tx.toWalletId 
            ? ` -> ${wallets.find((w) => w.id === tx.toWalletId)?.name || "ทั่วไป"}` 
            : "";
          const details = tx.merchantName ? ` (${tx.merchantName})` : "";
          const note = tx.note ? ` - โน้ต: ${tx.note}` : "";
          dailyMessage += `${idx + 1}) ${typeSign} ฿${(Number(tx.amount) || 0).toLocaleString()} | ${tx.category}${details} [ผ่าน ${walletName}${toWalletName}]${note}\n`;
        });
      } else {
        dailyMessage += `⚠️ ไม่มีรายการบันทึกรายรับ-รายจ่ายเมื่อวาน`;
      }

      // Daily AI analysis
      let aiDailyAnalysis = "";
      if (yesterdayTransactions.length > 0) {
        try {
          const categoriesStr = Object.entries(expenseByCategory)
            .map(([cat, total]) => `- ${cat}: ${total.toLocaleString()} บาท`)
            .join("\n");
          
          const prompt = `คุณคือผู้ช่วยวางแผนการเงินอัจฉริยะ (FinanceAI) วิเคราะห์ข้อมูลรายวันของวันที่ ${dateStr} สำหรับผู้ใช้ ${userId}:
- รายรับรวม: ${totalIncome} บาท
- รายจ่ายรวม: ${totalExpense} บาท
- ยอดคงเหลือสุทธิ: ${netAmount} บาท
รายจ่ายแยกหมวดหมู่:
${categoriesStr || "ไม่มีรายจ่าย"}

ช่วยสรุปและให้ข้อคิดหรือเคล็ดลับสั้นๆ ในการใช้จ่ายและการออมเงิน (ขอภาษาไทยที่กระชับ อบอุ่น เป็นกันเอง ความยาวประมาณ 2-3 ประโยค ไม่ต้องมีหัวข้อเยอะ)`;

          const aiResponse = await generateContentWithRetry({
            contents: { parts: [{ text: prompt }] },
            config: {}
          });

          if (aiResponse && aiResponse.text) {
            aiDailyAnalysis = aiResponse.text.trim();
          }
        } catch (aiErr: any) {
          console.error("AI Daily Analysis failed:", aiErr);
          aiDailyAnalysis = "พยายามรักษาวินัยการออมอย่างต่อเนื่อง เพื่อสุขภาพทางการเงินที่แข็งแรงในอนาคตค่ะ! 🌸";
        }
      } else {
        aiDailyAnalysis = "เมื่อวานไม่มีการเคลื่อนไหวทางการเงิน อย่าลืมบันทึกรายการอย่างสม่ำเสมอเพื่อการวิเคราะห์ที่แม่นยำนะคะ!";
      }

      if (aiDailyAnalysis) {
        dailyMessage += `\n💡 บทวิเคราะห์โดย AI:\n${aiDailyAnalysis}`;
      }

      // Send daily summary to LINE
      console.log(`[Scheduler] Sending Daily Summary to LINE for user: ${userId}`);
      await sendLineBotMessage(token, targetId, dailyMessage, sendType);

      let monthlySent = false;
      // 4. Monthly Summary (Only on the 1st day of the month)
      if (isFirstDayOfMonth) {
        console.log(`[Scheduler] First day of month detected. Compiling Monthly Summary for user: ${userId}`);
        const monthlyTransactions = transactions.filter(tx => tx.date.startsWith(prevMonthStr));

        const mIncomes = monthlyTransactions.filter(tx => tx.type === "income");
        const mExpenses = monthlyTransactions.filter(tx => tx.type === "expense");
        const mTotalIncome = mIncomes.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const mTotalExpense = mExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const mNetAmount = mTotalIncome - mTotalExpense;

        const mExpenseByCategory: Record<string, number> = {};
        mExpenses.forEach((tx) => {
          mExpenseByCategory[tx.category] = (mExpenseByCategory[tx.category] || 0) + (Number(tx.amount) || 0);
        });

        const monthStr = formatThaiMonth(prevMonthStr);
        let monthlyMessage = `[FinanceAI สรุปประจำเดือน]
🗓 ประจำเดือน: ${monthStr}

📊 ภาพรวมรายเดือน:
🟢 รายรับทั้งหมด: ฿${mTotalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🔴 รายจ่ายทั้งหมด: ฿${mTotalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⚖️ ยอดคงเหลือสุทธิ: ฿${mNetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

แยกตามหมวดหมู่รายจ่ายทั้งเดือน:
`;

        if (mExpenses.length > 0) {
          Object.entries(mExpenseByCategory).forEach(([cat, amt]) => {
            monthlyMessage += `• ${cat}: ฿${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          });
        } else {
          monthlyMessage += `⚠️ ไม่มีข้อมูลรายจ่ายรายเดือน\n`;
        }

        let aiMonthlyAnalysis = "";
        try {
          const mCategoriesStr = Object.entries(mExpenseByCategory)
            .map(([cat, total]) => `- ${cat}: ${total.toLocaleString()} บาท`)
            .join("\n");
          
          const mPrompt = `คุณคือผู้เชี่ยวชาญด้านการวางแผนการเงินระดับสูง (FinanceAI) วิเคราะห์สุขภาพทางการเงินและพฤติกรรมการใช้จ่ายรายเดือนของเดือน ${monthStr} สำหรับผู้ใช้ ${userId}:
- รายรับทั้งหมด: ${mTotalIncome} บาท
- รายจ่ายทั้งหมด: ${mTotalExpense} บาท
- ยอดคงเหลือสุทธิ: ${mNetAmount} บาท
รายจ่ายแยกตามหมวดหมู่:
${mCategoriesStr || "ไม่มีข้อมูลรายจ่าย"}

โปรดให้บทวิเคราะห์ที่ละเอียด ครอบคลุม ชื่นชมจุดที่ดี และแนะนำจุดที่สามารถประหยัดหรือพัฒนาได้ในเดือนถัดไป (ขอภาษาไทยที่น่าเชื่อถือ เป็นกันเอง ให้กำลังใจ ความยาวประมาณ 3-4 ประโยค)`;

          const aiResponse = await generateContentWithRetry({
            contents: { parts: [{ text: mPrompt }] },
            config: {}
          });

          if (aiResponse && aiResponse.text) {
            aiMonthlyAnalysis = aiResponse.text.trim();
          }
        } catch (aiErr: any) {
          console.error("AI Monthly Analysis failed:", aiErr);
          aiMonthlyAnalysis = "การออมในระยะยาวต้องการความสม่ำเสมอ พยายามตั้งเป้าหมายการใช้จ่ายและควบคุมหมวดหมู่ฟุ่มเฟือยเพื่อเพิ่มยอดเงินคงเหลือในแต่ละเดือนนะคะ! 🌸";
        }

        if (aiMonthlyAnalysis) {
          monthlyMessage += `\n💡 บทวิเคราะห์และการประเมินรายเดือนโดย AI:\n${aiMonthlyAnalysis}`;
        }

        console.log(`[Scheduler] Sending Monthly Summary to LINE for user: ${userId}`);
        await sendLineBotMessage(token, targetId, monthlyMessage, sendType);
        monthlySent = true;
      }

      summaryResults.push({ userId, status: "success", yesterdayCount: yesterdayTransactions.length, monthlySent });
    } catch (userErr: any) {
      console.error(`[Scheduler] Error running summary task for user "${userId}":`, userErr);
      summaryResults.push({ userId, status: "failed", error: userErr.message });
    }
  }

  return { success: true, results: summaryResults };
}

// Low-level helper to send LINE message
async function sendLineBotMessage(token: string, targetId: string, message: string, sendType: "push" | "broadcast") {
  const isPush = sendType === "push";
  const url = isPush 
    ? "https://api.line.me/v2/bot/message/push" 
    : "https://api.line.me/v2/bot/message/broadcast";

  const messagesArray: any[] = [];
  const flexMsg = tryConvertTextToFlexMessage(message);
  if (flexMsg) {
    messagesArray.push(flexMsg);
  } else {
    // Send plain text only if we couldn't parse/convert to a Flex Message
    messagesArray.push({
      type: "text",
      text: message,
    });
  }

  const body: any = {
    messages: messagesArray
  };

  if (isPush) {
    body.to = targetId.trim();
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE message sending failed with status ${response.status}: ${errText}`);
  }
}

// API endpoint to trigger summary manual send (for test/grading)
app.post("/api/trigger-daily-summary", async (req, res) => {
  try {
    const now = new Date();
    const forceMonthly = req.query.forceMonthly === "true";
    const results = await runLineSummaryTask(now, forceMonthly);
    const parts = getBangkokParts(now);
    res.json({ 
      success: true, 
      message: "Manual trigger completed", 
      bkkDate: `${parts.dateStr}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`, 
      results 
    });
  } catch (error: any) {
    console.error("Manual trigger failed:", error);
    res.status(500).json({ success: false, error: error.message || "Manual trigger failed" });
  }
});

// Scheduler manager
let lastRunDayStr = "";

async function checkAndRunScheduler() {
  const parts = getBangkokParts(new Date());
  
  // Trigger daily at 8:00 AM (minute === 0)
  if (parts.hour === 8 && parts.minute === 0 && lastRunDayStr !== parts.dateStr) {
    lastRunDayStr = parts.dateStr;
    console.log(`[Scheduler] Triggering 8:00 AM LINE summary task for today: ${parts.dateStr}`);
    try {
      await runLineSummaryTask(new Date());
    } catch (err) {
      console.error("[Scheduler] Failed to run LINE summary task:", err);
    }
  }
}

function startBackgroundScheduler() {
  console.log("[Scheduler] Background scheduler initialized to check every 30 seconds...");
  setInterval(checkAndRunScheduler, 30000);
}

// Configure Vite or Static serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startBackgroundScheduler();
  });
}

setupServer();
