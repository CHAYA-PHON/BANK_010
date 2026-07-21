import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Coins, Percent, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Landmark, Target, Trophy } from "lucide-react";
import { Transaction, Wallet, MonthlyGoal } from "../types";

interface DashboardStatsProps {
  totalIncome: number;
  totalExpense: number;
  availableMonths: string[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  broughtForward: number;
  transactions?: Transaction[];
  wallets?: Wallet[];
  monthlyGoals?: MonthlyGoal[];
  onSaveMonthlyGoal?: (month: string, amount: number) => void;
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
  monthlyGoals = [],
  onSaveMonthlyGoal,
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

  const [goalMode, setGoalMode] = useState<"saving_wallets" | "baht" | "percent">(() => {
    return (localStorage.getItem("savings_goal_mode") as any) || "saving_wallets";
  });

  const [savingsGoal, setSavingsGoal] = useState(() => {
    const saved = localStorage.getItem("savingsGoalPercent");
    return saved ? parseInt(saved, 10) : 10;
  });

  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // Find the custom Baht goal from monthlyGoals list for the currently selected month
  const currentMonthGoal = monthlyGoals.find(g => g.month === selectedMonth);
  const bahtGoalAmount = currentMonthGoal ? currentMonthGoal.amount : 0;
  
  // Local edit input state for Baht goal
  const [customBahtInput, setCustomBahtInput] = useState("");

  // Track hovered day in daily cash flow stacked bar chart
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);

  // Sync edit input when month changes
  useEffect(() => {
    setCustomBahtInput(bahtGoalAmount > 0 ? bahtGoalAmount.toString() : "");
  }, [bahtGoalAmount, selectedMonth]);

  // Handle saving goal mode
  const handleGoalModeToggle = (mode: "saving_wallets" | "baht" | "percent") => {
    setGoalMode(mode);
    localStorage.setItem("savings_goal_mode", mode);
  };

  // Helper to calculate target monthly savings for a saving wallet
  const getWalletMonthlyTarget = (w: Wallet) => {
    const target = w.targetAmount ?? 0;
    if (target <= 0) return 0;
    const val = w.goalPeriodValue ?? 1;
    const unit = w.goalPeriodUnit ?? 'year';
    const months = unit === 'year' ? val * 12 : val;
    return target / months;
  };

  // Filter saving wallets with a valid target amount
  const savingWallets = wallets.filter(w => w.type === "saving" && w.targetAmount && w.targetAmount > 0);

  // Calculate stats for each saving wallet for the currently selected month
  const savingWalletsWithTargets = savingWallets.map(w => {
    const monthlyTarget = getWalletMonthlyTarget(w);
    
    // Calculate net change of this wallet in the selected month
    const monthlyNetChange = transactions
      .filter(tx => tx.date.startsWith(selectedMonth))
      .reduce((sum, tx) => {
        if (tx.type === "income" && tx.walletId === w.id) {
          return sum + tx.amount;
        }
        if (tx.type === "expense" && tx.walletId === w.id) {
          return sum - tx.amount;
        }
        if (tx.type === "transfer") {
          if (tx.toWalletId === w.id) {
            return sum + tx.amount;
          }
          if (tx.walletId === w.id) {
            return sum - tx.amount;
          }
        }
        return sum;
      }, 0);
      
    return {
      wallet: w,
      monthlyTarget,
      monthlySaved: Math.max(0, monthlyNetChange),
    };
  });

  const totalSavingWalletsMonthlyTarget = savingWalletsWithTargets.reduce((sum, item) => sum + item.monthlyTarget, 0);
  const totalSavingWalletsMonthlySaved = savingWalletsWithTargets.reduce((sum, item) => sum + item.monthlySaved, 0);

  // Recommended/Target Savings based on mode
  const recommendedSavings = goalMode === "saving_wallets"
    ? totalSavingWalletsMonthlyTarget
    : goalMode === "baht" 
    ? bahtGoalAmount 
    : totalIncome * (savingsGoal / 100);

