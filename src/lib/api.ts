import { GoogleGenAI, Type } from "@google/genai";
export function getEffectiveBackendBaseUrl(): string {
  let savedBase = localStorage.getItem("app_api_base_url") || (import.meta as any).env?.VITE_API_BASE_URL || "";
  
  if (typeof window !== "undefined" && window.location) {
    try {
      const hostname = window.location.hostname || "";
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("192.168.");
      const isCloudRun = hostname.endsWith(".run.app");
      const isVercel = hostname.endsWith(".vercel.app") || hostname.includes("vercel");

      // If we're not on localhost, but savedBase is localhost, ignore it
      if (!isLocalhost && savedBase && (savedBase.includes("localhost") || savedBase.includes("127.0.0.1"))) {
        savedBase = "";
      }

      // If savedBase is a vercel.app or matches our current hostname, ignore it (as we want to use relative paths)
      if (savedBase && (savedBase.includes(".vercel.app") || (!isLocalhost && !isCloudRun && savedBase.includes(hostname)))) {
        savedBase = "";
      }

      // If we have no valid backend base URL and we are hosted externally (like Vercel), default to Cloud Run,
      // unless we are hosted on Vercel itself, in which case we use the relative paths to the local Vercel backend.
      if (!savedBase && !isLocalhost && !isCloudRun && !isVercel) {
        return "https://ais-pre-vzwnta4t5vklyptliik43g-446396597239.asia-east1.run.app";
      }
    } catch (e) {
      console.warn("Security or access exception when reading window.location:", e);
    }
  }

  return savedBase;
}

