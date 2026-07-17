import { useState, useEffect } from "react";
import { Transaction } from "../types";
import { Sparkles, Loader2, CheckCircle2, TrendingUp, Compass, Medal, AlertTriangle } from "lucide-react";
import { getApiUrl } from "../lib/api";

interface AISummaryCardProps {
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM
}

interface AISummaryResult {
  summary: string;
  insights: string[];
  suggestion: string;
  status: "excellent" | "good" | "warning" | "critical";
}

export default function AISummaryCard({ transactions, selectedMonth }: AISummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<AISummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Month formatter
  const getMonthNameTh = (monthStr: string) => {
    if (!monthStr || !monthStr.includes("-")) return "";
    const [year, month] = monthStr.split("-");
    const monthNames = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const mIdx = parseInt(month, 10) - 1;
    const monthIndex = isNaN(mIdx) ? 0 : mIdx;
    const yVal = parseInt(year, 10);
    const thaiYear = isNaN(yVal) ? "" : ` ${yVal + 543}`;
    return `${monthNames[monthIndex] || ""}${thaiYear}`;
  };

  // Check if we already have cached advice for this month & transaction count
  const cacheKey = `ai_advice_${selectedMonth}_${transactions.length}`;

  useEffect(() => {
    // Try to load cached advice
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setAdvice(JSON.parse(cached));
        setError(null);
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    } else {
      setAdvice(null);
      setError(null);
    }
  }, [selectedMonth, transactions.length]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/analyze-spending"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactions,
          monthName: getMonthNameTh(selectedMonth),
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        if (textResponse.includes("<!DOCTYPE") || textResponse.includes("<html") || textResponse.includes("The page c") || textResponse.includes("not found")) {
          throw new Error(
            "เซิร์ฟเวอร์ตอบกลับเป็นหน้าเว็บ HTML (อาจเนื่องมาจากโฮสต์แอปบน Vercel/Static แบบแยกหลังบ้าน) กรุณาเข้าไปที่เมนู 'ตั้งค่าระบบ' เพื่อระบุ 'ลิงก์เซิร์ฟเวอร์หลังบ้าน API' เพื่อเชื่อมโยงการทำงานอัจฉริยะ"
          );
        }
        throw new Error("เซิร์ฟเวอร์ตอบกลับเป็นประเภทข้อมูลที่ไม่ใช่ JSON");
      }

      const resData = await response.json();

      if (resData.success && resData.data) {
        setAdvice(resData.data);
        localStorage.setItem(cacheKey, JSON.stringify(resData.data));
      } else {
        throw new Error(resData.error || "ไม่สามารถดึงข้อมูลคำแนะนำจาก AI ได้");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการติดต่อกับเซิร์ฟเวอร์ AI");
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status: AISummaryResult["status"]) => {
    switch (status) {
      case "excellent":
        return {
          label: "การเงินยอดเยี่ยม (Excellent)",
          color: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
          icon: <Medal className="w-5 h-5 text-emerald-600" />,
        };
      case "good":
        return {
          label: "การเงินดี (Good)",
          color: "bg-blue-500/10 text-blue-700 border-blue-200",
          icon: <Compass className="w-5 h-5 text-blue-600" />,
        };
      case "warning":
        return {
          label: "ระมัดระวัง (Warning)",
          color: "bg-amber-500/10 text-amber-700 border-amber-200",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
        };
      case "critical":
        return {
          label: "วิกฤต (Critical)",
          color: "bg-rose-500/10 text-rose-700 border-rose-200",
          icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
        };
      default:
        return {
          label: "ทั่วไป (Normal)",
          color: "bg-slate-50 text-slate-700 border-slate-200",
          icon: <Compass className="w-5 h-5 text-slate-600" />,
        };
    }
  };

  return (
    <div id="ai-summary-card" className="bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-3xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-indigo-400 rounded-xl">
            <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">วิเคราะห์การเงินอัจฉริยะ (AI Financial Assistant)</h3>
            <p className="text-[10px] text-slate-400">ให้ Gemini วิเคราะห์พฤติกรรมการใช้จ่ายและรับคำแนะนำเชิงรุก</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-indigo-300">Gemini กำลังอ่านข้อมูลและวิเคราะห์งบการเงินของคุณ...</p>
          <p className="text-xs text-slate-500 mt-1">วิเคราะห์สถิติ สัดส่วน และยอดเหลือสุทธิ</p>
        </div>
      ) : advice ? (
        <div className="space-y-4">
          {/* Financial Status badge */}
          {advice.status && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              advice.status === "excellent" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" :
              advice.status === "good" ? "bg-blue-500/10 text-blue-300 border-blue-500/20" :
              advice.status === "warning" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
              "bg-rose-500/10 text-rose-300 border-rose-500/20"
            }`}>
              {getStatusDisplay(advice.status).icon}
              <span>สถานะ: {getStatusDisplay(advice.status).label}</span>
            </div>
          )}

          {/* AI Summary Text */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              {advice.summary}
            </p>
          </div>

          {/* Bullet insights */}
          {advice.insights && advice.insights.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">ข้อมูลเจาะลึก 3 ด้าน:</span>
              <div className="grid grid-cols-1 gap-2">
                {advice.insights.map((insight, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start bg-white/5 p-3 rounded-2xl border border-white/5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300 leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI suggestion */}
          {advice.suggestion && (
            <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400 italic">
              <span className="text-indigo-400 font-semibold shrink-0">💡 คำแนะนำทองคำ:</span>
              <span>{advice.suggestion}</span>
            </div>
          )}

          {/* Recalculate button */}
          <div className="pt-2 text-right">
            <button
              onClick={runAnalysis}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              🔄 วิเคราะห์อีกครั้ง
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <p className="text-xs text-slate-300 mb-4 max-w-sm leading-relaxed">
            ต้องการทราบคำแนะนำประจำเดือน ความเสี่ยงในการใช้เงิน หรือจุดเด่นทางการเงินประจำเดือนนี้หรือไม่?
          </p>
          <button
            onClick={runAnalysis}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all duration-200 shadow-md border border-white/10 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white" />
            วิเคราะห์พฤติกรรมการเงินด้วย AI
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 text-rose-300 rounded-xl text-xs border border-rose-500/20">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