  // Actual Savings used for the target indicator based on mode
  const actualSavingsGoalAmount = goalMode === "saving_wallets"
    ? totalSavingWalletsMonthlySaved
    : actualSavings;

  const achievementPercent = recommendedSavings > 0 
    ? (actualSavingsGoalAmount / recommendedSavings) * 100 
    : (currentMonthNet > 0 || actualSavingsGoalAmount > 0 ? 100 : 0);

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

  // Calculations for Cash Flow Movement System
  const totalInflows = broughtForward + totalIncome;
  const maxInflow = Math.max(totalInflows, 1);
  const expenseToIncomePctStr = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(0) : (totalExpense > 0 ? "∞" : "0");
  
  let carriedForwardChangePct = 0;
  if (broughtForward > 0) {
    carriedForwardChangePct = ((carriedForward - broughtForward) / broughtForward) * 100;
  } else if (carriedForward > 0) {
    carriedForwardChangePct = 100;
  }

  // Daily Cash Flow data calculations for the selected month
  const [yearStr, monthStr] = selectedMonth.split("-");
  const parsedYear = parseInt(yearStr, 10);
  const parsedMonth = parseInt(monthStr, 10);
  const daysInMonth = isNaN(parsedYear) || isNaN(parsedMonth) ? 30 : new Date(parsedYear, parsedMonth, 0).getDate();

  const excludedWalletIds = new Set(
    wallets.filter((w) => w.excludeFromTotal).map((w) => w.id)
  );

  const dailyData: Array<{
    day: number;
    dateStr: string;
    income: number;
    expense: number;
    remaining: number;
  }> = [];

  let runningBalance = broughtForward;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
    const dayTransactions = transactions.filter((tx) => tx.date === dayStr);

    const income = dayTransactions.reduce((sum, tx) => {
      if (tx.type === "income") {
        const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
        if (!isExcluded) return sum + tx.amount;
      } else if (tx.type === "transfer") {
        const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
        const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
        // Transfer from excluded to main = income to main
        if (isSrcExcluded && !isDstExcluded) return sum + tx.amount;
      }
      return sum;
    }, 0);

    const expense = dayTransactions.reduce((sum, tx) => {
      if (tx.type === "expense") {
        const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
        if (!isExcluded) return sum + tx.amount;
      } else if (tx.type === "transfer") {
        const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
        const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
        // Transfer from main to excluded = expense to main
        if (!isSrcExcluded && isDstExcluded) return sum + tx.amount;
      }
      return sum;
    }, 0);

    runningBalance += income - expense;

