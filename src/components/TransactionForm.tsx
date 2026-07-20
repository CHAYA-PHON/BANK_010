import { useState, useEffect, FormEvent } from "react";
import { CATEGORIES, Transaction, TransactionType, Wallet, Debt } from "../types";
import { Plus, Check, ImageIcon, X, HelpCircle, Calendar, DollarSign, Edit, ArrowRightLeft, Calculator, Delete } from "lucide-react";

interface TransactionFormProps {
  initialData?: Partial<Transaction> | null;
  onSave: (data: Omit<Transaction, "id" | "createdAt">) => void;
  onCancel?: () => void;
  isEditMode?: boolean;
  wallets: Wallet[];
  walletBalances?: Record<string, number>;
  debts?: Debt[];
  expenseHistoryNames?: string[];
  incomeHistoryNames?: string[];
}

export default function TransactionForm({
  initialData,
  onSave,
  onCancel,
  isEditMode = false,
  wallets,
  walletBalances,
  debts = [],
  expenseHistoryNames = [],
  incomeHistoryNames = [],
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("อื่นๆ");
  const [merchantName, setMerchantName] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [toWalletId, setToWalletId] = useState<string>("");
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");

  // Calculator states
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [calcExpression, setCalcExpression] = useState<string>("");
  const [calcResult, setCalcResult] = useState<string>("");

  const evaluateExpression = (expr: string): number | null => {
    try {
      // Allow only safe characters: digits, decimal point, operators, parentheses, space
      const sanitized = expr.replace(/[^0-9+\-*/(). ]/g, "");
      if (!sanitized.trim()) return null;
      
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return Number(result.toFixed(2));
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const evaluateRealTime = (expr: string) => {
    const res = evaluateExpression(expr);
    if (res !== null) {
      setCalcResult(res.toString());
    } else {
      setCalcResult("");
    }
  };

  const handleCalcKeyPress = (key: string) => {
    if (key === "C") {
      setCalcExpression("");
      setCalcResult("");
    } else if (key === "DEL") {
      // If ends with spaces (operator), delete more
      let nextExpr = calcExpression;
      if (nextExpr.endsWith(" ")) {
        nextExpr = nextExpr.trim().slice(0, -1).trim();
      } else {
        nextExpr = nextExpr.slice(0, -1);
      }
      setCalcExpression(nextExpr);
      evaluateRealTime(nextExpr);
    } else if (key === "=") {
      const res = evaluateExpression(calcExpression);
      if (res !== null) {
        setCalcExpression(res.toString());
        setCalcResult(res.toString());
      }
    } else {
      let char = key;
      if (["+", "-", "*", "/"].includes(key)) {
        char = ` ${key} `;
      }
      const nextExpr = calcExpression + char;
      setCalcExpression(nextExpr);
      evaluateRealTime(nextExpr);
    }
  };

  const applyCalcValue = () => {
    const finalVal = calcResult || evaluateExpression(calcExpression)?.toString() || calcExpression;
    if (finalVal && !isNaN(Number(finalVal))) {
      setAmount(finalVal);
      setShowCalculator(false);
    } else {
      const evaluated = evaluateExpression(calcExpression);
      if (evaluated !== null) {
        setAmount(evaluated.toString());
        setShowCalculator(false);
      }
    }
  };

  // Sync with initial data (especially when scanning a slip)
  useEffect(() => {
    // Default wallet selector to isDefault wallet, or first wallet if available
    const foundDefaultWallet = wallets.find(w => w.isDefault);
    const defaultWalletId = foundDefaultWallet ? foundDefaultWallet.id : (wallets.length > 0 ? wallets[0].id : "");
    const remainingWallets = wallets.filter(w => w.id !== defaultWalletId);
    const defaultToWalletId = remainingWallets.length > 0 ? remainingWallets[0].id : (wallets.length > 1 ? wallets[1].id : "");

    if (initialData) {
      setType(initialData.type || "expense");
      setAmount(initialData.amount ? initialData.amount.toString() : "");
      setCategory(initialData.category || "อื่นๆ");
      setMerchantName(initialData.merchantName || "");
      setDate(initialData.date || new Date().toISOString().split("T")[0]);
      setTime(initialData.time || "");
      setNote(initialData.note || "");
      setImageUrl(initialData.imageUrl || "");
      setWalletId(initialData.walletId || defaultWalletId);
      setToWalletId(initialData.toWalletId || defaultToWalletId);
      setSelectedDebtId(initialData.debtId || "");
    } else {
      setType("expense");
      setAmount("");
      setCategory("อาหารและเครื่องดื่ม");
      setMerchantName("");
      setDate(new Date().toISOString().split("T")[0]);
      setTime(new Date().toTimeString().slice(0, 5));
      setNote("");
      setImageUrl("");
      setWalletId(defaultWalletId);
      setToWalletId(defaultToWalletId);
      setSelectedDebtId("");
    }
  }, [initialData, wallets]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      alert("กรุณาระบุจำนวนเงินที่มากกว่า 0");
      return;
    }
    if (type === "transfer" && walletId === toWalletId) {
      alert("บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน");
      return;
    }
    if (!date) {
      alert("กรุณาระบุวันที่ทำรายการ");
      return;
    }

    const parsedAmount = parseFloat(amount);
    
    // Negative balance protection check
    if (walletBalances && (type === "expense" || type === "transfer")) {
      const currentBalance = walletBalances[walletId] || 0;
      let availableBalance = currentBalance;
      
      // If we are editing, we can offset by the original transaction's amount if it was on the same wallet
      if (isEditMode && initialData && initialData.walletId === walletId) {
        if (initialData.type === "expense" || initialData.type === "transfer") {
          availableBalance += initialData.amount || 0;
        }
      }
      
      if (parsedAmount > availableBalance) {
        alert(`❌ ระบบป้องกันยอดคงเหลือติดลบทำงาน!\n\nยอดคงเหลือในกระเป๋าไม่เพียงพอสําหรับการจ่ายเงินครั้งนี้\nยอดคงเหลือในปัจจุบัน: ${availableBalance.toLocaleString()} บาท\nจำนวนเงินที่พยายามหักออก: ${parsedAmount.toLocaleString()} บาท`);
        return;
      }
    }

    let finalMerchantName = merchantName.trim();
    let finalCategory = category;

    if (type !== "transfer" && !finalMerchantName) {
      finalMerchantName = category;
    }

    if (type === "transfer") {
      const fromWName = wallets.find(w => w.id === walletId)?.name || "ต้นทาง";
      const toWName = wallets.find(w => w.id === toWalletId)?.name || "ปลายทาง";
      finalMerchantName = `โอนเงินจาก ${fromWName} ไปยัง ${toWName}`;
      finalCategory = "โอนเงินระหว่างกระเป๋า";
    }

    onSave({
      type,
      amount: parseFloat(amount),
      category: finalCategory,
      merchantName: finalMerchantName,
      date,
      time: time || undefined,
      note: note.trim() || undefined,
      imageUrl: imageUrl || undefined,
      walletId: walletId || undefined,
      toWalletId: type === "transfer" ? toWalletId : undefined,
      debtId: (finalCategory === "ชำระหนี้" && selectedDebtId) ? selectedDebtId : undefined,
    });

    // Reset if it's not pre-filled/editing
    if (!initialData) {
      setAmount("");
      setMerchantName("");
      setNote("");
      setSelectedDebtId("");
    }
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    // Auto switch default category depending on type
    if (newType === "income") {
      setCategory("เงินเดือนและรายได้");
    } else if (newType === "expense") {
      setCategory("อาหารและเครื่องดื่ม");
    } else {
      setCategory("โอนเงินระหว่างกระเป๋า");
    }
  };

  return (
    <form id="transaction-form" onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <h3 className="font-semibold text-white text-base flex items-center gap-2">
          {imageUrl ? "🔍 ตรวจสอบข้อมูลจาก AI" : isEditMode ? "✏️ แก้ไขรายการ" : "➕ บันทึกรายการใหม่"}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {imageUrl && (
        <div id="ai-review-banner" className="mb-4 p-3 bg-indigo-500/10 text-indigo-200 border border-indigo-500/20 rounded-xl text-xs flex gap-2">
          <span>💡</span>
          <p>
            AI ได้กรอกข้อมูลให้คุณแล้วโดยการสแกนรูปภาพ กรุณาตรวจสอบข้อมูลและบันทึก เพื่อความถูกต้อง
          </p>
        </div>
      )}

      {/* Transaction Type Tabs */}
      <div className="grid grid-cols-3 gap-1.5 mb-4 bg-white/5 p-1 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => handleTypeChange("expense")}
          className={`py-2 px-1 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
            type === "expense"
              ? "bg-rose-500 text-white shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          💸 รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange("income")}
          className={`py-2 px-1 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
            type === "income"
              ? "bg-emerald-500 text-white shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          💰 รายรับ
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange("transfer")}
          className={`py-2 px-1 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
            type === "transfer"
              ? "bg-indigo-500 text-white shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          🔄 โอนเงิน
        </button>
      </div>

      <div className="space-y-4">
        {/* Scanned Image Preview if any */}
        {imageUrl && (
          <div id="scanned-image-preview" className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/5 h-32 flex items-center justify-center">
            <img src={imageUrl} alt="Receipt Preview" className="h-full object-contain" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold">รูปภาพที่วิเคราะห์</span>
            </div>
          </div>
        )}

        {/* Amount input with Calculator integration */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-400">จำนวนเงิน (THB)</label>
            <button
              type="button"
              onClick={() => {
                setShowCalculator(!showCalculator);
                if (!showCalculator) {
                  setCalcExpression(amount || "");
                  setCalcResult(amount || "");
                }
              }}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                showCalculator
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                  : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Calculator className="w-3 h-3" />
              {showCalculator ? "ปิดเครื่องคิดเลข" : "เปิดเครื่องคิดเลข"}
            </button>
          </div>
          
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">฿</span>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-12 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-base font-semibold text-white"
              required
            />
            {/* Direct quick-calc trigger icon inside input */}
            <button
              type="button"
              onClick={() => {
                setShowCalculator(!showCalculator);
                if (!showCalculator) {
                  setCalcExpression(amount || "");
                  setCalcResult(amount || "");
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="เครื่องคิดเลข"
            >
              <Calculator className="w-4 h-4" />
            </button>
          </div>

          {/* Calculator Popover Dropdown */}
          {showCalculator && (
            <div className="absolute left-0 right-0 mt-2 z-50 p-4 bg-[#121826] border border-white/10 rounded-2xl shadow-2xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  🧮 คำนวณจำนวนเงิน
                </span>
                <button
                  type="button"
                  onClick={() => setShowCalculator(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Calculator Screen */}
              <div className="bg-[#090d16]/80 border border-white/5 rounded-xl p-3 text-right space-y-1">
                <div className="text-slate-400 text-xs font-semibold overflow-x-auto whitespace-nowrap min-h-[16px] font-mono">
                  {calcExpression || "0"}
                </div>
                <div className="text-white text-lg font-black font-mono">
                  ฿ {calcResult ? Number(calcResult).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                </div>
              </div>

              {/* Keypad Grid */}
              <div className="grid grid-cols-4 gap-2">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("C")}
                  className="py-2.5 text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("(")}
                  className="py-2.5 text-sm font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  (
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress(")")}
                  className="py-2.5 text-sm font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  )
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("/")}
                  className="py-2.5 text-sm font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("7")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("8")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("9")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("*")}
                  className="py-2.5 text-sm font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
                >
                  ×
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("4")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("5")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("6")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("-")}
                  className="py-2.5 text-sm font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
                >
                  -
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("1")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("2")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("3")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("+")}
                  className="py-2.5 text-sm font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("0")}
                  className="py-2.5 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress(".")}
                  className="py-2.5 text-sm font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("DEL")}
                  className="py-2.5 text-xs font-bold bg-rose-500/5 text-rose-300 border border-rose-500/10 rounded-xl hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="ลบหลักหน่วย"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcKeyPress("=")}
                  className="py-2.5 text-sm font-black bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-all cursor-pointer shadow-md"
                >
                  =
                </button>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setCalcExpression("");
                    setCalcResult("");
                    setShowCalculator(false);
                  }}
                  className="py-2 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={applyCalcValue}
                  className="py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  ยืนยันนำค่าไปใช้
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Selectors */}
        {wallets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                {type === "transfer" ? "โอนจากกระเป๋า" : "กระเป๋าตัง / บัญชีที่จ่าย/รับ"}
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden text-xs font-semibold cursor-pointer"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#1e293b] text-white">
                    {w.icon} {w.name}
                  </option>
                ))}
              </select>
            </div>

            {type === "transfer" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">โอนเข้ากระเป๋า</label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden text-xs font-semibold cursor-pointer"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#1e293b] text-white">
                      {w.icon} {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Category list (Hidden during transfer) */}
        {type !== "transfer" && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">หมวดหมู่</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm cursor-pointer"
            >
              {Object.keys(CATEGORIES).map((catName) => (
                <option key={catName} value={catName} className="bg-[#1e293b] text-white">
                  {catName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Debt Selector for "ชำระหนี้" category */}
        {type !== "transfer" && category === "ชำระหนี้" && (
          <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-rose-300">
              {type === "expense" ? "🔗 เลือกรายการหนี้ที่ต้องการชำระคืน" : "🔗 เลือกรายการหนี้ที่รับชำระคืน"}
            </label>
            {debts.filter(d => {
              if (type === "expense") return d.type === "borrowed" && d.status === "active";
              if (type === "income") return d.type === "lent" && d.status === "active";
              return false;
            }).length > 0 ? (
              <div>
                <select
                  value={selectedDebtId}
                  onChange={(e) => {
                    const dId = e.target.value;
                    setSelectedDebtId(dId);
                    // Automatically pre-fill the merchantName and remaining amount if empty
                    const targetDebt = debts.find(d => d.id === dId);
                    if (targetDebt) {
                      if (type === "expense") {
                        setMerchantName(`ชำระหนี้คืนแก่ ${targetDebt.creditorDebtorName}`);
                        if (!amount) setAmount(targetDebt.remainingAmount.toString());
                      } else {
                        setMerchantName(`รับชำระหนี้คืนจาก ${targetDebt.creditorDebtorName}`);
                        if (!amount) setAmount(targetDebt.remainingAmount.toString());
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#1e293b] border border-rose-500/30 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm cursor-pointer font-medium"
                  required
                >
                  <option value="" className="text-slate-400">-- เลือกหนี้สินที่ต้องการชำระ --</option>
                  {debts
                    .filter(d => {
                      if (type === "expense") return d.type === "borrowed" && d.status === "active";
                      if (type === "income") return d.type === "lent" && d.status === "active";
                      return false;
                    })
                    .map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#1e293b] text-white">
                        {d.creditorDebtorName} (ยอดค้างชำระ: ฿{d.remainingAmount.toLocaleString()})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 ยอดชำระเงินนี้จะถูกนำไปหักลดจากหนี้สินคงค้างโดยอัตโนมัติเมื่อบันทึกรายการ
                </p>
              </div>
            ) : (
              <div className="text-xs text-rose-300/80 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                ⚠️ ไม่พบรายการหนี้สินที่ต้อง {type === "expense" ? "ชำระคืน" : "รับชำระคืน"} ในระบบขณะนี้
                <p className="text-[10px] text-slate-400 mt-1">
                  คุณสามารถเพิ่มรายการหนี้สินได้ในแถบ "หนี้สินและกู้ยืม"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Merchant / Receiver Name (Hidden during transfer) */}
        {type !== "transfer" && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {type === "expense" ? "ร้านค้า / ผู้รับเงิน" : "ผู้โอนเงิน / แหล่งที่มา"}
            </label>
            <input
              type="text"
              list="merchant-autocomplete"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder={type === "expense" ? "เช่น เซเว่น, BTS, เติมน้ำมัน (เว้นว่าง = ใช้ชื่อหมวดหมู่)" : "เช่น เงินเดือน, งานเสริม, โอนคืน (เว้นว่าง = ใช้ชื่อหมวดหมู่)"}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
            />
            <datalist id="merchant-autocomplete">
              {(type === "expense" ? expenseHistoryNames : incomeHistoryNames).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">วันที่</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm cursor-pointer"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">เวลา (ไม่บังคับ)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm cursor-pointer"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">บันทึกเพิ่มเติม (ไม่บังคับ)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="รายละเอียดการใช้จ่าย..."
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/15 text-slate-300 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="submit"
            className="flex-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-1 shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {isEditMode ? "อัปเดตรายการ" : "บันทึกรายการ"}
          </button>
        </div>
      </div>
    </form>
  );
}