export function getApiUrl(endpoint: string): string {
  const savedBase = getEffectiveBackendBaseUrl();
  if (!savedBase) return endpoint;
  
  // Clean trailing slashes from the base and leading slashes from the endpoint
  const base = savedBase.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

async function robustFetch(endpoint: string, body: any): Promise<any> {
  const savedBase = getEffectiveBackendBaseUrl();
  const primaryUrl = getApiUrl(endpoint);
  
  const performFetch = async (url: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const resData = await response.json();
      if (resData.success && resData.data) {
        return resData.data;
      }
      throw new Error(resData.error || "เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล");
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
  };

  try {
    return await performFetch(primaryUrl);
  } catch (err: any) {
    // If the primary URL was an absolute URL and failed with HTML_RESPONSE_ERROR or Failed to fetch,
    // let's try the local relative path fallback.
    const errText = err.message || "";
    if (primaryUrl !== endpoint && (errText === "HTML_RESPONSE_ERROR" || errText.includes("Failed to fetch") || errText.toLowerCase().includes("failed to fetch") || errText.includes("fetch failed"))) {
      console.warn(`Primary fetch to ${primaryUrl} failed. Trying relative fallback ${endpoint}...`);
      try {
        return await performFetch(endpoint);
      } catch (fallbackErr) {
        throw err;
      }
    }
    throw err;
  }
}

// Initialize client-side Gemini lazily with API key change tracking
let clientAi: any = null;
let currentClientKey: string = "";

function getClientAi(apiKey: string) {
  if (!clientAi || currentClientKey !== apiKey) {
    currentClientKey = apiKey;
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

// Helper to handle robust client-side content generation with retry and model fallback
async function generateClientContentWithRetry(
  apiKey: string,
  params: {
    contents: any;
    config: any;
    onStatusChange?: (status: string) => void;
  }
) {
  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let retries = 2; // 3 total attempts per model
    let delay = 1000;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        if (params.onStatusChange) {
          params.onStatusChange(`กำลังส่งคำขอไปยังโมเดล ${model} (ครั้งที่ ${attempt}/${retries + 1})...`);
        }
        console.log(`[Gemini Client] Attempting generation with model "${model}" (attempt ${attempt}/${retries + 1})...`);
        const ai = getClientAi(apiKey);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        if (response && response.text) {
          console.log(`[Gemini Client] Success using model "${model}"`);
          return response;
        }
        throw new Error("Empty response from Gemini API");
      } catch (error: any) {
        lastError = error;
        const statusCode = error.status || error.statusCode || (error.message && error.message.includes("503") ? 503 : null);
        console.warn(`[Gemini Client] Model "${model}" failed (attempt ${attempt}): ${error.message} (status: ${statusCode})`);

        // Don't retry if it is a client-side bad request (400) or unauthorized (401/403)
        // Keep retrying other models if the model itself was not found (404) or rate-limited (429)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429 && statusCode !== 404) {
          throw error;
        }

        if (attempt <= retries) {
          console.log(`[Gemini Client] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after trying multiple models");
}

function isBillingOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.statusText || (typeof err === 'object' ? JSON.stringify(err) : err)).toLowerCase();
  return (
    msg.includes("depleted") ||
    msg.includes("credits") ||
    msg.includes("prepay") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("billing") ||
    msg.includes("429")
  );
}

function isInvalidKeyError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.statusText || (typeof err === 'object' ? JSON.stringify(err) : err)).toLowerCase();
  return (
    msg.includes("api_key_invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("unauthorized") ||
    msg.includes("api key not found") ||
    msg.includes("401") ||
    msg.includes("403")
  );
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
  const backendBaseUrl = getEffectiveBackendBaseUrl();

  // 1. Try Client-side Gemini first if personal API key is provided
  if (personalApiKey) {
    try {
      onStatusChange("กำลังใช้ Gemini API ส่วนตัวบนเบราว์เซอร์เพื่อวิเคราะห์สลิป...");
      
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

      const response = await generateClientContentWithRetry(personalApiKey, {
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
        onStatusChange,
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
      throw new Error("ไม่สามารถรับข้อมูลตอบกลับจาก Gemini API ส่วนตัวได้");
    } catch (clientErr: any) {
      console.warn("Personal API Key failed:", clientErr);
      if (isBillingOrQuotaError(clientErr)) {
        throw new Error(
          `❌ คีย์ Gemini API ส่วนตัวของคุณ มีปัญหาเครดิตเงินหมด (Prepayment Credits Depleted)\n\n` +
          `💡 สาเหตุหลักและวิธีแก้ไขจากภาพหน้าจอของคุณล่าสุด:\n` +
          `1. ในรูปภาพที่สองที่คุณส่งมา มีค่า "Monthly spend cap (Experimental)" ตั้งไว้เป็น THB 0.00 / THB 400.00 (แปลว่าวงเงินการใช้งานรายเดือนถูกจำกัดไว้ที่ 0 บาท) ทำให้ Google บล็อกคำขอทุกตัวทันที แม้จะเป็นคีย์ใหม่ก็ตาม\n\n` +
          `2. วิธีแก้ไขมี 2 รูปแบบ:\n` +
          `👉 วิธีที่ A (ง่ายที่สุด): ในหน้าเว็บ Google AI Studio ให้คลิกปุ่ม "Edit spend cap" (สีเทาด้านขวาบนตามรูปที่คุณแคปมา) แล้วเปลี่ยนตัวเลขวงเงินจำกัดรายเดือนจาก 0.00 เป็นค่าอื่นๆ เช่น 400.00 หรือมากกว่านั้น เพื่อเปิดให้ API สามารถเรียกใช้งานได้\n` +
          `👉 วิธีที่ B: ลองนำบัญชี Google อีเมลอื่น (ที่คุณไม่เคยผูกบัตรเครดิต หรือไม่เคยตั้งค่าเปิดใช้งาน Billing ใดๆ ใน Google Cloud Console) มาล็อกอินเข้าหน้า Google AI Studio แล้วสร้างคีย์ใหม่ คีย์นั้นจะได้โควตา Free Tier แบบสะอาด 100% โดยไม่มีวงเงินจำกัดเป็น 0 บาทครับ`
        );
      }
      if (isInvalidKeyError(clientErr)) {
        throw new Error(
          `❌ คีย์ Gemini API ส่วนตัวที่คุณระบุไม่ถูกต้อง (API Key Invalid)\n\n` +
          `💡 วิธีแก้ไข:\n` +
          `1. ตรวจสอบว่าคัดลอก API Key มาครบถ้วนทุกตัวอักษร\n` +
          `2. ลองสร้าง API Key ชุดใหม่จาก Google AI Studio (https://aistudio.google.com/)\n` +
          `3. นำมาใส่ในเมนู 'ตั้งค่าระบบ' และบันทึกใหม่อีกครั้ง`
        );
      }
      if (!backendBaseUrl) {
        throw clientErr;
      }
    }
  }

  // 2. Try backend server if no personal API key is provided or if client-side execution failed
  if (backendBaseUrl) {
    try {
      onStatusChange("กำลังวิเคราะห์สลิปผ่านเซิร์ฟเวอร์หลังบ้าน...");
      return await robustFetch("/api/parse-slip", { imageBase64, mimeType });
    } catch (err: any) {
      console.warn("Backend parse-slip failed:", err);
      const msg = err.message || "";
      if (msg === "HTML_RESPONSE_ERROR" || msg.includes("Failed to fetch")) {
        throw new Error(
          "ระบบตรวจพบว่าคุณกำลังเปิดแอปพลิเคชันจากผู้ให้บริการภายนอก (เช่น Vercel) ซึ่งไม่มีระบบหลังบ้านของแอปติดตั้งอยู่\n\n💡 กรุณาเปิดเมนู 'ตั้งค่าระบบ' และกรอก 'Gemini API Key ส่วนตัว' ของคุณ เพื่อให้สามารถเปิดใช้งานสแกนสลิปอัจฉริยะได้โดยตรงจากเว็บบราวเซอร์ของคุณ!"
        );
      }
      
      // Handle billing / quota / credits depleted error
      if (
        msg.includes("depleted") ||
        msg.includes("credits") ||
        msg.includes("prepay") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("billing") ||
        msg.includes("429")
      ) {
        throw new Error(
          "โควตาสแกนสลิปฟรีของระบบกลางหมดลงชั่วคราว (เครดิตโครงการหมด)\n\n💡 วิธีแก้ไขด้วยตนเองฟรีทันที:\n1. ไปที่เมนู 'ตั้งค่าระบบ' (Settings - รูปฟันเฟืองด้านบน)\n2. นำ 'Gemini API Key ส่วนตัว' ของคุณมาใส่\n3. กดบันทึกเพื่อสแกนสลิปและใช้งาน AI ได้รวดเร็วและปลอดภัยไม่จำกัดทันที!"
        );
      }
      throw err;
    }
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
  const backendBaseUrl = getEffectiveBackendBaseUrl();

  // 1. Try Client-side Gemini first if personal API key is provided
  if (personalApiKey) {
    try {
      onStatusChange("กำลังวิเคราะห์ด้วย Gemini API ส่วนตัว...");

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

      const response = await generateClientContentWithRetry(personalApiKey, {
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
        onStatusChange,
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
      throw new Error("ไม่สามารถรับคำตอบวิเคราะห์จาก Gemini API ได้");
    } catch (clientErr: any) {
      console.warn("Personal API Key spending analysis failed:", clientErr);
      if (isBillingOrQuotaError(clientErr)) {
        throw new Error(
          `❌ คีย์ Gemini API ส่วนตัวของคุณ มีปัญหาเครดิตเงินหมด (Prepayment Credits Depleted)\n\n` +
          `💡 สาเหตุหลักและวิธีแก้ไขจากภาพหน้าจอของคุณล่าสุด:\n` +
          `1. ในรูปภาพที่สองที่คุณส่งมา มีค่า "Monthly spend cap (Experimental)" ตั้งไว้เป็น THB 0.00 / THB 400.00 (แปลว่าวงเงินการใช้งานรายเดือนถูกจำกัดไว้ที่ 0 บาท) ทำให้ Google บล็อกคำขอทุกตัวทันที แม้จะเป็นคีย์ใหม่ก็ตาม\n\n` +
          `2. วิธีแก้ไขมี 2 รูปแบบ:\n` +
          `👉 วิธีที่ A (ง่ายที่สุด): ในหน้าเว็บ Google AI Studio ให้คลิกปุ่ม "Edit spend cap" (สีเทาด้านขวาบนตามรูปที่คุณแคปมา) แล้วเปลี่ยนตัวเลขวงเงินจำกัดรายเดือนจาก 0.00 เป็นค่าอื่นๆ เช่น 400.00 หรือมากกว่านั้น เพื่อเปิดให้ API สามารถเรียกใช้งานได้\n` +
          `👉 วิธีที่ B: ลองนำบัญชี Google อีเมลอื่น (ที่คุณไม่เคยผูกบัตรเครดิต หรือไม่เคยตั้งค่าเปิดใช้งาน Billing ใดๆ ใน Google Cloud Console) มาล็อกอินเข้าหน้า Google AI Studio แล้วสร้างคีย์ใหม่ คีย์นั้นจะได้โควตา Free Tier แบบสะอาด 100% โดยไม่มีวงเงินจำกัดเป็น 0 บาทครับ`
        );
      }
      if (isInvalidKeyError(clientErr)) {
        throw new Error(
          `❌ คีย์ Gemini API ส่วนตัวที่คุณระบุไม่ถูกต้อง (API Key Invalid)\n\n` +
          `💡 วิธีแก้ไข:\n` +
          `1. ตรวจสอบว่าคัดลอก API Key มาครบถ้วนทุกตัวอักษร\n` +
          `2. ลองสร้าง API Key ชุดใหม่จาก Google AI Studio (https://aistudio.google.com/)\n` +
          `3. นำมาใส่ในเมนู 'ตั้งค่าระบบ' และบันทึกใหม่อีกครั้ง`
        );
      }
      if (!backendBaseUrl) {
        throw clientErr;
      }
    }
  }

  // 2. Try backend server if no personal API key is provided or if client-side execution failed
  if (backendBaseUrl) {
    try {
      onStatusChange("กำลังวิเคราะห์ด้วยเซิร์ฟเวอร์หลังบ้าน...");
      return await robustFetch("/api/analyze-spending", { transactions, monthName });
    } catch (err: any) {
      console.warn("Backend analyze-spending failed:", err);
      const msg = err.message || "";
      if (msg === "HTML_RESPONSE_ERROR" || msg.includes("Failed to fetch")) {
        throw new Error(
          "ระบบตรวจพบว่าคุณกำลังเปิดแอปพลิเคชันจาก Vercel/Static โหมด ซึ่งไม่มีระบบหลังบ้าน\n\n💡 กรุณาเปิดเมนู 'ตั้งค่าระบบ' และกรอก 'Gemini API Key ส่วนตัว' ของคุณ เพื่อเปิดใช้งานที่ปรึกษา AI วิเคราะห์รายจ่าย!"
        );
      }
      
      // Handle billing / quota / credits depleted error
      if (
        msg.includes("depleted") ||
        msg.includes("credits") ||
        msg.includes("prepay") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("billing") ||
        msg.includes("429")
      ) {
        throw new Error(
          "โควตาบริการวิเคราะห์ฟรีของระบบกลางหมดลงชั่วคราว (เครดิตโครงการหมด)\n\n💡 วิธีแก้ไขด้วยตนเองฟรีทันที:\n1. ไปที่เมนู 'ตั้งค่าระบบ' (Settings - รูปฟันเฟืองด้านบน)\n2. นำ 'Gemini API Key ส่วนตัว' ของคุณมาใส่\n3. กดบันทึกเพื่อสแกนสลิปและใช้งาน AI ได้รวดเร็วและปลอดภัยไม่จำกัดทันที!"
        );
      }
      throw err;
    }
  }

  throw new Error("ไม่มีการเชื่อมต่อระบบหลังบ้าน และไม่ได้ระบุ Gemini API Key ส่วนตัว");
}

/**
 * Sends a message via LINE Notify API proxy.
 */
export async function sendLineNotification(token: string, message: string): Promise<any> {
  const endpoint = "/api/send-line-notify";
  const primaryUrl = getApiUrl(endpoint);

  const performFetch = async (url: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, message }),
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const resData = await response.json();
      if (resData.success) {
        return resData.data;
      }
      throw new Error(resData.error || "ไม่สามารถส่งแจ้งเตือน LINE ได้");
    } else {
      const text = await response.text();
      if (
        text.includes("<!DOCTYPE") ||
        text.includes("<html") ||
        text.includes("The page c") ||
        text.includes("not found") ||
        text.includes("NOT_FOUND") ||
        response.status === 404
      ) {
        throw new Error("HTML_RESPONSE_ERROR");
      }
      if (response.ok) {
        return { message: text };
      }
      throw new Error(text || "ไม่สามารถส่งแจ้งเตือน LINE ได้");
    }
  };

  try {
    return await performFetch(primaryUrl);
  } catch (err: any) {
    const errText = err.message || "";
    const isNetworkError = errText.includes("Failed to fetch") || errText.toLowerCase().includes("failed to fetch") || errText.includes("fetch failed");

    if (primaryUrl !== endpoint && (errText === "HTML_RESPONSE_ERROR" || isNetworkError)) {
      console.warn(`Primary fetch to ${primaryUrl} failed. Trying relative fallback ${endpoint}...`);
      try {
        return await performFetch(endpoint);
      } catch (fallbackErr: any) {
        const fallbackErrText = fallbackErr.message || "";
        const isFallbackNetworkError = fallbackErrText.includes("Failed to fetch") || fallbackErrText.toLowerCase().includes("failed to fetch") || fallbackErrText.includes("fetch failed");
        if (isFallbackNetworkError) {
          throw new Error("ไม่สามารถส่งแจ้งเตือน LINE ได้เนื่องจากระบบเครือข่ายขัดข้อง");
        } else {
          throw fallbackErr;
        }
      }
    }

    if (errText === "HTML_RESPONSE_ERROR") {
      throw new Error(
        "ระบบตรวจพบว่าเซิร์ฟเวอร์หลังบ้านในลิงก์สาธารณะ (Pre-production/Shared URL) ยังไม่ได้ถูกสร้างขึ้นหรือไม่ได้เปิดใช้งานบนระบบคลาวด์ (ได้รับสถานะ 404 NOT FOUND จากเว็บหลังบ้านของคุณ)\n\n" +
        "💡 วิธีแก้ไข:\n" +
        "1. กรุณาเปิด AI Studio หน้าแอปพลิเคชันนี้ แล้วกดปุ่ม 'Share' (แชร์) หรือ 'Deploy' ด้านขวาบน เพื่อสร้างและเผยแพร่ Cloud Run Service สาธารณะ\n" +
        "2. หากคุณเพิ่งทำการบันทึกหรือแก้ไขโค้ดเสร็จ กรุณารอสักครู่ (ประมาณ 1-2 นาที) เพื่อให้ระบบทำการคอมไพล์และอัปเดตเซิร์ฟเวอร์หลังบ้านคลาวด์ให้เสร็จสมบูรณ์\n" +
        "3. หรือ คุณสามารถกรอกลิงก์ Backend Base URL ของคุณเองที่ถูกต้องในหน้า 'ตั้งค่าระบบ' ได้ค่ะ"
      );
    }

    if (isNetworkError) {
      console.warn("Error sending LINE Notify due to network connection failure:", err);
      throw new Error("ไม่สามารถส่งแจ้งเตือน LINE ได้เนื่องจากระบบเครือข่ายขัดข้อง");
    } else {
      console.error("Error sending LINE Notify:", err);
      throw err;
    }
  }
}

/**
 * Sends a message via LINE Messaging API (LINE Bot) proxy.
 */
export async function sendLineMessage(
  channelAccessToken: string,
  targetId: string,
  message: string,
  sendType: "push" | "broadcast" = "broadcast"
): Promise<any> {
  const endpoint = "/api/send-line-message";
  const primaryUrl = getApiUrl(endpoint);

  const performFetch = async (url: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelAccessToken, targetId, message, sendType }),
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const resData = await response.json();
      if (resData.success) {
        return resData.data;
      }
      throw new Error(resData.error || "ไม่สามารถส่งข้อความ LINE Bot ได้");
    } else {
      const text = await response.text();
      if (
        text.includes("<!DOCTYPE") ||
        text.includes("<html") ||
        text.includes("The page c") ||
        text.includes("not found") ||
        text.includes("NOT_FOUND") ||
        response.status === 404
      ) {
        throw new Error("HTML_RESPONSE_ERROR");
      }
      if (response.ok) {
        return { message: text };
      }
      throw new Error(text || "ไม่สามารถส่งข้อความ LINE Bot ได้");
    }
  };

  try {
    return await performFetch(primaryUrl);
  } catch (err: any) {
    const errText = err.message || "";
    const isNetworkError = errText.includes("Failed to fetch") || errText.toLowerCase().includes("failed to fetch") || errText.includes("fetch failed");

    if (primaryUrl !== endpoint && (errText === "HTML_RESPONSE_ERROR" || isNetworkError)) {
      console.warn(`Primary fetch to ${primaryUrl} failed. Trying relative fallback ${endpoint}...`);
      try {
        return await performFetch(endpoint);
      } catch (fallbackErr: any) {
        const fallbackErrText = fallbackErr.message || "";
        const isFallbackNetworkError = fallbackErrText.includes("Failed to fetch") || fallbackErrText.toLowerCase().includes("failed to fetch") || fallbackErrText.includes("fetch failed");
        if (isFallbackNetworkError) {
          throw new Error("ไม่สามารถส่งข้อความ LINE Bot ได้เนื่องจากระบบเครือข่ายขัดข้อง");
        } else {
          throw fallbackErr;
        }
      }
    }

    if (errText === "HTML_RESPONSE_ERROR") {
      throw new Error(
        "ระบบตรวจพบว่าเซิร์ฟเวอร์หลังบ้านในลิงก์สาธารณะ (Pre-production/Shared URL) ยังไม่ได้ถูกสร้างขึ้นหรือไม่ได้เปิดใช้งานบนระบบคลาวด์ (ได้รับสถานะ 404 NOT FOUND จากเว็บหลังบ้านของคุณ)\n\n" +
        "💡 วิธีแก้ไข:\n" +
        "1. กรุณาเปิด AI Studio หน้าแอปพลิเคชันนี้ แล้วกดปุ่ม 'Share' (แชร์) หรือ 'Deploy' ด้านขวาบน เพื่อสร้างและเผยแพร่ Cloud Run Service สาธารณะ\n" +
        "2. หากคุณเพิ่งทำการบันทึกหรือแก้ไขโค้ดเสร็จ กรุณารอสักครู่ (ประมาณ 1-2 นาที) เพื่อให้ระบบทำการคอมไพล์และอัปเดตเซิร์ฟเวอร์หลังบ้านคลาวด์ให้เสร็จสมบูรณ์\n" +
        "3. หรือ คุณสามารถกรอกลิงก์ Backend Base URL ของคุณเองที่ถูกต้องในหน้า 'ตั้งค่าระบบ' ได้ค่ะ"
      );
    }

    if (isNetworkError) {
      console.warn("Error sending LINE message due to network connection failure:", err);
      throw new Error("ไม่สามารถส่งข้อความ LINE Bot ได้เนื่องจากระบบเครือข่ายขัดข้อง");
    } else {
      console.error("Error sending LINE message:", err);
      throw err;
    }
  }
}

/**
 * Fetches recently captured LINE IDs (User ID or Group ID) from the backend.
 */
export async function getCapturedLineIds(): Promise<any[]> {
  const endpoint = "/api/line-captured-ids";
  const url = getApiUrl(endpoint);

  const performFetch = async (targetUrl: string) => {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    });
    if (response.ok) {
      const resData = await response.json();
      if (resData.success) {
        return resData.data || [];
      }
    }
    return [];
  };

  try {
    return await performFetch(url);
  } catch (err: any) {
    const errText = err.message || "";
    const isNetworkError = errText.includes("Failed to fetch") || errText.toLowerCase().includes("failed to fetch") || errText.includes("fetch failed");

    if (url !== endpoint && isNetworkError) {
      console.warn(`Primary fetch for captured IDs to ${url} failed. Trying relative fallback ${endpoint}...`);
      try {
        return await performFetch(endpoint);
      } catch (fallbackErr) {
        console.warn("Error fetching captured Line IDs from fallback due to network failure.");
        return [];
      }
    }

    if (isNetworkError) {
      console.warn("Error fetching captured Line IDs due to network connection failure:", err);
    } else {
      console.error("Error fetching captured Line IDs:", err);
    }
    return [];
  }
}