    dailyData.push({
      day: d,
      dateStr: dayStr,
      income,
      expense,
      remaining: runningBalance,
    });
  }

  // Maximum value for scaling the chart (non-stacked)
  const rawMax = Math.max(
    ...dailyData.map((d) => Math.max(d.income, d.expense, d.remaining)),
    100 // minimum scale of 100
  );

  // Get a clean ceiling so that grid lines are neat and the bars have breathing room
  let maxStackValue = 100;
  if (rawMax <= 100) maxStackValue = 100;
  else if (rawMax <= 250) maxStackValue = 250;
  else if (rawMax <= 500) maxStackValue = 500;
  else if (rawMax <= 1000) maxStackValue = 1000;
  else if (rawMax <= 1500) maxStackValue = 1500;
  else if (rawMax <= 2000) maxStackValue = 2000;
  else if (rawMax <= 3000) maxStackValue = 3000;
  else if (rawMax <= 5000) maxStackValue = 5000;
  else if (rawMax <= 10000) maxStackValue = 10000;
  else if (rawMax <= 15000) maxStackValue = 15000;
  else if (rawMax <= 20000) maxStackValue = 20000;
  else if (rawMax <= 30000) maxStackValue = 30000;
  else if (rawMax <= 50000) maxStackValue = 50000;
  else if (rawMax <= 100000) maxStackValue = 100000;
  else {
    maxStackValue = Math.ceil(rawMax / 50000) * 50000;
  }

  const linePoints = dailyData.map((d) => {
    const cx = 45 + (d.day - 1) * 24 + 12;
    const cy = 140 - (d.remaining / maxStackValue) * 130;
    return { cx, cy, day: d.day, remaining: d.remaining, income: d.income, expense: d.expense };
  });

  const pathD = linePoints.length > 0
    ? linePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`).join(' ')
    : '';

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
                const visibleWallets = wallets.filter((w) => !w.excludeFromTotal);
                const totalWalletInitial = visibleWallets.reduce((sum, w) => sum + w.initialBalance, 0);
                if (visibleWallets.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
                      {visibleWallets.slice(0, 3).map((w, idx) => {
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
                      {visibleWallets.slice(0, 2).map((w, idx) => {
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
                วิเคราะห์การเก็บออม (Savings Goals)
              </span>
              <div className="p-1 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-lg">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            
            {/* Target vs Actual */}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] border-b border-white/5 pb-2">
              <div>
                <span className="text-slate-400 block">ยอดเป้าหมายออม:</span>
                <span className="font-bold text-pink-300">
                  {recommendedSavings > 0 
                    ? `฿${recommendedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "ยังไม่ระบุเป้าหมาย"
                  }
                </span>
                <span className="text-[8px] text-slate-500 block">
                  {goalMode === "saving_wallets" 
                    ? "🐷 ดึงจากกระปุกออมสิน" 
                    : goalMode === "baht" 
                    ? "🎯 ตั้งเป้าแบบรายเดือน" 
                    : `🎯 ${savingsGoal}% ของรายรับ`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">สะสมได้จริง:</span>
                <span className={`font-bold ${actualSavingsGoalAmount >= recommendedSavings && recommendedSavings > 0 ? "text-emerald-400" : "text-pink-400"}`}>
                  ฿{actualSavingsGoalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  ({goalMode === "saving_wallets" 
                    ? `${recommendedSavings > 0 ? ((actualSavingsGoalAmount / recommendedSavings) * 100).toFixed(1) : 0}% ของเป้ากระปุก`
                    : `${savingsRate.toFixed(1)}% ของรายรับ`
                  })
                </span>
              </div>
            </div>

            {/* Achievement Percent & Bar */}
            <div className="mt-2.5">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <span>ความสำเร็จออมเงิน:</span>
                  {achievementPercent >= 100 && <Trophy className="w-3 h-3 text-amber-400 animate-bounce" />}
                </span>
                <span className={`font-bold ${achievementPercent >= 100 ? "text-emerald-400" : achievementPercent >= 50 ? "text-amber-400" : "text-pink-400"}`}>
                  {achievementPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    achievementPercent >= 100
                      ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                      : achievementPercent >= 50
                      ? "bg-gradient-to-r from-amber-400 to-orange-400"
                      : "bg-gradient-to-r from-pink-400 to-rose-400"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, achievementPercent))}%` }}
                />
              </div>
            </div>

            {/* Saving Wallets breakdown list when in saving_wallets mode */}
            {goalMode === "saving_wallets" && (
              <div className="mt-3.5 space-y-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-pink-300">
                  <span>🐷 รายการกระปุกออมสินเป้าหมาย:</span>
                  <span className="text-[8px] text-slate-400">กำหนดออมรายเดือน</span>
                </div>
                {savingWalletsWithTargets.length > 0 ? (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5 custom-scrollbar">
                    {savingWalletsWithTargets.map(({ wallet, monthlyTarget, monthlySaved }) => {
                      const pct = monthlyTarget > 0 ? (monthlySaved / monthlyTarget) * 100 : 0;
                      return (
                        <div key={wallet.id} className="bg-black/20 hover:bg-black/30 border border-white/5 rounded-xl p-2 transition-all space-y-1.5">
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="font-bold text-slate-200 flex items-center gap-1 truncate max-w-[120px]">
                              <span>🐷 {wallet.name}</span>
                              {wallet.excludeFromTotal && (
                                <span className="text-[7px] bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded border border-indigo-500/10">ซ่อนยอด</span>
                              )}
                            </span>
                            <span className="font-semibold text-slate-300">
                              ฿{monthlySaved.toLocaleString()} / <span className="text-pink-300 font-bold">฿{monthlyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct >= 100 ? "bg-emerald-400" : "bg-pink-400"
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[8px] text-slate-500">
                            <span>เก็บเพิ่มเดือนนี้:</span>
                            <span className={pct >= 100 ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-3 bg-black/10 rounded-xl border border-white/5 text-[9px] text-slate-400 leading-relaxed">
                    ⚠️ ไม่พบกระปุกออมสินที่มีการตั้งยอดเป้าหมายการออม<br/>
                    <span className="text-[8px] text-slate-500">สร้างหรือระบุยอดเป้าหมายออมได้ที่เมนู "จัดการกระเป๋าเงิน"</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Explanation if Negative */}
          {currentMonthNet < 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-[8px] sm:text-[9px] text-rose-300 leading-normal">
              ⚠️ <strong>สถานะออมติดลบ {netFlowRate.toFixed(1)}% เนื่องจาก</strong> เดือนนี้คุณใช้จ่ายมากกว่ารายรับรวม {Math.abs(currentMonthNet).toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿ ส่งผลให้ไม่สามารถออมสะสมเพิ่มขึ้นได้ค่ะ
            </div>
          )}

          {/* Config Goal Control panel */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center">
              <div className="text-[9px] text-slate-400">
                รูปแบบ: <span className="font-bold text-slate-200">
                  {goalMode === "saving_wallets" 
                    ? "ดึงจากกระปุกออมสิน" 
                    : goalMode === "baht" 
                    ? "จำนวนเงินบาท" 
                    : "อิงอัตราเปอร์เซ็นต์"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingGoal(!isEditingGoal)}
                className="text-[9px] text-pink-400 hover:text-pink-300 font-bold flex items-center gap-0.5 cursor-pointer bg-pink-500/10 hover:bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20 transition-all"
              >
                {isEditingGoal ? "เสร็จสิ้น" : "✏️ ตั้งเป้าออมเพิ่ม"}
              </button>
            </div>
            
            {isEditingGoal && (
              <div className="space-y-3 pt-1.5 animate-fade-in bg-white/5 p-2.5 rounded-2xl border border-white/5">
                {/* Mode Selector */}
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/20 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleGoalModeToggle("saving_wallets")}
                    className={`py-1 text-[8px] sm:text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                      goalMode === "saving_wallets" 
                        ? "bg-pink-500/20 text-pink-300 border border-pink-500/20" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🐷 ดึงจากกระปุก
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoalModeToggle("baht")}
                    className={`py-1 text-[8px] sm:text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                      goalMode === "baht" 
                        ? "bg-pink-500/20 text-pink-300 border border-pink-500/20" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    จำนวนเงิน (฿)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoalModeToggle("percent")}
                    className={`py-1 text-[8px] sm:text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                      goalMode === "percent" 
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    อิงรายรับ (%)
                  </button>
                </div>

                {/* Input Fields based on mode */}
                {goalMode === "saving_wallets" ? (
                  <div className="space-y-1.5 text-[9px] sm:text-[10px] text-slate-300 leading-normal">
                    <span className="font-extrabold text-pink-300 block">🐷 ดึงเป้าหมายจากกระปุกออมสิน:</span>
                    <div>คำนวณเป้าหมายรายเดือนอัตโนมัติจากแผนการออมเงินในแต่ละกระปุกรวมกัน</div>
                    <div className="text-[8px] text-slate-400 italic mt-1 leading-relaxed">
                      *สามารถสร้างกระปุกใหม่ ระบุเป้าหมาย และระยะเวลาออมเงินได้จากแถบเมนู "จัดการกระเป๋าเงิน" แล้วระบบจะดึงข้อมูลมาแสดงที่นี่โดยอัตโนมัติ
                    </div>
                  </div>
                ) : goalMode === "baht" ? (
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-semibold text-slate-400">
                      เป้าหมายการออมเดือน {formatThaiMonth(selectedMonth)}
                    </label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">฿</span>
                        <input
                          type="number"
                          value={customBahtInput}
                          onChange={(e) => setCustomBahtInput(e.target.value)}
                          placeholder="ระบุ เช่น 5000"
                          className="w-full pl-6 pr-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs font-semibold text-white focus:outline-hidden focus:border-pink-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSaveMonthlyGoal) {
                            onSaveMonthlyGoal(selectedMonth, parseFloat(customBahtInput) || 0);
                          }
                          setIsEditingGoal(false);
                        }}
                        className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[8px] font-semibold text-slate-400">
                      <span>อิงเป้าหมายที่ {savingsGoal}% ของรายรับเดือนนี้</span>
                      <span className="text-indigo-300 font-bold">
                        (฿{recommendedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    </div>
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
            )}
          </div>
        </div>
      </div>

      {/* 6. Cash Flow Movement System Card */}
      <div id="cash-flow-movement-system" className="bg-gradient-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <ArrowRightLeft className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">🔄 ระบบคำนวณการเคลื่อนไหวของเงิน (Cash Flow Movement)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">วิเคราะห์สัดส่วนและความเคลื่อนไหวของเงินทุนหมุนเวียนในเดือนนี้</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full text-[9px] text-indigo-300 font-bold">
            <span>เดือน {formatThaiMonth(selectedMonth)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left panel: Detailed calculations */}
          <div className="lg:col-span-5 space-y-3">
            {/* Row 1: ยอดยกมา */}
            <div id="row-brought-forward" className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-3.5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400 font-bold border border-slate-500/10">
                  📦
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ยอดยกมาตั้งต้น</span>
                  <span className="text-xs text-slate-300 font-bold">ทุนตั้งต้นก่อนเริ่มเดือน</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-extrabold text-white block">
                  ฿{broughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[8px] text-slate-400 block font-medium">ยอดยกมาจากเดือนก่อน</span>
              </div>
            </div>

            {/* Row 2: รับรวม */}
            <div id="row-income-total" className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl p-3.5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/10">
                  🟢
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">รับรวมเดือนนี้</span>
                  <span className="text-xs text-slate-300 font-bold">รายรับและโอนย้ายขาเข้า</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-extrabold text-emerald-400 block">
                  ฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[8px] text-emerald-500/80 block font-bold">
                  + เพิ่มเข้ากระเป๋าเงิน
                </span>
              </div>
            </div>

            {/* Row 3: จ่ายรวม */}
            <div id="row-expense-total" className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl p-3.5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold border border-rose-500/10">
                  🔴
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">จ่ายรวมเดือนนี้</span>
                  <span className="text-xs text-slate-300 font-bold">รายจ่ายและโอนเข้ากระปุกซ่อน</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-extrabold text-rose-400 block">
                  ฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-500/15 text-rose-300 mt-0.5">
                  คิดเป็น {expenseToIncomePctStr}% ของรายรับ
                </span>
              </div>
            </div>

            {/* Row 4: ยอดเงินยกไปเดือนหน้า */}
            <div id="row-carried-forward" className="bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 rounded-2xl p-3.5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/10">
                  🏦
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ยอดเงินยกไปเดือนหน้า</span>
                  <span className="text-xs text-slate-300 font-bold">เงินคงเหลือสะสมยกยอดไป</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-extrabold text-white block">
                  ฿{carriedForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black mt-0.5 ${
                  carriedForward >= broughtForward 
                    ? "bg-emerald-500/15 text-emerald-400" 
                    : "bg-rose-500/15 text-rose-300"
                }`}>
                  {carriedForward >= broughtForward ? "เพิ่มขึ้น" : "ติดลบ"} {Math.abs(carriedForwardChangePct).toFixed(0)}% จากยอดยกมา
                </span>
              </div>
            </div>
          </div>

          {/* Right panel: Beautiful Visual Diagram Graph */}
          <div id="sankey-flow-chart-panel" className="lg:col-span-7 bg-black/20 rounded-2xl p-4 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[280px]">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-white/5 pb-2 mb-2">
              <span>📊 กราฟความเคลื่อนไหวรายวัน (Daily Cash Flow & Balance Trend)</span>
              <span className="text-[9px] text-slate-500">หน่วย: บาท (฿)</span>
            </div>

            {/* Scrollable Container for Daily Bar Chart */}
            <div className="overflow-x-auto select-none pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <div style={{ width: `${daysInMonth * 24 + 65}px` }} className="relative h-[180px]">
                <svg className="w-full h-full" viewBox={`0 0 ${daysInMonth * 24 + 65} 180`} preserveAspectRatio="xMinYMid meet">
                  {/* Grid Lines & Y-axis labels */}
                  {(() => {
                    const gridLines = [];
                    const steps = 4;
                    for (let i = 0; i <= steps; i++) {
                      const val = (maxStackValue / steps) * i;
                      const y = 140 - (val / maxStackValue) * 130;
                      gridLines.push({ val, y });
                    }
                    return gridLines.map((line, idx) => (
                      <g key={idx}>
                        <line
                          x1="38"
                          y1={line.y}
                          x2={daysInMonth * 24 + 50}
                          y2={line.y}
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                        />
                        <text
                          x="32"
                          y={line.y + 3}
                          fill="#64748b"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {(() => {
                            const val = line.val;
                            if (val >= 1000) {
                              const kVal = val / 1000;
                              if (kVal % 1 === 0) {
                                return `${kVal.toFixed(0)}k`;
                              }
                              return `${kVal.toFixed(1)}k`;
                            }
                            return Math.round(val).toString();
                          })()}
                        </text>
                      </g>
                    ));
                  })()}

                  {/* Daily Stacked Columns for Income and Expense */}
                  {dailyData.map((dData) => {
                    const x = 45 + (dData.day - 1) * 24;
                    const cx = x + 12; // Center of the slot
                    const barWidth = 10;
                    const barX = cx - barWidth / 2;

                    const greenHeight = (dData.income / maxStackValue) * 130;
                    const redHeight = (dData.expense / maxStackValue) * 130;

                    const yGreen = 140 - greenHeight;
                    const yRed = 140 - greenHeight - redHeight;

                    const isHovered = hoveredDay && hoveredDay.day === dData.day;

                    return (
                      <g key={`bars-${dData.day}`} className="transition-all duration-200">
                        {/* Green Block ("รับ") */}
                        {greenHeight > 0 && (
                          <g>
                            <rect
                              x={barX}
                              y={yGreen}
                              width={barWidth}
                              height={greenHeight}
                              fill="#4ade80"
                              stroke="rgba(255, 255, 255, 0.3)"
                              strokeWidth="0.5"
                              rx="1.5"
                              className="transition-all duration-200"
                              opacity={isHovered ? 1 : 0.85}
                            />
                            {greenHeight > 10 && (
                              <text
                                x={cx}
                                y={yGreen + greenHeight / 2 + 2.5}
                                fill="#047857"
                                fontSize="6.5"
                                fontWeight="black"
                                textAnchor="middle"
                              >
                                {Math.round(dData.income)}
                              </text>
                            )}
                          </g>
                        )}

                        {/* Red Block ("จ่าย") */}
                        {redHeight > 0 && (
                          <g>
                            <rect
                              x={barX}
                              y={yRed}
                              width={barWidth}
                              height={redHeight}
                              fill="#f87171"
                              stroke="rgba(255, 255, 255, 0.3)"
                              strokeWidth="0.5"
                              rx="1.5"
                              className="transition-all duration-200"
                              opacity={isHovered ? 1 : 0.85}
                            />
                            {redHeight > 10 && (
                              <text
                                x={cx}
                                y={yRed + redHeight / 2 + 2.5}
                                fill="#7f1d1d"
                                fontSize="6.5"
                                fontWeight="black"
                                textAnchor="middle"
                              >
                                {Math.round(dData.expense)}
                              </text>
                            )}
                          </g>
                        )}

                        {/* X-Axis day label */}
                        <text
                          x={cx}
                          y="158"
                          fill={isHovered ? "#ffffff" : "#64748b"}
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {dData.day}
                        </text>

                        {/* Interactive overlay column */}
                        <rect
                          x={x - 2.5}
                          y="5"
                          width="24"
                          height="160"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredDay(dData)}
                          onMouseLeave={() => setHoveredDay(null)}
                        />
                      </g>
                    );
                  })}

                  {/* Remaining Balance Line Stroke */}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_4px_rgba(59,130,246,0.8)] pointer-events-none"
                    />
                  )}

                  {/* Remaining Balance Dots and Value Labels */}
                  {linePoints.map((pt) => {
                    const isHovered = hoveredDay && hoveredDay.day === pt.day;
                    return (
                      <g key={`dot-group-${pt.day}`} className="pointer-events-none">
                        <circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r={isHovered ? "5" : "3.5"}
                          fill="#ffffff"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          className="transition-all duration-200"
                        />
                        <text
                          x={pt.cx}
                          y={pt.cy - 8}
                          fill={isHovered ? "#60a5fa" : "#38bdf8"}
                          fontSize="7"
                          fontWeight="black"
                          textAnchor="middle"
                          className="filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                        >
                          {Math.round(pt.remaining).toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bottom line baseline */}
                  <line
                    x1="38"
                    y1="140"
                    x2={daysInMonth * 24 + 50}
                    y2="140"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />

                  {/* Label for X-axis */}
                  <text
                    x="15"
                    y="158"
                    fill="#94a3b8"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="start"
                  >
                    วันที่
                  </text>
                </svg>
              </div>
            </div>

            {/* Hover details display or help tip */}
            {hoveredDay ? (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-2.5 text-[11px] text-indigo-200 mt-2 flex flex-wrap justify-between items-center gap-2 animate-fade-in">
                <span className="font-extrabold text-white">📅 วันที่ {hoveredDay.day} {formatThaiMonth(selectedMonth)}</span>
                <div className="flex gap-3 font-bold">
                  <span className="text-emerald-400">🟢 รับ: ฿{hoveredDay.income.toLocaleString()}</span>
                  <span className="text-rose-400">🔴 จ่าย: ฿{hoveredDay.expense.toLocaleString()}</span>
                  <span className="text-amber-400">🟡 เหลือ: ฿{hoveredDay.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/5 rounded-xl p-2 text-[10px] text-slate-400 mt-2 text-center">
                💡 วางเมาส์หรือแตะที่แท่งกราฟเพื่อดูรายละเอียดงบรายวันแบบเจาะลึก
              </div>
            )}

            {/* Quick Helper Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 border-t border-white/5 pt-2 text-[8px] sm:text-[9px] text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#4ade80] border border-white/20" /> รับ (รายรับ)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#f87171] border border-white/20" /> จ่าย (รายจ่าย)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative flex items-center justify-center w-5 h-2.5">
                  <span className="absolute w-5 h-[2px] bg-[#3b82f6]" />
                  <span className="absolute w-2 h-2 rounded-full bg-white border border-[#3b82f6] z-10" />
                </span>
                ยอดคงเหลือ (สะสม)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
