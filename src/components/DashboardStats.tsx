import React, { useState } from "react";
import { TrendingUp, TrendingDown, Coins, Percent, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Landmark } from "lucide-react";
import { Transaction, Wallet } from "../types";

interface DashboardStatsProps {
  totalIncome: number;
  totalExpense: number;
  availableMonths: string[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  broughtForward: number;
  transactions?: Transaction[];
  wallets?: Wallet[];
}

export default function DashboardStats({
  totalIncome,
  totalExpense,
  availableMonths,
  selectedMonth,
  onMonthChange,
  broughtForward,
  transactions = [],
  wallets = [],
}: DashboardStatsProps) {
  const currentMonthNet = totalIncome - totalExpense;
  const carriedForward = broughtForward + currentMonthNet;
  
  // Real savings are cash flow + any transfers into Savings wallets (Piggy bank)
  const savingTransfersSum = transactions
    .filter((tx) => {
      if (tx.type !== "transfer") return false;
      const targetWallet = wallets.find((w) => w.id === tx.toWalletId);
      return targetWallet?.type === "saving";
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const actualSavings = Math.max(0, currentMonthNet) + savingTransfersSum;
  const savingsRate = totalIncome > 0 ? (actualSavings / totalIncome) * 100 : 0;
  const netFlowRate = totalIncome > 0 ? (currentMonthNet / totalIncome) * 100 : 0;

  const [savingsGoal, setSavingsGoal] = useState(() => {
    const saved = localStorage.getItem("savingsGoalPercent");
    return saved ? parseInt(saved, 10) : 10;
  });

  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const recommendedSavings = totalIncome * (savingsGoal / 100);
  
  const achievementPercent = recommendedSavings > 0 
    ? (actualSavings / recommendedSavings) * 100 
    : (currentMonthNet > 0 || actualSavings > 0 ? 100 : 0);

  // Thai Month Formatter
  const formatThaiMonth = (monthStr: string) => {
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

  return (
    <div className="space-y-6">
      {/* Selector and Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow-lg">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">รายงานการเงินสำหรับเดือน</h2>
          <span className="text-xl font-bold text-white block mt-0.5">
            {formatThaiMonth(selectedMonth)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400">เลือกเดือน:</label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="px-3.5 py-1.5 border border-white/10 rounded-xl bg-[#1e293b] text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-xs font-semibold cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m} className="bg-[#1e293b] text-white">
                {formatThaiMonth(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Brought Forward Balance Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-lg flex flex-col justify-between min-h-[160px] col-span-1">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                ยอดยกมาจากเดือนก่อน
              </span>
              <div className="p-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-lg sm:text-xl font-bold block mt-1 text-white tracking-tight">
              ฿{broughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Mini wallet starting distribution or beautiful flow icon */}
          <div className="my-2 space-y-1.5 flex-1 flex flex-col justify-center">
            {wallets && wallets.length > 0 ? (
              (() => {
                const totalWalletInitial = wallets.reduce((sum, w) => sum + w.initialBalance, 0);
                return (
                  <div className="space-y-1">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
                      {wallets.slice(0, 3).map((w, idx) => {
                        const pct = totalWalletInitial > 0 ? (w.initialBalance / totalWalletInitial) * 100 : 33.3;
                        const colors = [
                          "bg-indigo-400",
                          "bg-emerald-400",
                          "bg-amber-400",
                          "bg-rose-400"
                        ];
                        return (
                          <div
                            key={w.id}
                            className={`${colors[idx % colors.length]} h-full transition-all`}
                            style={{ width: `${pct}%` }}
                            title={`${w.name}: ฿${w.initialBalance}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] text-slate-400">
                      {wallets.slice(0, 2).map((w, idx) => {
                        const dots = ["bg-indigo-400", "bg-emerald-400", "bg-amber-400"];
                        return (
                          <span key={w.id} className="flex items-center gap-0.5 truncate max-w-[65px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${dots[idx % dots.length]} shrink-0`} />
                            <span className="truncate">{w.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="h-6 w-full opacity-20 relative">
                <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
                </svg>
              </div>
            )}
          </div>

          <p className="text-[9px] text-slate-500 leading-tight">
            ทุนรวมสะสมก่อนเดือนนี้
          </p>
        </div>

        {/* 2. Total Income Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-lg flex flex-col justify-between min-h-[160px] col-span-1">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                รายรับรวมเดือนนี้
              </span>
              <div className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-lg sm:text-xl font-bold block mt-1 text-emerald-400 tracking-tight">
              ฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Mini Daily Sparkline */}
          <div className="my-2 flex-1 flex flex-col justify-center min-h-[40px]">
            {(() => {
              const incomeByDay = Array(31).fill(0);
              transactions.forEach((tx) => {
                if (tx.type === "income" && tx.date) {
                  const parts = tx.date.split("-");
                  const day = parts[2] ? parseInt(parts[2], 10) : null;
                  if (day && day >= 1 && day <= 31) {
                    incomeByDay[day - 1] += tx.amount;
                  }
                }
              });

              const maxIncomeDay = Math.max(...incomeByDay, 1);
              const incomeSparklinePoints = incomeByDay
                .map((amount, idx) => {
                  const x = (idx / 30) * 100;
                  const y = 32 - (amount / maxIncomeDay) * 28;
                  return `${x},${y}`;
                })
                .join(" ");

              const hasIncomeTx = transactions.some((tx) => tx.type === "income");

              return hasIncomeTx ? (
                <div className="relative w-full h-10">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 35" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M0,35 L${incomeSparklinePoints} L100,35 Z`}
                      fill="url(#incomeGrad)"
                    />
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      points={incomeSparklinePoints}
                      className="drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                    />
                  </svg>
                  <div className="absolute right-0 bottom-0 text-[8px] text-slate-500 font-mono">
                    เทรนด์รายรับ
                  </div>
                </div>
              ) : (
                <div className="text-[9px] text-slate-500/70 border border-dashed border-white/5 rounded-xl flex items-center justify-center py-2 h-10">
                  ไม่มีรายรับเข้ามา
                </div>
              );
            })()}
          </div>

          <p className="text-[9px] text-slate-500 leading-tight">
            รายได้เข้าในช่วงเดือนนี้
          </p>
        </div>

        {/* 3. Total Expenses Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-lg flex flex-col justify-between min-h-[160px] col-span-1">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                รายจ่ายรวมเดือนนี้
              </span>
              <div className="p-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-lg sm:text-xl font-bold block mt-1 text-rose-400 tracking-tight">
              ฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Mini Daily Sparkline */}
          <div className="my-2 flex-1 flex flex-col justify-center min-h-[40px]">
            {(() => {
              const expenseByDay = Array(31).fill(0);
              transactions.forEach((tx) => {
                if (tx.type === "expense" && tx.date) {
                  const parts = tx.date.split("-");
                  const day = parts[2] ? parseInt(parts[2], 10) : null;
                  if (day && day >= 1 && day <= 31) {
                    expenseByDay[day - 1] += tx.amount;
                  }
                }
              });

              const maxExpenseDay = Math.max(...expenseByDay, 1);
              const expenseSparklinePoints = expenseByDay
                .map((amount, idx) => {
                  const x = (idx / 30) * 100;
                  const y = 32 - (amount / maxExpenseDay) * 28;
                  return `${x},${y}`;
                })
                .join(" ");

              const hasExpenseTx = transactions.some((tx) => tx.type === "expense");

              return hasExpenseTx ? (
                <div className="relative w-full h-10">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 35" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M0,35 L${expenseSparklinePoints} L100,35 Z`}
                      fill="url(#expenseGrad)"
                    />
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      points={expenseSparklinePoints}
                      className="drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]"
                    />
                  </svg>
                  <div className="absolute right-0 bottom-0 text-[8px] text-slate-500 font-mono">
                    เทรนด์รายจ่าย
                  </div>
                </div>
              ) : (
                <div className="text-[9px] text-slate-500/70 border border-dashed border-white/5 rounded-xl flex items-center justify-center py-2 h-10">
                  ไม่มีรายจ่ายออกไป
                </div>
              );
            })()}
          </div>

          <p className="text-[9px] text-slate-500 leading-tight">
            รายจ่ายออกช่วงเดือนนี้
          </p>
        </div>

        {/* 4. Carried Forward Balance Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-2xl flex flex-col justify-between min-h-[160px] col-span-1 relative overflow-hidden">
          <div className="absolute right-1 top-1 opacity-5 pointer-events-none">
            <Coins className="w-16 h-16 text-white" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-indigo-300 block uppercase tracking-wider">
              ยอดเงินยกไปเดือนหน้า
            </span>
            <span className="text-lg sm:text-xl font-extrabold block mt-1 tracking-tight text-white">
              ฿{carriedForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Capital Preservation Rate horizontal meter */}
          <div className="my-2 flex-1 flex flex-col justify-center">
            {(() => {
              const totalAvailable = broughtForward + totalIncome;
              const remainingPercent = totalAvailable > 0 ? (carriedForward / totalAvailable) * 100 : 0;
              return (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-slate-400 font-medium">สัดส่วนคงเหลือ:</span>
                    <span className={`font-black ${carriedForward >= broughtForward ? "text-emerald-400" : "text-amber-400"}`}>
                      {Math.max(0, remainingPercent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        carriedForward >= broughtForward
                          ? "bg-gradient-to-r from-emerald-500 to-indigo-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                      }`}
                      style={{ width: `${Math.max(2, Math.min(100, remainingPercent))}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-slate-400 leading-none">
                    {carriedForward >= broughtForward 
                      ? "📈 ทุนสำรองเพิ่มขึ้น" 
                      : "📉 ทุนสำรองลดลงจากรายจ่าย"}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-1">
            <span className={`px-1 rounded-sm text-[9px] font-bold ${currentMonthNet >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              {currentMonthNet >= 0 ? "เพิ่มขึ้น" : "ลดลง"}
            </span>
            <span className="text-[9px] text-slate-400">เงินคงเหลือสุทธิยกยอดไป</span>
          </div>
        </div>

        {/* 5. Savings Rate Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-lg flex flex-col justify-between min-h-[160px] col-span-2 lg:col-span-1 space-y-3">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                วิเคราะห์การเก็บออม (Savings)
              </span>
              <div className="p-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>
            
            {/* Target vs Actual */}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] border-b border-white/5 pb-2">
              <div>
                <span className="text-slate-400 block">ยอดที่ควรออม:</span>
                <span className="font-bold text-indigo-300">
                  ฿{recommendedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[8px] text-slate-500 block">({savingsGoal}% ของรายรับ)</span>
              </div>
              <div>
                <span className="text-slate-400 block">ออมจริงได้:</span>
                <span className={`font-bold ${currentMonthNet > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  ฿{actualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  ({savingsRate.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Achievement Percent & Bar */}
            <div className="mt-2.5">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">เปอร์เซ็นต์ความสำเร็จ:</span>
                <span className={`font-bold ${achievementPercent >= 100 ? "text-emerald-400" : achievementPercent >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                  {achievementPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    achievementPercent >= 100
                      ? "bg-emerald-400"
                      : achievementPercent >= 50
                      ? "bg-amber-400"
                      : "bg-rose-400"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, achievementPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Explanation if Negative */}
          {currentMonthNet < 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-[8px] sm:text-[9px] text-rose-300 leading-normal">
              ⚠️ <strong>สถานะติดลบ {netFlowRate.toFixed(1)}% เนื่องจาก</strong> เดือนนี้มีรายจ่ายสูงกว่ารายรับร่วม {Math.abs(currentMonthNet).toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿ ส่งผลให้ไม่สามารถออมได้และมีการใช้เงินเก่าสะสมค่ะ
            </div>
          )}

          <div className="space-y-1.5 pt-1.5 border-t border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-slate-400">เป้าหมายการออม:</span>
                <span className="font-bold text-indigo-300">{savingsGoal}%</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingGoal(!isEditingGoal)}
                className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-md border border-white/5 transition-all"
              >
                {isEditingGoal ? "เสร็จสิ้น" : "แก้ไข"}
              </button>
            </div>
            
            {isEditingGoal && (
              <div className="space-y-1 pt-1.5 animate-fade-in">
                <input
                  type="range"
                  min="1"
                  max="90"
                  step="1"
                  value={savingsGoal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSavingsGoal(val);
                    localStorage.setItem("savingsGoalPercent", String(val));
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
                <span className="text-[8px] text-slate-500 block text-right">เลื่อนเพื่อปรับเป้าหมาย</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
