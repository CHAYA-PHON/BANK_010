import { useState, FormEvent } from "react";
import { Wallet, Transaction } from "../types";
import { 
  Plus, Edit, Trash2, Landmark, Wallet as WalletIcon, CreditCard, 
  HelpCircle, ArrowRightLeft, X, Check, ArrowRight, TrendingUp, Sparkles, Coins,
  ArrowUp, ArrowDown, Star
} from "lucide-react";

interface WalletManagerProps {
  wallets: Wallet[];
  transactions: Transaction[];
  onAddWallet: (wallet: Omit<Wallet, "id" | "createdAt">) => void;
  onUpdateWallet: (id: string, wallet: Omit<Wallet, "id" | "createdAt">) => void;
  onDeleteWallet: (id: string) => void;
  onAddTransaction: (data: Omit<Transaction, "id" | "createdAt">) => void;
  onReorderWallets?: (wallets: Wallet[]) => void;
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

export default function WalletManager({
  wallets,
  transactions,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  onAddTransaction,
  onReorderWallets,
}: WalletManagerProps) {
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

  // Form states - Transfer
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);

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

  const totalBalance = Object.values(walletBalances).reduce((sum, bal) => sum + bal, 0);

  const openAddWalletModal = () => {
    setEditingWallet(null);
    setWalletName("");
    setWalletType("cash");
    setInitialBalance("0");
    setWalletIcon("💵");
    setWalletColor(WALLET_COLORS[0].value);
    setAccountNumber("");
    setIsDefault(wallets.length === 0);
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
      accountNumber: walletType === "bank" ? accountNumber.trim() || undefined : undefined,
      isDefault: isDefault,
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

    // Balance validation to prevent negative balance
    const currentFromBalance = walletBalances[fromWalletId] || 0;
    if (amount > currentFromBalance) {
      alert(`❌ ระบบป้องกันยอดคงเหลือติดลบทำงาน!\n\nยอดคงเหลือในกระเป๋าต้นทาง "${fromWallet.name}" ไม่เพียงพอสำหรับการโอน\nยอดคงเหลือปัจจุบัน: ${currentFromBalance.toLocaleString()} บาท\nจำนวนที่พยายามโอน: ${amount.toLocaleString()} บาท`);
      return;
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

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`คุณต้องการลบกระเป๋าเงิน "${name}" ใช่หรือไม่? (ธุรกรรมที่เคยเกิดขึ้นในกระเป๋านี้จะไม่แสดงผลในกระเป๋า แต่ประวัติจะยังอยู่ในระบบ)`)) {
      onDeleteWallet(id);
    }
  };

  return (
    <div id="wallet-manager-section" className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total balance of all wallets combined */}
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 relative overflow-hidden">
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
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((wallet, idx) => {
              const balance = walletBalances[wallet.id] ?? 0;
              return (
                <div
                  key={wallet.id}
                  className={`relative ${wallet.color} border p-5 rounded-3xl text-white shadow-lg flex flex-col justify-between min-h-[170px] group transition-all duration-300 hover:scale-[1.02]`}
                >
                  {/* Top line info */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl filter drop-shadow-md select-none">{wallet.icon}</span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-base tracking-wide truncate max-w-[120px]">
                              {wallet.name}
                            </h4>
                            {wallet.isDefault && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded-md border border-amber-400/30 flex items-center gap-0.5 uppercase shrink-0">
                                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" /> หลัก
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] bg-black/20 text-white/90 font-medium px-2 py-0.5 rounded-full border border-white/10 uppercase">
                            {wallet.type === "cash" ? "💸 เงินสด" : wallet.type === "bank" ? "🏦 ธนาคาร" : wallet.type === "credit" ? "💳 บัตรเครดิต" : "💼 อื่นๆ"}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0 flex-wrap justify-end max-w-[140px]">
                        {onReorderWallets && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (idx > 0) {
                                  const newWallets = [...wallets];
                                  const temp = newWallets[idx];
                                  newWallets[idx] = newWallets[idx - 1];
                                  newWallets[idx - 1] = temp;
                                  onReorderWallets(newWallets);
                                }
                              }}
                              disabled={idx === 0}
                              className="p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                              title="เลื่อนขึ้น"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (idx < wallets.length - 1) {
                                  const newWallets = [...wallets];
                                  const temp = newWallets[idx];
                                  newWallets[idx] = newWallets[idx + 1];
                                  newWallets[idx + 1] = temp;
                                  onReorderWallets(newWallets);
                                }
                              }}
                              disabled={idx === wallets.length - 1}
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
                            onUpdateWallet(wallet.id, {
                              name: wallet.name,
                              type: wallet.type,
                              initialBalance: wallet.initialBalance,
                              icon: wallet.icon,
                              color: wallet.color,
                              accountNumber: wallet.accountNumber,
                              isDefault: true
                            });
                          }}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            wallet.isDefault 
                              ? "bg-amber-500 text-slate-900 font-bold" 
                              : "bg-black/20 text-white/60 hover:text-white hover:bg-black/40"
                          }`}
                          title={wallet.isDefault ? "กระเป๋าตังค่าเริ่มต้น" : "ตั้งเป็นกระเป๋าเงินค่าเริ่มต้น"}
                        >
                          <Star className={`w-3.5 h-3.5 ${wallet.isDefault ? "fill-slate-900 text-slate-900" : ""}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditWalletModal(wallet);
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
                            handleDeleteClick(wallet.id, wallet.name);
                          }}
                          className="p-1.5 bg-black/20 hover:bg-rose-600/60 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                          title="ลบกระเป๋าตัง"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {wallet.accountNumber && (
                      <div className="mt-3 font-mono text-[11px] text-white/70 tracking-wider">
                        เลขบัญชี: {wallet.accountNumber}
                      </div>
                    )}
                  </div>

                  {/* Bottom line: Balance display */}
                  <div className="mt-6 border-t border-white/10 pt-3">
                    <span className="text-[10px] text-white/70 block font-medium">ยอดเงินปัจจุบัน</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black tracking-tight">
                        ฿{balance.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[9px] text-white/60 font-semibold italic">
                        เริ่มที่: ฿{wallet.initialBalance.toLocaleString("th-TH")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guide Card */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex gap-4">
        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl h-fit shrink-0">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-white font-bold text-sm mb-1">การทำงานร่วมกันของกระเป๋าตังและยอดรวม</h4>
          <p className="text-xs text-slate-400 leading-relaxed space-y-1">
            • ยอดเงินในแต่ละกระเป๋าจะถูกคำนวณอย่างถูกต้อง โดยดึงค่าตั้งต้น <span className="text-indigo-400 font-semibold">(Starting Balance)</span> มารวมเข้ากับ รายรับ และหักออกด้วย รายจ่าย ที่คุณผูกไว้กับกระเป๋าตังนั้น ๆ<br />
            • <span className="text-indigo-400 font-semibold">การโอนเงินข้ามบัญชี:</span> ระบบจะหักเงินจากกระเป๋าต้นทาง และโอนไปสมทบกระเป๋าปลายทางโดยอัตโนมัติ โดยไม่ถือว่าเป็นรายจ่ายภายนอกเพื่อไม่ให้กระทบยอดสุทธิรวมของแอป
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
                    <option value="other" className="bg-[#1e293b]">💼 อื่น ๆ (Other)</option>
                  </select>
                </div>

                {/* Account Number (for bank account only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    เลขบัญชี / รายละเอียด {walletType !== "bank" && "(ไม่บังคับ)"}
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={walletType === "bank" ? "เช่น 123-4-56789-0" : "คำใบ้เพิ่มเติม"}
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
                className="flex-1 py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
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
                className="flex-1 py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
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
