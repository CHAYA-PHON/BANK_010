import { GoogleGenAI, Type } from "@google/genai";
export function getApiUrl(endpoint: string): string {
  const savedBase = localStorage.getItem("app_api_base_url") || (import.meta as any).env?.VITE_API_BASE_URL || "";
  if (!savedBase) return endpoint;
  
  // Clean trailing slashes from the base and leading slashes from the endpoint
  const base = savedBase.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

// Initialize client-side Gemini lazily
let clientAi: any = null;

function getClientAi(apiKey: string) {
  if (!clientAi) {
    clientAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return clientAi;
}

/**
 * Parses bank slip or store receipt using either Server API or Client-side Gemini fallback.
 */
export async function parseSlipWithFallback(
  imageBase64: string,
  mimeType: string,
  onStatusChange: (status: string) => void
): Promise<any> {
  const personalApiKey = localStorage.getItem("app_personal_gemini_api_key") || "";
  const backendBaseUrl = localStorage.getItem("app_api_base_url") || "";

  // 1. Try backend server if configured or if no personal API key is provided
  if (!personalApiKey || backendBaseUrl) {
    try {
      onStatusChange("กำลังวิเคราะห์สลิปผ่านเซิร์ฟเวอร์หลังบ้าน...");
      const response = await fetch(getApiUrl("/api/parse-slip"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          return resData.data;
        }
        throw new Error(resData.error || "ไม่สามารถวิเคราะห์ข้อมูลจากรูปภาพได้");
      } else {
        const textResponse = await response.text();
        if (
          textResponse.includes("<!DOCTYPE") ||
          textResponse.includes("<html") ||
          textResponse.includes("The page c") ||
          textResponse.includes("not found")
        ) {
          throw new Error("HTML_RESPONSE_ERROR");
        }
        throw new Error("เซิร์ฟเวอร์ตอบกลับเป็นประเภทข้อมูลที่ไม่ใช่ JSON");
      }
    } catch (err: any) {
      console.warn("Backend parse-slip failed, checking client fallback:", err);
      
      // If we don't have a personal API key, throw a clear error explaining Vercel/Static limitations
      if (!personalApiKey) {
        if (err.message === "HTML_RESPONSE_ERROR" || err.message.includes("Failed to fetch")) {
          throw new Error(
            "ระบบตรวจพบว่าคุณกำลังเปิดแอปพลิเคชันจากผู้ให้บริการภายนอก (เช่น Vercel) ซึ่งไม่มีระบบหลังบ้านของแอปติดตั้งอยู่\n\n💡 กรุณาเปิดเมนู 'ตั้งค่าระบบ' และกรอก 'Gemini API Key ส่วนตัว' ของคุณ เพื่อให้สามารถเปิดใช้งานสแกนสลิปอัจฉริยะได้โดยตรงจากเว็บบราวเซอร์ของคุณ!"
          );
        }
        throw err;
      }
    }
  }

  // 2. Client-side Gemini fallback
  if (personalApiKey) {
    onStatusChange("กำลังใช้ Gemini API ส่วนตัวบนเบราว์เซอร์เพื่อวิเคราะห์สลิป...");
    const ai = getClientAi(personalApiKey);
    
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, textPart],
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

    if (response && response.text) {
      return JSON.parse(response.text.trim());
    }
    throw new Error("ไม่สามารถรับข้อมูลตอบกลับจาก Gemini API ส่วนตัวได้");
  }

  throw new Error("ไม่มีการเชื่อมต่อระบบหลังบ้าน และไม่ได้ระบุ Gemini API Key ส่วนตัว");
}

/**
 * Analyzes spending using either Server API or Client-side Gemini fallback.
 */
export async function analyzeSpendingWithFallback(
  transactions: any[],
  monthName: string,
  onStatusChange: (status: string) => void
): Promise<any> {
  const personalApiKey = localStorage.getItem("app_personal_gemini_api_key") || "";
  const backendBaseUrl = localStorage.getItem("app_api_base_url") || "";

  // 1. Try backend server if configured or if no personal API key is provided
  if (!personalApiKey || backendBaseUrl) {
    try {
      const response = await fetch(getApiUrl("/api/analyze-spending"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactions,
          monthName,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          return resData.data;
        }
        throw new Error(resData.error || "ไม่สามารถวิเคราะห์ข้อมูลรายจ่ายได้");
      } else {
        const textResponse = await response.text();
        if (
          textResponse.includes("<!DOCTYPE") ||
          textResponse.includes("<html") ||
          textResponse.includes("The page c") ||
          textResponse.includes("not found")
        ) {
          throw new Error("HTML_RESPONSE_ERROR");
        }
        throw new Error("เซิร์ฟเวอร์ตอบกลับเป็นประเภทข้อมูลที่ไม่ใช่ JSON");
      }
    } catch (err: any) {
      console.warn("Backend analyze-spending failed, checking client fallback:", err);
      
      // If we don't have a personal API key, throw a clear error explaining Vercel/Static limitations
      if (!personalApiKey) {
        if (err.message === "HTML_RESPONSE_ERROR" || err.message.includes("Failed to fetch")) {
          throw new Error(
            "ระบบตรวจพบว่าคุณกำลังเปิดแอปพลิเคชันจาก Vercel/Static โหมด ซึ่งไม่มีระบบหลังบ้าน\n\n💡 กรุณาเปิดเมนู 'ตั้งค่าระบบ' และกรอก 'Gemini API Key ส่วนตัว' ของคุณ เพื่อเปิดใช้งานที่ปรึกษา AI วิเคราะห์รายจ่าย!"
          );
        }
        throw err;
      }
    }
  }

  // 2. Client-side Gemini fallback
  if (personalApiKey) {
    onStatusChange("กำลังวิเคราะห์ด้วย Gemini API ส่วนตัว...");
    const ai = getClientAi(personalApiKey);

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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [textPart],
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
              description: "3 detailed financial insights in Thai.",
            },
            suggestion: {
              type: Type.STRING,
              description: "A motivational advice/quote in Thai.",
            },
            status: {
              type: Type.STRING,
              description: "Rating: 'excellent', 'good', 'warning', or 'critical'.",
            },
          },
          required: ["summary", "insights", "suggestion", "status"],
        },
      },
    });

    if (response && response.text) {
      return JSON.parse(response.text.trim());
    }
    throw new Error("ไม่สามารถรับคำตอบวิเคราะห์จาก Gemini API ได้");
  }

  throw new Error("ไม่มีการเชื่อมต่อระบบหลังบ้าน และไม่ได้ระบุ Gemini API Key ส่วนตัว");
}
