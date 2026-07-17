import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
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
  });
}

setupServer();
