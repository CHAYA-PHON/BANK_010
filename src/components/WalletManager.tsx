import { useState, useEffect, FormEvent } from "react";
import { Wallet, Transaction } from "../types";
import { 
  Plus, Edit, Trash2, Landmark, Wallet as WalletIcon, CreditCard, 
  HelpCircle, ArrowRightLeft, X, Check, ArrowRight, TrendingUp, Sparkles, Coins,
  ArrowUp, ArrowDown, Star, ArrowUpRight, ArrowDownLeft, Eye
} from "lucide-react";

interface WalletManagerProps {
  wallets: Wallet[];
  transactions: Transaction[];
  onAddWallet: (wallet: Omit<Wallet, "id" | "createdAt">) => void;
  onUpdateWallet: (id: string, wallet: Omit<Wallet, "id" | "createdAt">) => void;
  onDeleteWallet: (id: string) => void;
  onAddTransaction: (data: Omit<Transaction, "id" | "createdAt">) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onReorderWallets?: (wallets: Wallet[]) => void;
  theme?: string;
}

const WALLET_COLORS = [
  { name: "Indigo Velvet", value: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border-indigo-400/20" },
  { name: "Emerald Mint", value: "bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border-emerald-400/20" },
  { name: "Rose Ruby", value: "bg-gradient-to-br from-rose-600 via-pink-700 to-purple-800 border-rose-400/20" },
  { name: "Amber Sun", value: "bg-gradient-to-br from-amber-500 via-orange-600 to-yellow-800 border-amber-400/20" },
  { name: "Ocean Blue", value: "bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-800 border-blue-400/20" },
  { name: "Cosmic Charcoal", value: "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 border-slate-600/20" },
];

const WALLET_ICONS = ["💵", "🏦", "💳", "🐷", "💰", "💼", "🛒", "🔑"];

const getWalletThemeCompact = (colorStr: string, isLight: boolean = false) => {
  if (isLight) {
    if (colorStr.includes("emerald")) {
      return {
        border: "border-emerald-500/15",
        activeBorder: "border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-500/10",
        text: "text-emerald-700",
        bg: "bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30"
      };
    }
    if (colorStr.includes("rose") || colorStr.includes("pink")) {
      return {
        border: "border-rose-500/15",
        activeBorder: "border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)] bg-rose-500/10",
        text: "text-rose-700",
        bg: "bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30"
      };
    }
    if (colorStr.includes("amber") || colorStr.includes("orange") || colorStr.includes("yellow")) {
      return {
        border: "border-amber-500/15",
        activeBorder: "border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-amber-500/10",
        text: "text-amber-700",
        bg: "bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30"
      };
    }
    if (colorStr.includes("blue") || colorStr.includes("cyan")) {
      return {
        border: "border-blue-500/15",
        activeBorder: "border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-blue-500/10",
        text: "text-blue-700",
        bg: "bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30"
      };
    }
    if (colorStr.includes("slate") || colorStr.includes("gray")) {
      return {
        border: "border-slate-500/15",
        activeBorder: "border-2 border-slate-500 shadow-[0_0_15px_rgba(100,116,139,0.15)] bg-slate-500/10",
        text: "text-slate-700",
        bg: "bg-slate-500/5 hover:bg-slate-500/10 hover:border-slate-500/30"
      };
    }
    // default Indigo
    return {
      border: "border-indigo-500/15",
      activeBorder: "border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] bg-indigo-500/10",
      text: "text-indigo-700",
      bg: "bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/30"
    };
  }

  // Dark mode
  if (colorStr.includes("emerald")) {
    return {
      border: "border-emerald-500/30",
      activeBorder: "border-2 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] bg-emerald-500/10",
      text: "text-emerald-400",
      bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-emerald-500/50"
    };
  }
  if (colorStr.includes("rose") || colorStr.includes("pink")) {
    return {
      border: "border-rose-500/30",
      activeBorder: "border-2 border-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.3)] bg-rose-500/10",
      text: "text-rose-400",
      bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-rose-500/50"
    };
  }
  if (colorStr.includes("amber") || colorStr.includes("orange") || colorStr.includes("yellow")) {
    return {
      border: "border-amber-500/30",
      activeBorder: "border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-amber-500/10",
      text: "text-amber-400",
      bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-amber-500/50"
    };
  }
  if (colorStr.includes("blue") || colorStr.includes("cyan")) {
    return {
      border: "border-blue-500/30",
      activeBorder: "border-2 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/10",
      text: "text-blue-400",
      bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-blue-500/50"
    };
  }
  if (colorStr.includes("slate") || colorStr.includes("gray")) {
    return {
      border: "border-slate-500/30",
      activeBorder: "border-2 border-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.3)] bg-slate-500/10",
      text: "text-slate-300",
      bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-slate-500/50"
    };
  }
  // default Indigo
  return {
    border: "border-indigo-500/30",
    activeBorder: "border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-indigo-500/10",
    text: "text-indigo-400",
    bg: "bg-[#111625]/60 hover:bg-[#182032]/80 hover:border-indigo-500/50"
  };
};

interface GoalCalculations {
  remainingAmount: number;
  isOverdue: boolean;
  remainingMonths: number;
  remainingYears: number;
  requiredPerMonth: number;
  requiredPerYear: number;
  initialPerMonth: number;
  initialPerYear: number;
}

export function getRemainingGoalCalculations(wallet: Wallet, currentBalance: number): GoalCalculations | null {
  const target = wallet.targetAmount ?? 0;
  if (target <= 0) return null;

  // Remaining money to save
  const remainingAmount = Math.max(0, target - currentBalance);

  // Remaining time calculation from TODAY
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = wallet.dueDate ? new Date(wallet.dueDate) : null;
  
  // Total initial duration defined by user
  const totalPeriodVal = wallet.goalPeriodValue ?? 1;
  const totalPeriodUnit = wallet.goalPeriodUnit ?? 'year';
  const initialPerMonth = totalPeriodUnit === 'year' ? (target / (totalPeriodVal * 12)) : (target / totalPeriodVal);
  const initialPerYear = totalPeriodUnit === 'year' ? (target / totalPeriodVal) : (target / (totalPeriodVal / 12));

  if (!dueDate || isNaN(dueDate.getTime())) {
    return {
      remainingAmount,
      isOverdue: false,
      remainingMonths: totalPeriodUnit === 'year' ? totalPeriodVal * 12 : totalPeriodVal,
      remainingYears: totalPeriodUnit === 'year' ? totalPeriodVal : totalPeriodVal / 12,
      requiredPerMonth: totalPeriodUnit === 'year' ? (remainingAmount / (totalPeriodVal * 12)) : (remainingAmount / totalPeriodVal),
      requiredPerYear: totalPeriodUnit === 'year' ? (remainingAmount / totalPeriodVal) : (remainingAmount / (totalPeriodVal / 12)),
      initialPerMonth,
      initialPerYear,
    };
  }

  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const isOverdue = diffTime < 0;

  let remainingMonths = 0;
  let remainingYears = 0;

  if (!isOverdue) {
    // Difference in months
    const yDiff = dueDate.getFullYear() - today.getFullYear();
    const mDiff = dueDate.getMonth() - today.getMonth();
    
    // Convert to float months
    let totalMonths = yDiff * 12 + mDiff;
    
    // Adjust day difference
    const dayDiff = dueDate.getDate() - today.getDate();
    if (dayDiff > 0) {
      totalMonths += (dayDiff / 30);
    } else if (dayDiff < 0) {
      totalMonths += (dayDiff / 30);
    }
    
    remainingMonths = Math.max(0.1, totalMonths);
    remainingYears = remainingMonths / 12;
  } else {
    remainingMonths = 0;
    remainingYears = 0;
  }

  const requiredPerMonth = remainingMonths > 0 ? (remainingAmount / remainingMonths) : remainingAmount;
  const requiredPerYear = remainingYears > 0 ? (remainingAmount / remainingYears) : remainingAmount;

  return {
    remainingAmount,
    isOverdue,
    remainingMonths,
    remainingYears,
    requiredPerMonth,
    requiredPerYear,
    initialPerMonth,
    initialPerYear,
  };
}

export default function WalletManager({
  wallets,
  transactions,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onReorderWallets,
  theme = "dark",
}: WalletManagerProps) {
  // Selected wallet for showing cash flow (inflow/outflow)
  const [selectedWalletFlowId, setSelectedWalletFlowId] = useState<string | null>(null);
  const [isFlowDetailsVisible, setIsFlowDetailsVisible] = useState(false);

  // Automatically select the default (main) wallet on initial load or reset
  useEffect(() => {
    if (!selectedWalletFlowId && wallets.length > 0) {
      const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
      setSelectedWalletFlowId(defaultWallet.id);
    }
  }, [wallets, selectedWalletFlowId]);

  // Modal states
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  // Form states - Wallet
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState<Wallet["type"]>("cash");
  const [initialBalance, setInitialBalance] = useState("");
  const [walletIcon, setWalletIcon] = useState("💵");
  const [walletColor, setWalletColor] = useState(WALLET_COLORS[0].value);
  const [accountNumber, setAccountNumber] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [walletTargetAmount, setWalletTargetAmount] = useState("");
  const [walletDueDate, setWalletDueDate] = useState("");
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [goalPeriodValue, setGoalPeriodValue] = useState("1");
  const [goalPeriodUnit, setGoalPeriodUnit] = useState<"month" | "year">("year");

  // Form states - Transfer
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);

  // Automatically calculate target dueDate when duration values change in add/edit modal
  useEffect(() => {
    if (walletType === "saving" && goalPeriodValue) {
      const val = parseInt(goalPeriodValue, 10);
      if (!isNaN(val) && val > 0) {
        const date = new Date();
        if (goalPeriodUnit === "year") {
          date.setFullYear(date.getFullYear() + val);
        } else {
          date.setMonth(date.getMonth() + val);
        }
        setWalletDueDate(date.toISOString().split("T")[0]);
      }
    }
  }, [goalPeriodValue, goalPeriodUnit, walletType]);

  // Dynamically calculate balances of each wallet
  const walletBalances: Record<string, number> = {};
  wallets.forEach((w) => {
    walletBalances[w.id] = w.initialBalance;
  });

  transactions.forEach((tx) => {
    const amount = tx.amount;
    if (tx.type === "income" && tx.walletId) {
      if (walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] += amount;
      }
    } else if (tx.type === "expense" && tx.walletId) {
      if (walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] -= amount;
      }
    } else if (tx.type === "transfer") {
      if (tx.walletId && walletBalances[tx.walletId] !== undefined) {
        walletBalances[tx.walletId] -= amount;
      }
      if (tx.toWalletId && walletBalances[tx.toWalletId] !== undefined) {
        walletBalances[tx.toWalletId] += amount;
      }
    }
  });

  const totalBalance = wallets.reduce((sum, w) => {
    if (w.excludeFromTotal) return sum;
    return sum + (walletBalances[w.id] ?? 0);
  }, 0);

  const openAddWalletModal = () => {
    setEditingWallet(null);
    setWalletName("");
    setWalletType("cash");
    setInitialBalance("0");
    setWalletIcon("💵");
    setWalletColor(WALLET_COLORS[0].value);
    setAccountNumber("");
    setIsDefault(wallets.length === 0);
    setWalletTargetAmount("");
    setWalletDueDate("");
    setExcludeFromTotal(false);
    setGoalPeriodValue("1");
    setGoalPeriodUnit("year");
    setIsWalletModalOpen(true);
  };

  const openEditWalletModal = (w: Wallet) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletType(w.type);
    setInitialBalance(w.initialBalance.toString());
    setWalletIcon(w.icon);
    setWalletColor(w.color);
    setAccountNumber(w.accountNumber || "");
    setIsDefault(!!w.isDefault);
    setWalletTargetAmount(w.targetAmount ? w.targetAmount.toString() : "");
    setWalletDueDate(w.dueDate || "");
    setExcludeFromTotal(!!w.excludeFromTotal);
    setGoalPeriodValue(w.goalPeriodValue ? w.goalPeriodValue.toString() : "1");
    setGoalPeriodUnit(w.goalPeriodUnit || "year");
    setIsWalletModalOpen(true);
  };

  const openTransferModal = () => {
    if (wallets.length < 2) {
      alert("กรุณาสร้างกระเป๋าเงินอย่างน้อย 2 ใบ เพื่อทำรายการโอนเงิน");
      return;
    }
    setFromWalletId(wallets[0].id);
    setToWalletId(wallets[1].id);
    setTransferAmount("");
    setTransferNote("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setIsTransferModalOpen(true);
  };

  const handleWalletSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) {
      alert("กรุณากรอกชื่อกระเป๋าเงิน");
      return;
    }

    const walletData = {
      name: walletName.trim(),
      type: walletType,
      initialBalance: parseFloat(initialBalance) || 0,
      icon: walletIcon,
      color: walletColor,
      accountNumber: accountNumber.trim() || undefined,
      isDefault: isDefault,
      targetAmount: walletType === "saving" && walletTargetAmount ? parseFloat(walletTargetAmount) : undefined,
      dueDate: walletType === "saving" && walletDueDate ? walletDueDate : undefined,
      excludeFromTotal: walletType === "saving" ? excludeFromTotal : false,
      goalPeriodValue: walletType === "saving" && walletTargetAmount ? (parseInt(goalPeriodValue, 10) || undefined) : undefined,
      goalPeriodUnit: walletType === "saving" && walletTargetAmount ? goalPeriodUnit : undefined,
    };

    if (editingWallet) {
      onUpdateWallet(editingWallet.id, walletData);
    } else {
      onAddWallet(walletData);
    }
    setIsWalletModalOpen(false);
  };

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      alert("กรุณาระบุจำนวนเงินที่ถูกต้องและมากกว่า 0");
      return;
    }
    if (fromWalletId === toWalletId) {
      alert("บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน");
      return;
    }

    const fromWallet = wallets.find((w) => w.id === fromWalletId);
    const toWallet = wallets.find((w) => w.id === toWalletId);

    if (!fromWallet || !toWallet) return;

    // Balance validation to allow negative balance with confirmation
    const currentFromBalance = walletBalances[fromWalletId] || 0;
    if (amount > currentFromBalance) {
      const projected = currentFromBalance - amount;
      const confirmTransfer = confirm(
        `⚠️ ยอดคงเหลือในกระเป๋าต้นทาง "${fromWallet.name}" ไม่เพียงพอ!\n\n` +
        `• ยอดคงเหลือปัจจุบัน: ฿${currentFromBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
        `• จำนวนที่ต้องการโอน: ฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
        `• ยอดคงเหลือจะติดลบเป็น: ฿${projected.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n\n` +
        `คุณต้องการยืนยันการทำรายการโอนเงินนี้ใช่หรือไม่?`
      );
      if (!confirmTransfer) {
        return;
      }
    }

    // Create a transaction record of type "transfer"
    onAddTransaction({
      type: "transfer",
      amount,
      category: "โอนเงินระหว่างกระเป๋า",
      merchantName: `โอนเงินจาก ${fromWallet.name} ไปยัง ${toWallet.name}`,
      date: transferDate,
      time: new Date().toTimeString().slice(0, 5),
      note: transferNote.trim() || undefined,
      walletId: fromWalletId,
      toWalletId,
    });

    setIsTransferModalOpen(false);
  };

  const handleQuickFixInitialBalance = (w: Wallet, currentBalance: number) => {
    const targetActualStr = prompt(
      `🔧 ปรับยอดเงินคงเหลือจริงในกระเป๋า "${w.name}"\n\n` +
      `• ยอดคงเหลือปัจจุบัน: ฿${currentBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
      `• ยอดเงินเริ่มต้นเดิม: ฿${w.initialBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n\n` +
      `กรุณากรอก "ยอดเงินคงเหลือจริงที่ต้องการให้เป็น" (เช่น 0 หรือ 500):`,
      "0"
    );
    if (targetActualStr === null) return;
    const targetActual = parseFloat(targetActualStr);
    if (isNaN(targetActual)) {
      alert("กรุณากรอกตัวเลขที่ถูกต้อง");
      return;
    }
    const netTransactions = currentBalance - w.initialBalance;
    const newInitialBalance = targetActual - netTransactions;

    onUpdateWallet(w.id, {
      ...w,
      initialBalance: Math.max(0, newInitialBalance)
    });
    alert(`✅ ปรับยอดเงินเรียบร้อยแล้ว!\n\nยอดคงเหลือใน "${w.name}" ถูกปรับเป็น ฿${targetActual.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);
  };

  return (
    <div id="wallet-manager-section" className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total balance of all wallets combined */}
        <div className="bg-indigo-500/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Coins className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">เงินรวมทุกกระเป๋า</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-white">฿{totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            คำนวณจากยอดเริ่มต้นรวมของทุกกระเป๋า และยอดรับเข้า/จ่ายออกทั้งหมดที่มีการระบุกระเป๋าตัง
          </p>
        </div>

        {/* Dynamic Brought Forward statistics */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ยอดยกมาเริ่มต้นระบบ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white">
              ฿{wallets.reduce((sum, w) => sum + w.initialBalance, 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
            ยอดทุนตั้งต้นทั้งหมดของกระเป๋าตังทุกใบรวมกันที่คุณกำหนดเป็นทุนเริ่มต้นตอนเปิดระบบ
          </p>
        </div>

        {/* Buttons layout */}
        <div className="flex flex-col justify-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
          <button
            type="button"
            onClick={openAddWalletModal}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มกระเป๋าตังใหม่
          </button>
          <button
            type="button"
            onClick={openTransferModal}
            className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
          >
            <ArrowRightLeft className="w-4 h-4" />
            ย้ายเงินระหว่างกระเป๋า
          </button>
        </div>
      </div>

      {/* Wallets Grid List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            💳 รายการกระเป๋าตังทั้งหมด ({wallets.length})
          </h3>
          <span className="text-xs text-slate-400">คลิกที่การ์ดเพื่อแก้ไขหรือตั้งค่าจำนวนเริ่มต้น</span>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl bg-white/5">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <WalletIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-300">ยังไม่มีกระเป๋าตังในระบบ</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">เริ่มต้นสร้างกระเป๋าตังใบแรกเพื่อแยกประเภท เงินสด เงินเก็บ หรือบัญชีธนาคาร</p>
            <button
              onClick={openAddWalletModal}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              สร้างกระเป๋าตังใบแรก
            </button>
          </div>
        ) : (
          (() => {
            const activeWalletId = selectedWalletFlowId || (wallets.find(w => w.isDefault)?.id || wallets[0].id);
            const selectedWallet = wallets.find(w => w.id === activeWalletId) || wallets[0];
            const selectedIdx = wallets.findIndex(w => w.id === selectedWallet.id);
            const selectedBalance = walletBalances[selectedWallet.id] ?? 0;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT: Selected Wallet (Large Detailed Card) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🔍 กำลังแสดงกระเป๋าขนาดใหญ่</span>
                    </span>
                  </div>

                  {selectedWallet ? (
                    <>
                      <div
                        className={`wallet-detailed-card relative ${selectedWallet.color} border p-6 rounded-3xl text-white shadow-xl flex flex-col justify-between min-h-[200px] group transition-all duration-300 border-white/25`}
                      >
                      {/* Top line info */}
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl filter drop-shadow-md select-none">{selectedWallet.icon}</span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-extrabold text-lg tracking-wide truncate max-w-[150px] text-white">
                                  {selectedWallet.name}
                                </h4>
                                {selectedWallet.isDefault && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded-md border border-amber-400/30 flex items-center gap-0.5 uppercase shrink-0">
                                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" /> หลัก
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] bg-black/25 text-white/90 font-semibold px-2 py-0.5 rounded-full border border-white/10 uppercase block w-fit mt-1">
                                {selectedWallet.type === "cash" ? "💸 เงินสด" : selectedWallet.type === "bank" ? "🏦 ธนาคาร" : selectedWallet.type === "credit" ? "💳 บัตรเครดิต" : selectedWallet.type === "saving" ? "🐷 กระปุกออมสิน" : "💼 อื่นๆ"}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[140px]">
                            {onReorderWallets && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedIdx > 0) {
                                      const newWallets = [...wallets];
                                      const temp = newWallets[selectedIdx];
                                      newWallets[selectedIdx] = newWallets[selectedIdx - 1];
                                      newWallets[selectedIdx - 1] = temp;
                                      onReorderWallets(newWallets);
                                    }
                                  }}
                                  disabled={selectedIdx === 0}
                                  className="p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                  title="เลื่อนขึ้น"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedIdx < wallets.length - 1) {
                                      const newWallets = [...wallets];
                                      const temp = newWallets[selectedIdx];
                                      newWallets[selectedIdx] = newWallets[selectedIdx + 1];
                                      newWallets[selectedIdx + 1] = temp;
                                      onReorderWallets(newWallets);
                                    }
                                  }}
                                  disabled={selectedIdx === wallets.length - 1}
                                  className="p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                  title="เลื่อนลง"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateWallet(selectedWallet.id, {
                                  name: selectedWallet.name,
                                  type: selectedWallet.type,
                                  initialBalance: selectedWallet.initialBalance,
                                  icon: selectedWallet.icon,
                                  color: selectedWallet.color,
                                  accountNumber: selectedWallet.accountNumber,
                                  isDefault: true
                                });
                              }}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                selectedWallet.isDefault 
                                  ? "bg-amber-500 text-slate-900 font-bold" 
                                  : "bg-black/20 text-white/60 hover:text-white hover:bg-black/40"
                              }`}
                              title={selectedWallet.isDefault ? "กระเป๋าตังค่าเริ่มต้น" : "ตั้งเป็นกระเป๋าเงินค่าเริ่มต้น"}
                            >
                              <Star className={`w-3.5 h-3.5 ${selectedWallet.isDefault ? "fill-slate-900 text-slate-900" : ""}`} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditWalletModal(selectedWallet);
                              }}
                              className="p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                              title="แก้ไขกระเป๋าตัง"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`คุณต้องการลบกระเป๋าเงิน "${selectedWallet.name}" ใช่หรือไม่? (ธุรกรรมที่เคยเกิดขึ้นในกระเป๋านี้จะไม่แสดงผลในกระเป๋า แต่ประวัติจะยังอยู่ในระบบ)`)) {
                                  onDeleteWallet(selectedWallet.id);
                                }
                              }}
                              className="p-1.5 bg-black/20 hover:bg-rose-600/60 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                              title="ลบกระเป๋าตัง"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Account Number & Savings Goal / Remaining Proportion Block inside Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3 w-full">
                          {selectedWallet.accountNumber ? (
                            <div className="font-mono text-xs text-white/90 tracking-wider bg-black/30 py-1.5 px-3 rounded-xl border border-white/10 w-fit shrink-0">
                              <span className="block text-[10px] text-white/60 mb-0.5">เลขบัญชี:</span>
                              <span className="font-bold block">{selectedWallet.accountNumber}</span>
                            </div>
                          ) : (
                            <div className="font-mono text-xs text-white/50 tracking-wider bg-black/10 py-1.5 px-3 rounded-xl border border-white/5 w-fit shrink-0">
                              ไม่มีเลขบัญชี
                            </div>
                          )}

                          {selectedWallet.type === "saving" && selectedWallet.targetAmount && selectedWallet.targetAmount > 0 ? (
                            <div className="flex-1 min-w-[220px] p-3 rounded-2xl border transition-all duration-300 bg-white/10 border-white/15 text-white backdrop-blur-sm">
                              <div className="flex justify-between items-center text-xs mb-1.5">
                                <div className="flex flex-col">
                                  <span className="font-extrabold flex items-center gap-1 text-pink-200 text-[10px]">
                                    🎯 เป้าหมายออมเงิน:
                                  </span>
                                  <span className="font-black text-xs text-white">
                                    ฿{selectedWallet.targetAmount.toLocaleString("th-TH")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black px-1.5 py-0.5 rounded-md text-[10px] border text-pink-300 bg-pink-500/20 border-pink-400/20">
                                    {((selectedBalance / selectedWallet.targetAmount) * 100).toFixed(1)}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextVal = !isFlowDetailsVisible;
                                      setIsFlowDetailsVisible(nextVal);
                                      setSelectedWalletFlowId(selectedWallet.id);
                                      if (nextVal) {
                                        setTimeout(() => {
                                          const element = document.getElementById("wallet-flow-details");
                                          if (element) {
                                            element.scrollIntoView({ behavior: "smooth", block: "start" });
                                          }
                                        }, 100);
                                      }
                                    }}
                                    className="text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-0.5 bg-white/10 hover:bg-white/20 text-white border-white/25"
                                  >
                                    {isFlowDetailsVisible ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                                  </button>
                                </div>
                              </div>
                              <div className="w-full h-2.5 rounded-full overflow-hidden border bg-black/20 border-white/5">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-pink-400 transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                                  style={{ width: `${Math.max(0, Math.min(100, (selectedBalance / selectedWallet.targetAmount) * 100))}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-[220px] p-3 rounded-2xl border transition-all duration-300 bg-white/10 border-white/15 text-white backdrop-blur-sm">
                              <div className="flex justify-between items-center text-xs mb-1.5">
                                <span className="font-extrabold flex items-center gap-1 text-sky-200">
                                  📊 สัดส่วนคงเหลือ:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black px-1.5 py-0.5 rounded-md text-[10px] border text-sky-300 bg-sky-500/20 border-sky-400/20">
                                    {(selectedWallet.initialBalance > 0 ? (selectedBalance / selectedWallet.initialBalance) * 100 : (selectedBalance > 0 ? 100 : 0)).toFixed(1)}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextVal = !isFlowDetailsVisible;
                                      setIsFlowDetailsVisible(nextVal);
                                      setSelectedWalletFlowId(selectedWallet.id);
                                      if (nextVal) {
                                        setTimeout(() => {
                                          const element = document.getElementById("wallet-flow-details");
                                          if (element) {
                                            element.scrollIntoView({ behavior: "smooth", block: "start" });
                                          }
                                        }, 100);
                                      }
                                    }}
                                    className="text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-0.5 bg-white/10 hover:bg-white/20 text-white border-white/25"
                                  >
                                    {isFlowDetailsVisible ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                                  </button>
                                </div>
                              </div>
                              <div className="w-full h-2.5 rounded-full overflow-hidden border bg-black/20 border-white/5">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-sky-400 transition-all duration-500 shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                                  style={{ width: `${Math.max(0, Math.min(100, selectedWallet.initialBalance > 0 ? (selectedBalance / selectedWallet.initialBalance) * 100 : (selectedBalance > 0 ? 100 : 0)))}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom line: Balance display */}
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <span className="text-xs text-white/70 block font-medium">ยอดเงินปัจจุบัน</span>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-3xl font-black tracking-tight ${selectedBalance < 0 ? "text-rose-400" : "text-white"}`}>
                            ฿{selectedBalance.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-white/60 font-semibold italic">
                            เริ่มที่: ฿{selectedWallet.initialBalance.toLocaleString("th-TH")}
                          </span>
                        </div>

                        {selectedBalance < 0 && (
                          <div className="mt-4 p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-100 text-xs space-y-2">
                            <div className="flex items-center gap-2 font-bold text-rose-200">
                              <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>⚠️ ยอดเงินในกระเป๋านี้ติดลบ (-฿{Math.abs(selectedBalance).toLocaleString("th-TH", { minimumFractionDigits: 2 })})</span>
                            </div>
                            <p className="text-[11px] text-rose-100/90 leading-relaxed">
                              เกิดจากเลือกกระเป๋าตัดเงินผิด หรือมียอดหักเกินเงินเริ่มต้น คุณสามารถแก้ไขได้ง่ายๆ:
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleQuickFixInitialBalance(selectedWallet, selectedBalance)}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3" />
                                <span>ปรับยอดคงเหลือจริง</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFromWalletId(wallets.find(w => w.id !== selectedWallet.id)?.id || "");
                                  setToWalletId(selectedWallet.id);
                                  setTransferAmount(Math.abs(selectedBalance).toString());
                                  setIsTransferModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>โอนเงินเข้ามาเติม</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWalletFlowId(selectedWallet.id);
                                  setIsFlowDetailsVisible(true);
                                  setTimeout(() => {
                                    const el = document.getElementById("wallet-flow-details");
                                    if (el) el.scrollIntoView({ behavior: "smooth" });
                                  }, 100);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <Coins className="w-3 h-3" />
                                <span>ตรวจ/แก้ไขรายการหักเงิน</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-xs py-10 bg-white/5 border border-white/10 rounded-2xl text-center">ไม่พบข้อมูลกระเป๋าเงิน</div>
                  )}
                </div>

                {/* RIGHT: Compact Wallets List ("เป๋าเล็ก ๆ") */}
                <div className="lg:col-span-7 space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    รายการกระเป๋าทั้งหมดในรูปแบบย่อ (คลิกเพื่อเลือก)
                  </span>

                  <div className="grid grid-flow-col grid-rows-2 overflow-x-auto lg:overflow-x-visible lg:grid-flow-row lg:grid-rows-none lg:grid-cols-2 gap-2.5 pb-2 lg:pb-0 scrollbar-thin">
                    {wallets.map((wallet) => {
                      const compactBalance = walletBalances[wallet.id] ?? 0;
                      const isSelected = wallet.id === activeWalletId;
                      const walletTheme = getWalletThemeCompact(wallet.color, theme === "light");

                      return (
                        <div
                          key={wallet.id}
                          onClick={() => {
                            setSelectedWalletFlowId(wallet.id);
                          }}
                          className={`rounded-2xl p-3 flex flex-col justify-between h-[76px] min-w-[150px] sm:min-w-[180px] lg:min-w-0 transition-all duration-200 cursor-pointer ${
                            isSelected 
                              ? walletTheme.activeBorder 
                              : `border border-white/5 ${walletTheme.bg} ${walletTheme.border}`
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-lg select-none shrink-0">{wallet.icon}</span>
                              <span className={`font-extrabold text-xs truncate ${theme === "light" ? "text-slate-800" : "text-white"}`} title={wallet.name}>
                                {wallet.name}
                              </span>
                            </div>
                            {wallet.isDefault && (
                              <span className="text-[8px] bg-amber-500/20 text-amber-500 font-extrabold px-1 rounded-sm border border-amber-400/20 uppercase shrink-0">
                                หลัก
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className={`text-[9px] ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>ยอดเงิน:</span>
                            <span className={`text-[13px] font-black tracking-tight ${
                              theme === "light"
                                ? isSelected ? "text-indigo-600" : "text-slate-800"
                                : isSelected ? "text-white" : "text-slate-200"
                            }`}>
                              ฿{compactBalance.toLocaleString("th-TH", { maximumFractionDigits: 1 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render empty dashed slots up to at least 6 total slots */}
                    {Array.from({ length: Math.max(0, 6 - wallets.length) }).map((_, i) => (
                      <div
                        key={`empty-slot-${i}`}
                        className="border border-white/5 border-dashed rounded-2xl h-[76px] min-w-[150px] sm:min-w-[180px] lg:min-w-0 flex flex-col items-center justify-center bg-white/[0.01]"
                      >
                        <span className="text-[9px] text-slate-600 font-medium tracking-wider uppercase">
                          ช่องกระเป๋าว่าง
                        </span>
                        <span className="text-[8px] text-slate-700 font-semibold mt-0.5">
                          ช่องที่ {wallets.length + i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Wallet Cash Flow Section */}
      {selectedWalletFlowId && isFlowDetailsVisible && (() => {
        const selectedWallet = wallets.find(w => w.id === selectedWalletFlowId);
        if (!selectedWallet) return null;

        const balance = walletBalances[selectedWalletFlowId] ?? 0;
        
        // Filter transactions for selected wallet
        const walletTxs = transactions.filter(tx => {
          return tx.walletId === selectedWalletFlowId || tx.toWalletId === selectedWalletFlowId;
        });

        // Sort chronologically (latest first)
        const sortedWalletTxs = [...walletTxs].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return (b.time || "").localeCompare(a.time || "");
        });

        // Calculate inflows / outflows
        let walletInflowSum = 0;
        let walletOutflowSum = 0;

        sortedWalletTxs.forEach(tx => {
          if (tx.type === "income" && tx.walletId === selectedWalletFlowId) {
            walletInflowSum += tx.amount;
          } else if (tx.type === "expense" && tx.walletId === selectedWalletFlowId) {
            walletOutflowSum += tx.amount;
          } else if (tx.type === "transfer") {
            if (tx.walletId === selectedWalletFlowId) {
              walletOutflowSum += tx.amount;
            }
            if (tx.toWalletId === selectedWalletFlowId) {
              walletInflowSum += tx.amount;
            }
          }
        });

        return (
          <div id="wallet-flow-details" className={`border rounded-3xl p-6 mb-6 transition-all duration-300 animate-fadeIn relative overflow-hidden ${
            theme === "light"
              ? "bg-white border-slate-200/80 text-slate-800"
              : "bg-white/5 border-white/10 text-white"
          }`}>
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            
            {/* Header */}
            <div className={`flex items-center justify-between mb-6 border-b pb-4 ${
              theme === "light" ? "border-slate-100" : "border-white/10"
            }`}>
              <div className="flex items-center gap-3">
                <span className={`text-3xl p-2 rounded-2xl border select-none shadow-sm ${
                  theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/10 border-white/10"
                }`}>{selectedWallet.icon}</span>
                <div>
                  <h3 className={`font-black text-lg tracking-wide flex items-center gap-2 ${
                    theme === "light" ? "text-slate-900" : "text-white"
                  }`}>
                    <span>การเคลื่อนไหวเงินในกระเป๋า</span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg animate-pulse ${
                      theme === "light"
                        ? "bg-indigo-50 border border-indigo-100 text-indigo-600"
                        : "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
                    }`}>
                      {selectedWallet.name}
                    </span>
                  </h3>
                  <p className={`text-xs ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>รายการเคลื่อนไหวทางการเงิน เงินเข้า / เงินออก ทั้งหมด</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsFlowDetailsVisible(false);
                }}
                className={`p-2 rounded-full transition-all cursor-pointer border ${
                  theme === "light"
                    ? "hover:bg-slate-100 text-slate-400 hover:text-slate-700 border-slate-200"
                    : "hover:bg-white/10 text-slate-400 hover:text-white border-white/5"
                }`}
                title="ปิดหน้านี้"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Savings Goal Status / Details */}
            {selectedWallet.type === "saving" && (
              <div className={`p-5 rounded-2xl border mb-6 space-y-4 shadow-xs ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200 text-slate-800"
                  : "bg-white/5 border-white/10 text-white"
              }`}>
                {selectedWallet.targetAmount && selectedWallet.targetAmount > 0 ? (
                  (() => {
                    const progressPercent = (balance / selectedWallet.targetAmount) * 100;
                    const cal = getRemainingGoalCalculations(selectedWallet, balance);
                    
                    return (
                      <div className="space-y-4">
                        {/* Exclude Total Status Badge */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase font-bold ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>สถานะกระปุกออมสิน</span>
                          {selectedWallet.excludeFromTotal ? (
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                              theme === "light"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            }`}>
                              🔒 ซ่อนยอด (แยกจากยอดรวม)
                            </span>
                          ) : (
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                              theme === "light"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            }`}>
                              🔓 รวมยอดกับกระเป๋าอื่นๆ
                            </span>
                          )}
                        </div>

                        {/* Goals & Period info */}
                        {cal && (
                          <div className={`rounded-2xl p-3.5 space-y-3 border ${
                            theme === "light"
                              ? "bg-white border-slate-200 text-slate-800"
                              : "bg-black/30 border-white/5 text-white"
                          }`}>
                            <div className="grid grid-cols-2 gap-3 text-[11px] leading-relaxed">
                              <div>
                                <span className={`block font-semibold ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>💰 ยอดที่เหลือต้องออมเพิ่ม:</span>
                                <span className={`font-black text-xs ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                  ฿{cal.remainingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div>
                                <span className={`block font-semibold ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>📅 วันสิ้นสุด & ระยะเวลาคงเหลือ:</span>
                                {cal.isOverdue ? (
                                  <span className={`font-bold text-[10px] ${theme === "light" ? "text-rose-600" : "text-rose-400"}`}>
                                    ⚠️ เลยกำหนด ({selectedWallet.dueDate})
                                  </span>
                                ) : (
                                  <span className={`font-bold text-[10px] ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                    {cal.remainingMonths >= 12 
                                      ? `${cal.remainingYears.toFixed(1)} ปี (${cal.remainingMonths.toFixed(0)} เดือน)` 
                                      : `${cal.remainingMonths.toFixed(1)} เดือน`
                                    }
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Smart Calculation display */}
                            <div className={`pt-2.5 border-t ${theme === "light" ? "border-slate-200" : "border-white/5"}`}>
                              <span className={`text-[10px] font-extrabold block uppercase tracking-wider mb-1.5 ${
                                theme === "light" ? "text-pink-600" : "text-pink-300"
                              }`}>
                                📈 แผนการออมเฉลี่ยเพื่อให้ถึงเป้าหมาย:
                              </span>
                              
                              {cal.isOverdue ? (
                                <div className={`text-[10px] leading-normal p-2 rounded-xl border ${
                                  theme === "light"
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                                }`}>
                                  เกินกำหนดระยะเวลาเป้าหมายแล้ว กรุณาขยายเวลาสิ้นสุดของเป้าหมายในเมนูแก้ไข เพื่อให้ระบบคำนวณออมเฉลี่ยต่อเดือนที่เหลือให้ใหม่
                                </div>
                              ) : cal.remainingAmount <= 0 ? (
                                <div className={`text-[10px] font-extrabold leading-normal p-2 rounded-xl border flex items-center gap-1 ${
                                  theme === "light"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                }`}>
                                  🏆 ยินดีด้วย! คุณสะสมเงินออมครบตามเป้าหมายของกระปุกนี้แล้ว
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className={`p-2 rounded-xl border ${
                                    theme === "light"
                                      ? "bg-slate-50 border-slate-200/80 text-slate-800"
                                      : "bg-white/5 border-white/5 text-white"
                                  }`}>
                                    <span className={`text-[8px] block ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>ออมเฉลี่ยจากยอดคงเหลือ:</span>
                                    <span className={`text-xs font-black ${theme === "light" ? "text-emerald-600" : "text-emerald-400"}`}>
                                      ฿{cal.requiredPerMonth.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className={`text-[8px] ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}> / เดือน</span>
                                    
                                    {selectedWallet.goalPeriodUnit === "year" && (
                                      <div className={`text-[9px] font-semibold mt-0.5 ${theme === "light" ? "text-slate-700" : "text-slate-300"}`}>
                                        หรือ ฿{cal.requiredPerYear.toLocaleString("th-TH", { maximumFractionDigits: 0 })} / ปี
                                      </div>
                                    )}
                                  </div>

                                  <div className={`p-2 rounded-xl border ${
                                    theme === "light"
                                      ? "bg-slate-50 border-slate-200/50 text-slate-700 opacity-80"
                                      : "bg-white/5 border-white/5 text-white opacity-70"
                                  }`}>
                                    <span className={`text-[8px] block ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>แผนออมเฉลี่ยเริ่มแรก:</span>
                                    <span className={`text-xs font-bold ${theme === "light" ? "text-slate-700" : "text-slate-300"}`}>
                                      ฿{cal.initialPerMonth.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className={`text-[8px] ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}> / เดือน</span>

                                    {selectedWallet.goalPeriodUnit === "year" && (
                                      <div className={`text-[9px] mt-0.5 ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                                        หรือ ฿{cal.initialPerYear.toLocaleString("th-TH", { maximumFractionDigits: 0 })} / ปี
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className={`text-xs italic font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-xl w-fit border ${
                    theme === "light"
                      ? "bg-pink-50 text-pink-700 border-pink-200"
                      : "bg-pink-500/10 text-pink-300 border-pink-500/10"
                  }`}>
                    🐷 ยังไม่ตั้งเป้าหมายเงินออม (คลิกแก้ไขเพื่อเปิด)
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Total Balance */}
              <div className={`border p-4 rounded-2xl flex items-center justify-between ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200 text-slate-800"
                  : "bg-white/5 border-white/5 text-white"
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>ยอดเงินปัจจุบัน</span>
                  <p className={`text-xl font-extrabold mt-1 ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                    ฿{balance.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${
                  theme === "light" ? "bg-slate-200 text-slate-700" : "bg-white/10 text-slate-300"
                }`}>
                  <Coins className="w-5 h-5" />
                </div>
              </div>

              {/* Inflow Stat */}
              <div className={`border p-4 rounded-2xl flex items-center justify-between ${
                theme === "light"
                  ? "bg-emerald-50/60 border-emerald-100 text-emerald-800"
                  : "bg-emerald-500/5 border border-emerald-500/10 text-white"
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === "light" ? "text-emerald-600" : "text-emerald-400"}`}>ยอดเงินเข้าสะสม (Inflow)</span>
                  <p className={`text-xl font-extrabold mt-1 ${theme === "light" ? "text-emerald-700" : "text-emerald-400"}`}>
                    +฿{walletInflowSum.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${
                  theme === "light" ? "bg-emerald-100 text-emerald-600" : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>

              {/* Outflow Stat */}
              <div className={`border p-4 rounded-2xl flex items-center justify-between ${
                theme === "light"
                  ? "bg-rose-50/60 border-rose-100 text-rose-800"
                  : "bg-rose-500/5 border border-rose-500/10 text-white"
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === "light" ? "text-rose-600" : "text-rose-400"}`}>ยอดเงินออกสะสม (Outflow)</span>
                  <p className={`text-xl font-extrabold mt-1 ${theme === "light" ? "text-rose-700" : "text-rose-400"}`}>
                    -฿{walletOutflowSum.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${
                  theme === "light" ? "bg-rose-100 text-rose-600" : "bg-rose-500/10 text-rose-400"
                }`}>
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  theme === "light" ? "text-slate-500" : "text-slate-400"
                }`}>
                  <span>📋 ประวัติการทำรายการล่าสุด ({sortedWalletTxs.length})</span>
                </h4>
              </div>

              {sortedWalletTxs.length === 0 ? (
                <div className={`text-center py-10 border border-dashed rounded-2xl ${
                  theme === "light"
                    ? "border-slate-200 bg-slate-50"
                    : "border-white/10 bg-white/5"
                }`}>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>ไม่มีประวัติการทำรายการสำหรับกระเป๋านี้</p>
                  <p className={`text-xs mt-1 ${theme === "light" ? "text-slate-400" : "text-slate-500"}`}>รายรับ รายจ่าย หรือ รายการโอนเงินที่ผูกกับกระเป๋านี้จะแสดงที่นี่</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {sortedWalletTxs.map(tx => {
                    const isTransfer = tx.type === "transfer";
                    const isIncome = tx.type === "income";
                    
                    // Determine if it's an inflow or outflow for THIS specific wallet
                    let isWalletInflow = false;
                    if (isIncome && tx.walletId === selectedWalletFlowId) {
                      isWalletInflow = true;
                    } else if (isTransfer && tx.toWalletId === selectedWalletFlowId) {
                      isWalletInflow = true;
                    }

                    return (
                      <div key={tx.id} className={`border p-3 rounded-2xl flex items-center justify-between transition-colors ${
                        theme === "light"
                          ? "bg-slate-50 hover:bg-slate-100/80 border-slate-200/60"
                          : "bg-white/5 hover:bg-white/10 border-white/5"
                      }`}>
                        <div className="flex items-center gap-3">
                          {/* Inflow / Outflow Indicator */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isWalletInflow 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {isWalletInflow ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          
                          {/* Text Info */}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-sm ${
                                theme === "light" ? "text-slate-800" : "text-white"
                              }`}>
                                {tx.merchantName}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                theme === "light"
                                  ? "bg-slate-100 text-slate-600 border-slate-200"
                                  : "bg-white/5 text-slate-300 border-white/5"
                              }`}>
                                {tx.category}
                              </span>
                            </div>
                            
                            <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${
                              theme === "light" ? "text-slate-500" : "text-slate-400"
                            }`}>
                              <span>📅 {tx.date}</span>
                              {tx.time && <span>⏰ {tx.time}</span>}
                              {tx.note && <span className="italic text-slate-500">({tx.note})</span>}
                            </div>
                          </div>
                        </div>

                        {/* Amount & Subtext & Edit/Delete controls */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-black text-sm ${isWalletInflow ? "text-emerald-500" : "text-rose-500"}`}>
                              {isWalletInflow ? "+" : "-"}฿{tx.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {isTransfer && (
                              <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-medium mt-0.5">
                                <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                                {tx.walletId === selectedWalletFlowId 
                                  ? `โอนไปยัง: ${wallets.find(w => w.id === tx.toWalletId)?.name || "กระเป๋าอื่น"}`
                                  : `โอนมาจาก: ${wallets.find(w => w.id === tx.walletId)?.name || "กระเป๋าอื่น"}`
                                }
                              </span>
                            )}
                          </div>

                          {(onEditTransaction || onDeleteTransaction) && (
                            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                              {onEditTransaction && (
                                <button
                                  type="button"
                                  onClick={() => onEditTransaction(tx)}
                                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="แก้ไขรายการนี้"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteTransaction && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`คุณต้องการลบรายการ "${tx.merchantName}" (฿${tx.amount.toLocaleString()}) ใช่หรือไม่? (ยอดเงินในกระเป๋าจะคืนกลับเข้าสู่อัตโนมัติ)`)) {
                                      onDeleteTransaction(tx.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="ลบรายการนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Guide Card */}
      <div className={`border rounded-3xl p-5 flex gap-4 ${
        theme === "light"
          ? "bg-white border-slate-200 text-slate-800"
          : "bg-white/5 border-white/10 text-white"
      }`}>
        <div className={`p-3 rounded-2xl h-fit shrink-0 ${
          theme === "light" ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/10 text-indigo-400"
        }`}>
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className={`font-bold text-sm mb-1 ${theme === "light" ? "text-slate-900" : "text-white"}`}>การทำงานร่วมกันของกระเป๋าตังและยอดรวม</h4>
          <p className={`text-xs leading-relaxed space-y-1 ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
            • ยอดเงินในแต่ละกระเป๋าจะถูกคำนวณอย่างถูกต้อง โดยดึงค่าตั้งต้น <span className="text-indigo-500 font-semibold">(Starting Balance)</span> มารวมเข้ากับ รายรับ และหักออกด้วย รายจ่าย ที่คุณผูกไว้กับกระเป๋าตังนั้น ๆ<br />
            • <span className="text-indigo-500 font-semibold">การโอนเงินข้ามบัญชี:</span> ระบบจะหักเงินจากกระเป๋าต้นทาง และโอนไปสมทบกระเป๋าปลายทางโดยอัตโนมัติ โดยไม่ถือว่าเป็นรายจ่ายภายนอกเพื่อไม่ให้กระทบยอดสุทธิรวมของแอป
          </p>
        </div>
      </div>

      {/* Wallet Form Modal (Add / Edit) */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleWalletSubmit} className="bg-[#1e293b] border border-white/15 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {editingWallet ? "✏️ แก้ไขข้อมูลกระเป๋าตัง" : "➕ เพิ่มกระเป๋าตังใหม่"}
              </span>
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">ชื่อกระเป๋าตัง</label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="เช่น เงินสดส่วนตัว, บัญชีออมทรัพย์, บัตรเครดิตหลัก"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">ประเภทกระเป๋า</label>
                  <select
                    value={walletType}
                    onChange={(e) => setWalletType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="cash" className="bg-[#1e293b]">💸 เงินสด (Cash)</option>
                    <option value="bank" className="bg-[#1e293b]">🏦 บัญชีธนาคาร (Bank)</option>
                    <option value="credit" className="bg-[#1e293b]">💳 บัตรเครดิต (Credit)</option>
                    <option value="saving" className="bg-[#1e293b]">🐷 กระปุกออมสิน (Savings Jar)</option>
                    <option value="other" className="bg-[#1e293b]">💼 อื่น ๆ (Other)</option>
                  </select>
                </div>

                {/* Account Number or Details */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    เลขบัญชี / รายละเอียด (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={walletType === "bank" ? "เช่น 123-4-56789-0" : walletType === "credit" ? "เช่น เลขท้ายบัตร 4 ตัว" : "เช่น เบอร์ TrueMoney, โน้ตย่อ"}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  💵 ทุนเงินเริ่มต้นระบบ (Starting Balance)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">฿</span>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block leading-relaxed">
                  จำนวนเงินจริงที่มีอยู่ในกระเป๋าใบนี้ ณ วันที่เปิดใช้งานระบบ เพื่อให้ผลรวมคำนวณได้อย่างเที่ยงตรง
                </span>
              </div>

              {/* Savings Goal Target Fields (Only for Saving Wallet/Piggy Bank) */}
              {walletType === "saving" && (
                <div className="bg-pink-500/5 border border-pink-500/10 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
                    <span>🐷 ตั้งเป้าหมายออมเงินสำหรับกระปุกนี้</span>
                  </div>
                  
                  {/* Goal and Duration Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        เป้าหมายเงินออม (บาท)
                      </label>
                      <input
                        type="number"
                        value={walletTargetAmount}
                        onChange={(e) => setWalletTargetAmount(e.target.value)}
                        placeholder="เช่น 12000 หรือ 120000"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-xs font-semibold"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          ระยะเวลา
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={goalPeriodValue}
                          onChange={(e) => setGoalPeriodValue(e.target.value)}
                          className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          หน่วย
                        </label>
                        <select
                          value={goalPeriodUnit}
                          onChange={(e) => setGoalPeriodUnit(e.target.value as any)}
                          className="w-full px-1 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-xs font-semibold cursor-pointer"
                        >
                          <option value="year">ปี</option>
                          <option value="month">เดือน</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Date and Exclude Total */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        วันที่เป้าหมาย (คำนวณให้อัตโนมัติ)
                      </label>
                      <input
                        type="date"
                        value={walletDueDate}
                        onChange={(e) => setWalletDueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-xs font-semibold cursor-pointer"
                      />
                    </div>
                    
                    {/* Hide Balance Toggle */}
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer select-none pb-1">
                        <input
                          type="checkbox"
                          checked={excludeFromTotal}
                          onChange={(e) => setExcludeFromTotal(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 text-pink-600 focus:ring-pink-500 bg-white/5 cursor-pointer animate-pulse"
                        />
                        <div className="leading-tight">
                          <span className="text-[10px] font-bold text-pink-300 block">🔒 ซ่อนยอดเงินนี้</span>
                          <span className="text-[8px] text-slate-400 block">ไม่รวมในเงินรวมกระเป๋า</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Real-time split preview if target amount is input */}
                  {walletTargetAmount && parseFloat(walletTargetAmount) > 0 && (
                    <div className="bg-white/5 p-2.5 rounded-xl text-[10px] text-pink-200 border border-white/5 space-y-0.5 mt-1 leading-normal">
                      <span className="font-extrabold block text-pink-300">📊 แผนคำนวณเป้าหมายออมเงิน:</span>
                      <div>• เป้าหมายทั้งหมด: <span className="font-semibold text-white">฿{parseFloat(walletTargetAmount).toLocaleString()}</span> ในระยะเวลา <span className="font-semibold text-white">{goalPeriodValue} {goalPeriodUnit === 'year' ? 'ปี' : 'เดือน'}</span></div>
                      <div>
                        • ออมเฉลี่ย: <span className="font-bold text-emerald-400">฿{(goalPeriodUnit === 'year' ? (parseFloat(walletTargetAmount) / (parseInt(goalPeriodValue, 10) * 12)) : (parseFloat(walletTargetAmount) / parseInt(goalPeriodValue, 10))).toLocaleString("th-TH", {maximumFractionDigits: 1})} ต่อเดือน</span>
                        {goalPeriodUnit === 'year' && (
                          <span> หรือ <span className="font-bold text-emerald-400">฿{(parseFloat(walletTargetAmount) / parseInt(goalPeriodValue, 10)).toLocaleString("th-TH", {maximumFractionDigits: 1})} ต่อปี</span></span>
                        )}
                      </div>
                      <span className="text-[8px] text-slate-400 italic block mt-1 leading-normal">*ระบบจะแบ่งยอดด้วย "ยอดที่เหลือ หาร ระยะเวลาที่เหลือ" จริงแบบเรียลไทม์เพื่อให้คุณเห็นจำนวนเงินเป้าหมายออมที่ปรับเปลี่ยนตามจริงด้วย!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Icon selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">เลือกสัญลักษณ์การ์ด</label>
                <div className="flex gap-2 overflow-x-auto pb-1.5 select-none">
                  {WALLET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setWalletIcon(emoji)}
                      className={`text-xl p-2.5 rounded-xl border transition-all ${
                        walletIcon === emoji 
                          ? "bg-indigo-600/20 border-indigo-500 scale-110" 
                          : "bg-white/5 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

               {/* Color style selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">เลือกโทนสี / ลวดลายกระเป๋า</label>
                <div className="grid grid-cols-3 gap-2">
                  {WALLET_COLORS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setWalletColor(col.value)}
                      className={`h-8 rounded-xl border text-[10px] font-bold text-white flex items-center justify-center transition-all ${col.value} ${
                        walletColor === col.value ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#1e293b]" : ""
                      }`}
                    >
                      {col.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Wallet Checkbox */}
              <div className="pt-3 border-t border-white/10">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#1e293b] bg-white/5 cursor-pointer mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">ตั้งเป็นกระเป๋าเงินหลัก (ค่าเริ่มต้น)</span>
                    <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">เมื่อเปิดเมนูบันทึกรายการใหม่ ระบบจะเลือกกระเป๋าเงินใบนี้ให้โดยอัตโนมัติ</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2 bg-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(false)}
                className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/15 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {editingWallet ? "บันทึกแก้ไข" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal (Money movement) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleTransferSubmit} className="bg-[#1e293b] border border-white/15 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                ย้ายเงินระหว่างบัญชี / กระเป๋าตัง
              </span>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* From -> To */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">กระเป๋าต้นทาง</label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="w-full bg-transparent text-white font-bold text-sm focus:outline-hidden cursor-pointer"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1e293b] text-white">
                        {w.icon} {w.name} (฿{(walletBalances[w.id] ?? 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2 bg-white/10 rounded-full text-indigo-400 border border-white/10">
                  <ArrowRight className="w-4 h-4 animate-pulse" />
                </div>

                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">กระเป๋าปลายทาง</label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="w-full bg-transparent text-white font-bold text-sm focus:outline-hidden cursor-pointer"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1e293b] text-white">
                        {w.icon} {w.name} (฿{(walletBalances[w.id] ?? 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">จำนวนเงินที่ต้องการย้าย</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 font-extrabold">฿</span>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-base font-extrabold"
                    required
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">บันทึกเพิ่มเติม (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="เช่น ถอนเงินสดจากตู้ ATM, โอนไปเข้าบัญชีเก็บออม"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">วันที่ย้ายเงิน</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2 bg-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/15 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                ยืนยันการโอนเงิน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
