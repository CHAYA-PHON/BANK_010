import React, { useState, useEffect } from "react";
import { Transaction, Wallet, Debt } from "../types";
import { 
  Bell, Send, Check, Loader2, AlertCircle, Calendar, Sparkles, 
  Lock, Settings, ShieldAlert, MessageSquare, Info, AlertTriangle, Users, User
} from "lucide-react";
import { sendLineNotification, sendLineMessage, analyzeSpendingWithFallback, getApiUrl } from "../lib/api";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface LineSummarySenderProps {
  transactions: Transaction[];
  wallets: Wallet[];
  currentUser?: string;
  debts?: Debt[];
}

export default function LineSummarySender({ transactions, wallets, currentUser, debts = [] }: LineSummarySenderProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to local today date in YYYY-MM-DD
    const tzoffset = new Date().getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(Date.now() - tzoffset).toISOString().slice(0, 10);
    return localISOTime;
  });

  // Settings
  const useMessagingApi = true; // Always use LINE Bot
  const [channelAccessToken, setChannelAccessToken] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [sendType, setSendType] = useState<"push" | "broadcast">("broadcast");
  
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ success: string; error: string }>({ success: "", error: "" });

  // Load configuration from local storage & Firestore
  useEffect(() => {
    async function loadLineConfig() {
      const savedToken = localStorage.getItem("app_line_channel_access_token") || "";
      const savedTarget = localStorage.getItem("app_line_user_id") || "";
      const savedSendType = (localStorage.getItem("app_line_send_type") as "push" | "broadcast") || "broadcast";

      setChannelAccessToken(savedToken);
      setTargetId(savedTarget);
      setSendType(savedSendType);

      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.lineChannelAccessToken) {
              setChannelAccessToken(data.lineChannelAccessToken);
              localStorage.setItem("app_line_channel_access_token", data.lineChannelAccessToken);
            }
            if (data.lineUserId) {
              setTargetId(data.lineUserId);
              localStorage.setItem("app_line_user_id", data.lineUserId);
            }
            if (data.lineSendType) {
              setSendType(data.lineSendType);
              localStorage.setItem("app_line_send_type", data.lineSendType);
            }
          }
        } catch (err) {
          console.error("Error loading LINE config from Firestore:", err);
        }
      }

      if (!savedToken && !channelAccessToken) {
        setShowSettings(true);
      }
    }
    loadLineConfig();
  }, [currentUser]);

  // Excluded wallets set
  const excludedWalletIds = new Set(
    wallets.filter((w) => w.excludeFromTotal).map((w) => w.id)
  );

  // Filter transactions for the selected date - excluding transactions belonging ONLY to excluded wallets
  const dayTransactions = transactions.filter((tx) => {
    if (tx.date !== selectedDate) return false;
    
    // If income/expense in excluded wallet, filter it out
    if (tx.type === "income" || tx.type === "expense") {
      if (tx.walletId && excludedWalletIds.has(tx.walletId)) {
        return false;
      }
    }
    
    // If transfer where both src and dst are excluded, filter it out
    if (tx.type === "transfer") {
      const srcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const dstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      if (srcExcluded && dstExcluded) {
        return false;
      }
    }
    
    return true;
  });

  // Helper to calculate net changes of non-excluded wallets for a list of transactions
  const getNetBalanceForTransactions = (txList: Transaction[]) => {
    return txList.reduce((sum, tx) => {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;

      if (tx.type === "income") {
        if (!isSrcExcluded) return sum + tx.amount;
      } else if (tx.type === "expense") {
        if (!isSrcExcluded) return sum - tx.amount;
      } else if (tx.type === "transfer") {
        if (isSrcExcluded && !isDstExcluded) {
          return sum + tx.amount;
        } else if (!isSrcExcluded && isDstExcluded) {
          return sum - tx.amount;
        }
      }
      return sum;
    }, 0);
  };

  // Calculate day total income and expenses for non-excluded wallets
  const totalIncome = dayTransactions.reduce((sum, tx) => {
    if (tx.type === "income") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      if (isSrcExcluded && !isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  const totalExpense = dayTransactions.reduce((sum, tx) => {
    if (tx.type === "expense") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      if (!isSrcExcluded && isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  const netAmount = totalIncome - totalExpense;

  // Calculate Brought Forward (ยอดยกมา) and Remaining Balance (ยอดคงเหลือสะสม)
  const nonExcludedWallets = wallets.filter(w => !w.excludeFromTotal);
  const initialBalanceSum = nonExcludedWallets.reduce((sum, w) => sum + w.initialBalance, 0);
  const txsBeforeSelectedDate = transactions.filter(tx => tx.date < selectedDate);
  const broughtForward = initialBalanceSum + getNetBalanceForTransactions(txsBeforeSelectedDate);
  const remainingBalance = broughtForward + netAmount;

  // Group expenses by category
  const expenseByCategory: Record<string, number> = {};
  dayTransactions.forEach((tx) => {
    if (tx.type === "expense") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
      }
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      if (!isSrcExcluded && isDstExcluded) {
        expenseByCategory["โอนเข้ากระปุกออมสิน (ซ่อน)"] = (expenseByCategory["โอนเข้ากระปุกออมสิน (ซ่อน)"] || 0) + tx.amount;
      }
    }
  });

  // Calculate active borrowed debts
  const activeDebts = debts ? debts.filter(d => d.type === "borrowed" && d.status === "active") : [];
  const totalDebtAmount = activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0);

  // Automatically update the message template when date, transactions, debts or AI analysis changes
  useEffect(() => {
    const dateStr = formatThaiDate(selectedDate);
    const absNet = Math.abs(netAmount);
    const changePct = broughtForward > 0 ? (absNet / broughtForward) * 100 : 0;

    let changeLine = "";
    if (netAmount < 0) {
      changeLine = `⏬ลดลง ${absNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท หรือ ${changePct.toFixed(2)}%`;
    } else if (netAmount > 0) {
      changeLine = `⏫เพิ่มขึ้น ${netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท หรือ ${changePct.toFixed(2)}%`;
    } else {
      changeLine = `⚖️ ยอดเงินคงที่ (ไม่มีการเปลี่ยนแปลง)`;
    }

    let text = `[FinanceAI สรุปประจำวัน]
🗓 ประจำวันที่: ${dateStr}

📊 สรุปยอดเงินในบัญชี :
📦 ยอดยกมาวันนี้: ฿${broughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🟢 รายรับรวมวันนี้: ฿${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🔴 รายจ่ายรวมวันนี้: ฿${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${changeLine}
🏦 ยอดเงินคงเหลือรวมสะสม: ฿${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
`;

    if (totalDebtAmount > 0) {
      text += `\n🚨 หนี้สินค้างจ่ายทั้งหมด: ฿${totalDebtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      activeDebts.forEach((d) => {
        text += ` • ${d.creditorDebtorName}: ค้าง ฿${d.remainingAmount.toLocaleString()}${d.dueDate ? ` (กำหนด ${d.dueDate})` : ""}\n`;
      });
    }

    text += `\n`;

    if (dayTransactions.length === 0) {
      text += `📝 รายการบันทึก:\n⚠️ ไม่มีรายการบันทึกรายรับ-รายจ่ายในวันนี้\n`;
    } else {
      if (Object.keys(expenseByCategory).length > 0) {
        text += `แยกตามหมวดหมู่รายจ่าย:\n`;
        Object.entries(expenseByCategory).forEach(([cat, amt]) => {
          text += `• ${cat}: ฿${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        });
        text += `\n`;
      }

      text += `รายการทั้งหมดในวันนี้ (${dayTransactions.length} รายการ):\n`;
      dayTransactions.forEach((tx, idx) => {
        const typeSign = tx.type === "income" ? "🟢 [รับ]" : tx.type === "expense" ? "🔴 [จ่าย]" : "🔵 [โอน]";
        const walletName = wallets.find((w) => w.id === tx.walletId)?.name || "ทั่วไป";
        const toWalletName = tx.type === "transfer" && tx.toWalletId 
          ? ` -> ${wallets.find((w) => w.id === tx.toWalletId)?.name || "ทั่วไป"}` 
          : "";
        const details = tx.merchantName ? ` (${tx.merchantName})` : "";
        const note = tx.note ? ` - โน้ต: ${tx.note}` : "";
        
        text += `${idx + 1}) ${typeSign} ฿${tx.amount.toLocaleString()} | ${tx.category}${details} [ผ่าน ${walletName}${toWalletName}]${note}\n`;
      });
    }

    if (aiAnalysis) {
      text += `\n💡 บทวิเคราะห์สั้นๆ โดย AI:\n${aiAnalysis}`;
    }

    setMessage(text);
  }, [selectedDate, transactions, wallets, debts, aiAnalysis]);

  // Thai Date Formatter
  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.อ.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const mIdx = parseInt(month, 10) - 1;
    const yVal = parseInt(year, 10);
    const thaiYear = isNaN(yVal) ? "" : `${yVal + 543}`;
    return `${parseInt(day, 10)} ${months[mIdx] || ""} ${thaiYear}`;
  };

  // Generate AI short daily tip
  const generateAIDailyTip = async () => {
    if (dayTransactions.length === 0) {
      setStatus({ success: "", error: "ไม่มีรายการในวันนี้ให้วิเคราะห์" });
      return;
    }

    setIsAnalyzing(true);
    setStatus({ success: "", error: "" });

    try {
      const { analyzeSpendingWithFallback } = await import("../lib/api");
      const analysisResult = await analyzeSpendingWithFallback(
        dayTransactions.map(tx => ({ ...tx, amount: Number(tx.amount) })),
        `วันที่ ${formatThaiDate(selectedDate)}`,
        () => {}
      );
      
      if (analysisResult && analysisResult.summary) {
        setAiAnalysis(`${analysisResult.summary}\n📌 เคล็ดลับออมเงิน: ${analysisResult.suggestion}`);
        setStatus({ success: "AI วิเคราะห์พฤติกรรมการเงินของวันนี้สำเร็จแล้ว!", error: "" });
      } else {
        throw new Error("ไม่สามารถดึงการวิเคราะห์ได้");
      }
    } catch (err: any) {
      console.error(err);
      setAiAnalysis("การเงินวันนี้สถิติดีเยี่ยม ควรควบคุมรายจ่ายในหมวดหมู่ฟุ่มเฟือยเพื่อเพิ่มอัตราการออมสะสม!");
      setStatus({ success: "", error: "ใช้การวิเคราะห์แบบออฟไลน์สำรอง: " + (err.message || "ติดต่อ AI ขัดข้อง") });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_line_use_messaging_api", "true");
    localStorage.setItem("app_line_channel_access_token", channelAccessToken.trim());
    localStorage.setItem("app_line_user_id", targetId.trim());
    localStorage.setItem("app_line_send_type", sendType);

    // Sync token cache on backend
    fetch(getApiUrl("/api/send-line-message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelAccessToken: channelAccessToken.trim(), message: "", sendType: "broadcast" })
    }).catch(e => console.log("Silent seed error:", e));

    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
        await setDoc(userDocRef, {
          lineChannelAccessToken: channelAccessToken.trim(),
          lineUserId: targetId.trim(),
          lineSendType: sendType,
          lineAutoSummaryEnabled: true,
        }, { merge: true });
      } catch (err) {
        console.error("Error syncing LINE config to Firestore:", err);
      }
    }

    setStatus({ success: "บันทึกการตั้งค่า LINE สำเร็จแล้ว!", error: "" });
    setShowSettings(false);
    setTimeout(() => setStatus({ success: "", error: "" }), 3000);
  };

  const handleSendToLine = async () => {
    setIsSending(true);
    setStatus({ success: "", error: "" });

    try {
      const token = localStorage.getItem("app_line_channel_access_token") || channelAccessToken.trim();
      if (!token) {
        setStatus({ success: "", error: "กรุณากรอกและบันทึก LINE Channel Access Token ก่อนส่งสรุป" });
        setShowSettings(true);
        setIsSending(false);
        return;
      }

      const tId = localStorage.getItem("app_line_user_id") || targetId.trim();
      const sType = (localStorage.getItem("app_line_send_type") as "push" | "broadcast") || sendType;

      if (sType === "push" && !tId) {
        setStatus({ success: "", error: "กรุณาระบุ User ID หรือ Group ID สำหรับส่งแบบเจาะจง (Push)" });
        setShowSettings(true);
        setIsSending(false);
        return;
      }

      await sendLineMessage(token, tId, message, sType);
      setStatus({ success: `ส่งสรุปค่าใช้จ่ายเข้า LINE Bot (${sType === "broadcast" ? "แบบส่งทุกคน" : "แบบระบุผู้รับ"}) สำเร็จแล้ว! 🎉`, error: "" });
    } catch (err: any) {
      console.error(err);
      setStatus({ 
        success: "", 
        error: err.message || "ส่งเข้า LINE ล้มเหลว กรุณาตรวจสอบสิทธิ์และตั้งค่าโทเคนของคุณ" 
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="line-summary-card" className="bg-gradient-to-br from-[#0c162d] to-[#081022] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              สรุปยอดส่งเข้า LINE
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase font-black">
                Bot v2
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">ส่งรายงานสรุปรายรับ-รายจ่ายเข้า LINE แชทส่วนตัวหรือกลุ่ม</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/5 transition-all text-xs flex items-center gap-1 cursor-pointer"
          title="ตั้งค่า LINE"
        >
          <Settings className="w-3.5 h-3.5 text-indigo-400" />
          <span>{showSettings ? "ปิดตั้งค่า" : "ตั้งค่าระบบ LINE"}</span>
        </button>
      </div>

      {/* Settings configuration panel */}
      {showSettings && (
        <form onSubmit={handleSaveSettings} className="bg-[#090f1e]/80 border border-white/5 p-4 rounded-2xl space-y-4 animate-fade-in text-xs">
          
          {/* LINE Messaging API Fields */}
          <div className="space-y-3.5 pt-1">
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl space-y-1 text-[11px] text-slate-300">
              <p className="font-bold text-emerald-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-emerald-400" /> วิธีสร้าง LINE Bot ฟรีใน 3 ขั้นตอน:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>สมัครบัญชีที่ <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">LINE Developers</a> และสร้าง Provider</li>
                <li>สร้าง **Messaging API** channel จากนั้นไปที่แท็บ Messaging API เพื่อออก **Channel Access Token**</li>
                <li>เพิ่มบอทเป็นเพื่อนในบัญชี LINE ของคุณ เพื่อรับข้อความสรุปได้ฟรีไม่จำกัด!</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                Channel Access Token (Long-Lived)
              </label>
              <input
                type="password"
                value={channelAccessToken}
                onChange={(e) => setChannelAccessToken(e.target.value)}
                placeholder="กรอก Channel Access Token ของ LINE Bot"
                className="w-full px-3 py-2 bg-[#090d16] border border-white/10 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold uppercase">
                รูปแบบผู้รับปลายทาง
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSendType("broadcast")}
                  className={`py-1.5 px-3 rounded-lg border text-center font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    sendType === "broadcast" 
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300" 
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  ส่งทุกคน (Broadcast)
                </button>
                <button
                  type="button"
                  onClick={() => setSendType("push")}
                  className={`py-1.5 px-3 rounded-lg border text-center font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    sendType === "push" 
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300" 
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  ส่งรายคน/กลุ่ม (Push)
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                {sendType === "broadcast" 
                  ? "💡 ส่งให้ทุกคนที่เป็นเพื่อนกับ LINE Bot ของคุณ (ตั้งค่าเสร็จแล้วส่งได้ทันที)" 
                  : "💡 ส่งตรงเฉพาะเจาะจงไปยังบัญชีของคุณ หรือส่งเข้ากลุ่มแชท (โดยระบุรหัส User ID หรือ Group ID ของคุณ)"}
              </p>
            </div>

            {sendType === "push" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-400" />
                  User ID / Group ID ปลายทาง
                </label>
                <input
                  type="text"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="ระบุรหัสผู้รับ เช่น Ue1234567890abcdef..."
                  className="w-full px-3 py-2 bg-[#090d16] border border-white/10 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[9px] text-slate-500 leading-relaxed">
                  * คุณสามารถดูรหัส User ID ของคุณได้ใน Messaging API Console หรือผู้ใช้บอทโดยตรงค่ะ
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      )}



      {/* Date selector and Summary statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Selector */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            เลือกวันที่ต้องการสรุป
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setAiAnalysis(""); // Clear AI summary on date change
            }}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          />
        </div>

        {/* Short info */}
        <div className="bg-[#121826]/60 border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">รายการวันนี้:</span>
            <span className="font-bold text-indigo-400">{dayTransactions.length} รายการ</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-slate-400">รายรับ:</span>
            <span className="font-bold text-emerald-400">฿{totalIncome.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-slate-400">รายจ่าย:</span>
            <span className="font-bold text-rose-400">฿{totalExpense.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Message Preview */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            ตัวอย่างข้อความสรุปที่จะส่งเข้า LINE:
          </label>
          {dayTransactions.length > 0 && (
            <button
              onClick={generateAIDailyTip}
              disabled={isAnalyzing}
              className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              ) : (
                <Sparkles className="w-3 h-3 text-indigo-400" />
              )}
              {isAnalyzing ? "กำลังวิเคราะห์..." : "🤖 ให้ AI เติมคำแนะนำ"}
            </button>
          )}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          className="w-full p-4 bg-[#090d16] border border-white/10 rounded-2xl text-white font-mono text-[11px] leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-white/15 placeholder-slate-600 resize-y"
          placeholder="ไม่มีข้อมูลรายการสรุปในขณะนี้"
        />
      </div>

      {/* Send Actions */}
      <div className="pt-2">
        <button
          onClick={handleSendToLine}
          disabled={isSending}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] cursor-pointer"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
          <span>
            {isSending 
              ? "กำลังส่งสรุปเข้า LINE..." 
              : useMessagingApi 
                ? "ส่งรายงานสรุปเข้า LINE Bot (Messaging API)" 
                : "ส่งรายงานสรุปเข้า LINE Notify (ปิดบริการแล้ว)"
            }
          </span>
        </button>
      </div>

      {/* Messages */}
      {(status.success || status.error) && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold animate-fade-in flex items-center gap-2 ${
          status.success 
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
            : "text-rose-400 bg-rose-500/10 border-rose-500/20"
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="leading-tight">{status.success || status.error}</p>
        </div>
      )}
    </div>
  );
}
