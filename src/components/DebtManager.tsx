import { useState, useMemo, FormEvent } from "react";
import { Debt, DebtPayment, Wallet } from "../types";
import { 
  Plus, Check, Trash2, Calendar, User, Clock, 
  ArrowRight, Landmark, FileText, ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";

interface DebtManagerProps {
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  debts: Debt[];
  debtPayments: DebtPayment[];
  onAddDebt: (debt: Debt, initialWalletId?: string) => Promise<void> | void;
  onAddDebtPayment: (payment: DebtPayment, paidAmount: number) => Promise<void> | void;
  onDeleteDebt: (debtId: string) => Promise<void> | void;
}

export default function DebtManager({
  wallets,
  walletBalances,
  debts,
  debtPayments,
  onAddDebt,
  onAddDebtPayment,
  onDeleteDebt,
}: DebtManagerProps) {
  // Tabs and Forms states
  const [activeSubTab, setActiveSubTab] = useState<"active" | "paid">("active");
  const [filterType, setFilterType] = useState<"all" | "borrowed" | "lent">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New Debt form fields
  const [type, setType] = useState<"borrowed" | "lent">("borrowed");
  const [creditorDebtorName, setCreditorDebtorName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkToWallet, setLinkToWallet] = useState(false);
  const [walletId, setWalletId] = useState("");

  // Payment popup/form states
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentWalletId, setPaymentWalletId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");

  // Expanded debt details (to see payment history)
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  // Set default wallet selections
  useMemo(() => {
    if (wallets.length > 0) {
      if (!walletId) setWalletId(wallets[0].id);
      if (!paymentWalletId) setPaymentWalletId(wallets[0].id);
    }
  }, [wallets, walletId, paymentWalletId]);

  // Calculations for Summary
  const totalBorrowed = useMemo(() => {
    return debts
      .filter(d => d.type === "borrowed" && d.status === "active")
      .reduce((sum, d) => sum + d.remainingAmount, 0);
  }, [debts]);

  const totalLent = useMemo(() => {
    return debts
      .filter(d => d.type === "lent" && d.status === "active")
      .reduce((sum, d) => sum + d.remainingAmount, 0);
  }, [debts]);

  // Filtering Debts list
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      const matchStatus = d.status === activeSubTab;
      const matchType = filterType === "all" || d.type === filterType;
      return matchStatus && matchType;
    });
  }, [debts, activeSubTab, filterType]);

  const handleCreateDebt = async (e: FormEvent) => {
    e.preventDefault();

    if (!creditorDebtorName.trim()) {
      alert("กรุณาระบุชื่อเจ้าหนี้ หรือ ลูกหนี้");
      return;
    }
    const debtAmount = parseFloat(amount);
    if (isNaN(debtAmount) || debtAmount <= 0) {
      alert("กรุณาระบุจำนวนเงินกู้ยืมที่มากกว่า 0");
      return;
    }

    if (linkToWallet && !walletId) {
      alert("กรุณาเลือกกระเป๋าเงินเพื่อผูกรายการ");
      return;
    }

    // If linking to wallet and the type is lent (lending money), check if balance is sufficient
    if (linkToWallet && type === "lent") {
      const balance = walletBalances[walletId] ?? 0;
      const targetW = wallets.find(w => w.id === walletId);
      if (targetW && targetW.type !== "credit" && balance < debtAmount) {
        alert(`⚠️ ไม่สามารถให้กู้ยืมได้เนื่องจาก "ยอดคงเหลือในกระเป๋าไม่เพียงพอ"!\n\nยอดเงินปัจจุบัน: ฿${balance.toLocaleString()}\nยอดที่ต้องการให้กู้ยืม: ฿${debtAmount.toLocaleString()}`);
        return;
      }
    }

    const newDebt: Debt = {
      id: "debt-" + Date.now(),
      type,
      creditorDebtorName: creditorDebtorName.trim(),
      amount: debtAmount,
      remainingAmount: debtAmount,
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await onAddDebt(newDebt, linkToWallet ? walletId : undefined);

    // Reset Form
    setCreditorDebtorName("");
    setAmount("");
    setDescription("");
    setDueDate("");
    setLinkToWallet(false);
    setShowAddForm(false);
  };

  const handlePaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payingDebtId) return;

    const targetDebt = debts.find(d => d.id === payingDebtId);
    if (!targetDebt) return;

    const payAmt = parseFloat(paymentAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      alert("กรุณากรอกจำนวนเงินชำระหนี้ที่มากกว่า 0");
      return;
    }

    if (payAmt > targetDebt.remainingAmount) {
      alert(`⚠️ จำนวนเงินชำระหนี้สูงกว่ายอดหนี้คงค้างคงเหลือ (ยอดคงค้างคงเหลือ: ฿${targetDebt.remainingAmount.toLocaleString()})`);
      return;
    }

    if (!paymentWalletId) {
      alert("กรุณาเลือกกระเป๋าเงินสำหรับทำรายการ");
      return;
    }

    // Check if wallet balance is sufficient for repaying borrowed debt (paying money out)
    if (targetDebt.type === "borrowed") {
      const balance = walletBalances[paymentWalletId] ?? 0;
      const targetW = wallets.find(w => w.id === paymentWalletId);
      if (targetW && targetW.type !== "credit" && balance < payAmt) {
        alert(`⚠️ ไม่สามารถชำระหนี้ได้เนื่องจาก "ยอดคงเหลือในกระเป๋าไม่เพียงพอ"!\n\nกระเป๋าเงิน: ${targetW.name}\nยอดคงเหลือในปัจจุบัน: ฿${balance.toLocaleString()}\nยอดที่ต้องการชำระคืน: ฿${payAmt.toLocaleString()}`);
        return;
      }
    }

    const newPayment: DebtPayment = {
      id: "pay-" + Date.now(),
      debtId: payingDebtId,
      amount: payAmt,
      walletId: paymentWalletId,
      date: paymentDate,
      note: paymentNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await onAddDebtPayment(newPayment, payAmt);

    // Reset payment pop-up states
    setPayingDebtId(null);
    setPaymentAmount("");
    setPaymentNote("");
  };

  const selectDebtForRepayment = (debt: Debt) => {
    setPayingDebtId(debt.id);
    setPaymentAmount(debt.remainingAmount.toString());
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentNote("");
    if (wallets.length > 0) {
      setPaymentWalletId(wallets[0].id);
    }
  };

  const getDaysRemaining = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div id="debt-manager-container" className="space-y-6">
      {/* 1. Debt Dashboard Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div id="summary-borrowed-card" className="bg-gradient-to-br from-rose-500/10 via-rose-600/5 to-transparent border border-rose-500/10 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 p-2 bg-rose-500/10 rounded-xl text-rose-400">
            <Landmark className="w-5 h-5" />
          </div>
          <span className="text-[10px] text-rose-300 font-bold uppercase tracking-widest block mb-1">🔴 ยอดรวมหนี้ที่เราค้างเขา (Borrowed)</span>
          <h4 className="text-2xl font-extrabold text-rose-400">
            ฿{totalBorrowed.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">ยอดหนี้สินทั้งหมดที่คุณยืมมาและยังค้างชำระอยู่</p>
        </div>

        <div id="summary-lent-card" className="bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/10 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <User className="w-5 h-5" />
          </div>
          <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest block mb-1">🟢 ยอดรวมหนี้ที่เขาค้างเรา (Lent)</span>
          <h4 className="text-2xl font-extrabold text-emerald-400">
            ฿{totalLent.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">ยอดรวมเงินที่คุณให้ยืมไป และลูกหนี้ยังคงค้างชำระอยู่</p>
        </div>

        <div id="summary-net-card" className="bg-gradient-to-br from-indigo-500/10 via-indigo-600/5 to-transparent border border-indigo-500/10 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest block mb-1">🔵 ดุลยภาพหนี้สินสุทธิ (Net Debt)</span>
          <h4 className={`text-2xl font-extrabold ${(totalLent - totalBorrowed) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            { (totalLent - totalBorrowed) >= 0 ? '+' : '' }฿{(totalLent - totalBorrowed).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">หักล้างหนี้สินและลูกหนี้ทั้งหมด (บวกคือรับมากกว่าจ่าย)</p>
        </div>
      </div>

      {/* 2. Management Controls Line */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("active")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "active" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            📋 หนี้สินที่ค้างอยู่ (Active)
          </button>
          <button
            onClick={() => setActiveSubTab("paid")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "paid" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            ✅ ชำระหมดแล้ว (Completed)
          </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-[#121826] border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-hidden"
          >
            <option value="all">ทั้งหมด (All Types)</option>
            <option value="borrowed">เราติดหนี้เขา (Borrowed)</option>
            <option value="lent">เขาค้างเงินเรา (Lent)</option>
          </select>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 sm:flex-initial py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างรายการหนี้ใหม่
          </button>
        </div>
      </div>

      {/* 3. collapsible Add Debt Form */}
      {showAddForm && (
        <form id="add-debt-form" onSubmit={handleCreateDebt} className="bg-white/5 border border-white/10 p-6 rounded-3xl shadow-lg space-y-4 animate-fade-in">
          <h3 className="font-extrabold text-white text-sm pb-2 border-b border-white/10 flex items-center gap-2">
            📂 บันทึกสัญญาเงินกู้ยืม / หนี้สินใหม่
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Debt type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">ประเภทสัญญา</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setType("borrowed")}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    type === "borrowed" ? "bg-rose-500 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🔴 เรายืมเขา ( borrowed )
                </button>
                <button
                  type="button"
                  onClick={() => setType("lent")}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    type === "lent" ? "bg-emerald-500 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🟢 เขาเสนอ/ยืมเรา ( lent )
                </button>
              </div>
            </div>

            {/* creditorDebtorName */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {type === "borrowed" ? "👤 ชื่อเจ้าหนี้ (บุคคล/ธนาคาร)" : "👤 ชื่อลูกหนี้"}
              </label>
              <input
                type="text"
                value={creditorDebtorName}
                onChange={(e) => setCreditorDebtorName(e.target.value)}
                placeholder={type === "borrowed" ? "เช่น น้าสมชาย, ธนาคารกสิกร" : "เช่น เพื่อนรักอั้ม, สมยศ"}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden text-xs"
                required
              />
            </div>

            {/* amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">จำนวนเงินกู้ยืม (THB)</label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden text-xs font-semibold"
                required
              />
            </div>

            {/* dueDate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">📅 วันครบกำหนดชำระ (ไม่บังคับ)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#121826] border border-white/10 rounded-xl text-white text-xs cursor-pointer focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description note */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">บันทึกรายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เช่น ยืมมาทำทุนการค้าขาย, ซื้ออุปกรณ์"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden text-xs"
            />
          </div>

          {/* Auto transaction linking toggle */}
          <div className="bg-[#121826] p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-white block">🔗 เชื่อมโยงกระเป๋าตังอัตโนมัติ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">ระบบจะบันทึกรายการรายรับ/รายจ่ายในกระเป๋าของคุณเมื่อเริ่มต้นสัญญานี้</span>
              </div>
              <input
                type="checkbox"
                checked={linkToWallet}
                onChange={(e) => setLinkToWallet(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-white/5 border-white/10 rounded-xs focus:ring-indigo-500 focus:ring-2 cursor-pointer"
              />
            </div>

            {linkToWallet && wallets.length > 0 && (
              <div className="pt-2 animate-fade-in">
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
                  {type === "borrowed" ? "กระเป๋าที่รับเงินกู้ (รายรับ)" : "กระเป๋าที่ใช้จ่ายเงินให้ยืม (รายจ่าย)"}
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon} {w.name} (คงเหลือ: ฿{(walletBalances[w.id] ?? 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="py-2 px-4 bg-white/10 hover:bg-white/15 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              บันทึกสัญญาหนี้สิน
            </button>
          </div>
        </form>
      )}

      {/* 4. Active debt payment panel */}
      {payingDebtId && (
        <form id="repay-debt-form" onSubmit={handlePaySubmit} className="bg-[#121826] border border-indigo-500/30 p-6 rounded-3xl shadow-xl space-y-4 animate-scale-up">
          <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
              <span>💳 บันทึกชำระหนี้ / รับคืนเงินกู้</span>
              <span className="text-xs font-normal text-slate-400">
                (เจ้าหนี้/ลูกหนี้: {debts.find(d => d.id === payingDebtId)?.creditorDebtorName})
              </span>
            </h3>
            <button 
              type="button" 
              onClick={() => setPayingDebtId(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ปิด [X]
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">ยอดเงินที่ชำระ (THB)</label>
              <input
                type="number"
                step="any"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden text-xs font-semibold"
                required
              />
              <span className="text-[10px] text-indigo-400 mt-1 block">
                ค้างทั้งหมด: ฿{debts.find(d => d.id === payingDebtId)?.remainingAmount.toLocaleString("th-TH")}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">กระเป๋าเงินที่ใช้</label>
              <select
                value={paymentWalletId}
                onChange={(e) => setPaymentWalletId(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
                required
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name} (฿{(walletBalances[w.id] ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">วันที่ชำระ</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden text-xs cursor-pointer"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">หมายเหตุ / บันทึกเพิ่มเติม</label>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="ระบุเพิ่มเติม เช่น ชำระงวดแรก, ดอกเบี้ย"
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-hidden text-xs"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setPayingDebtId(null)}
              className="py-1.5 px-4 bg-white/10 hover:bg-white/15 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              ยืนยันการชำระเงิน
            </button>
          </div>
        </form>
      )}

      {/* 5. Debts List Grid */}
      {filteredDebts.length === 0 ? (
        <div className="bg-white/5 border border-white/5 rounded-3xl p-12 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <p className="font-extrabold text-white text-sm">ไม่พบรายการหนี้สินในระบบตามที่คุณเลือก</p>
          <p className="text-xs text-slate-500 mt-1">คุณสามารถสร้างสัญญาหนี้สินใหม่เพื่อเริ่มบันทึกประวัติหนี้สินหรือการกู้ยืมเงิน</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDebts.map((debt) => {
            const isBorrowed = debt.type === "borrowed";
            const paidPct = Math.round(((debt.amount - debt.remainingAmount) / debt.amount) * 100);
            const daysRemaining = getDaysRemaining(debt.dueDate);
            const relatedPayments = debtPayments.filter(p => p.debtId === debt.id);

            return (
              <div 
                key={debt.id} 
                className={`bg-white/5 border rounded-3xl p-5 shadow-sm space-y-4 relative transition-all duration-200 ${
                  isBorrowed ? 'border-rose-500/10 hover:border-rose-500/20' : 'border-emerald-500/10 hover:border-emerald-500/20'
                }`}
              >
                {/* Top card details */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                        isBorrowed ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {isBorrowed ? "🔴 หนี้ที่เราต้องจ่ายคืน" : "🟢 หนี้ที่เขาต้องจ่ายเรา"}
                      </span>
                      {debt.dueDate && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold flex items-center gap-1 ${
                          daysRemaining !== null && daysRemaining <= 0 
                            ? 'bg-rose-500/20 text-rose-300' 
                            : daysRemaining !== null && daysRemaining <= 7
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/5 text-slate-400'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          {daysRemaining !== null 
                            ? (daysRemaining <= 0 ? "เกินกำหนดชำระ" : `ครบกำหนดใน ${daysRemaining} วัน`)
                            : `ครบกำหนด ${debt.dueDate}`
                          }
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-white">{debt.creditorDebtorName}</h4>
                    {debt.description && (
                      <p className="text-[11px] text-slate-400">{debt.description}</p>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteDebt(debt.id)}
                    className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="ลบสัญญานี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mid card: balances and stats */}
                <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">ยอดค้างชำระคงเหลือ</span>
                    <span className={`text-base font-extrabold ${isBorrowed ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ฿{debt.remainingAmount.toLocaleString("th-TH")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">ยอดกู้เริ่มแรก</span>
                    <span className="text-xs font-bold text-slate-300">
                      ฿{debt.amount.toLocaleString("th-TH")}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>ชำระแล้ว {paidPct}%</span>
                    <span>฿{(debt.amount - debt.remainingAmount).toLocaleString("th-TH")} / ฿{debt.amount.toLocaleString("th-TH")}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isBorrowed ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                </div>

                {/* Actions bottom line */}
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <button
                    onClick={() => setExpandedDebtId(expandedDebtId === debt.id ? null : debt.id)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{expandedDebtId === debt.id ? "🙈 ซ่อนประวัติชำระ" : `📖 ประวัติชำระ (${relatedPayments.length})`}</span>
                    {expandedDebtId === debt.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {debt.status === "active" && (
                    <button
                      onClick={() => selectDebtForRepayment(debt)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        isBorrowed 
                          ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {isBorrowed ? "จ่ายคืน (Repay)" : "รับชำระ (Receive)"}
                    </button>
                  )}
                </div>

                {/* Expanded payment logs */}
                {expandedDebtId === debt.id && (
                  <div className="pt-2 mt-2 border-t border-white/5 space-y-2 animate-fade-in text-[11px]">
                    <span className="font-bold text-indigo-300 block">📝 ประวัติการบันทึกงวดชำระหนี้:</span>
                    {relatedPayments.length === 0 ? (
                      <p className="text-slate-500 text-xs italic pl-2">ยังไม่มีประวัติชำระคืนในหนี้ก้อนนี้</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {relatedPayments.map((p) => {
                          const wName = wallets.find(w => w.id === p.walletId)?.name || "กระเป๋าตัง";
                          return (
                            <li key={p.id} className="flex justify-between bg-black/10 p-2 rounded-lg border border-white/5 items-center">
                              <div className="space-y-0.5">
                                <span className="font-bold text-white block">฿{p.amount.toLocaleString()}</span>
                                <span className="text-[9px] text-slate-500 block">
                                  {p.date} • ใช้กระเป๋า: {wName}
                                </span>
                                {p.note && <span className="text-[10px] text-slate-400 block italic">({p.note})</span>}
                              </div>
                              <span className="text-[10px] text-emerald-400 font-bold">สำเร็จ</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
