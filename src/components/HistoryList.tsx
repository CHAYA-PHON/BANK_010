import { useState } from "react";
import { CATEGORIES, DEFAULT_CATEGORY_INFO, Transaction, TransactionType, Wallet } from "../types";
import CategoryIcon from "./CategoryIcon";
import { Search, Filter, Calendar, Trash2, ArrowUpDown, ImageIcon, X, Edit, Eye, ArrowRight } from "lucide-react";

interface HistoryListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
  wallets: Wallet[];
}

export default function HistoryList({ transactions, onDelete, onEdit, wallets }: HistoryListProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  // Format Thai dates
  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const monthNamesShort = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const monthIndex = parseInt(month, 10) - 1;
    const thaiYearShort = (parseInt(year, 10) + 543) % 100;
    return `${parseInt(day, 10)} ${monthNamesShort[monthIndex]} ${thaiYearShort}`;
  };

  // Get list of unique categories actually present
  const presentCategories = Array.from(new Set(transactions.map((tx) => tx.category)));

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((tx) => {
      // Search match
      const searchLower = search.toLowerCase();
      const matchSearch =
        tx.merchantName.toLowerCase().includes(searchLower) ||
        (tx.note && tx.note.toLowerCase().includes(searchLower)) ||
        tx.category.toLowerCase().includes(searchLower);

      // Type match
      const matchType = filterType === "all" || tx.type === filterType;

      // Category match
      const matchCategory = filterCategory === "all" || tx.category === filterCategory;

      return matchSearch && matchType && matchCategory;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") {
        return new Date(b.date + (b.time ? `T${b.time}` : "")).getTime() - new Date(a.date + (a.time ? `T${a.time}` : "")).getTime();
      }
      if (sortBy === "date-asc") {
        return new Date(a.date + (a.time ? `T${a.time}` : "")).getTime() - new Date(b.date + (b.time ? `T${b.time}` : "")).getTime();
      }
      if (sortBy === "amount-desc") {
        return b.amount - a.amount;
      }
      if (sortBy === "amount-asc") {
        return a.amount - b.amount;
      }
      return 0;
    });

  return (
    <div id="history-list-card" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-lg">
      {/* Title */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div>
          <h3 className="font-bold text-white text-base">ประวัติและรายการทั้งหมด</h3>
          <p className="text-xs text-slate-400">
            พบทั้งหมด {filteredTransactions.length} รายการ จากตัวกรองปัจจุบัน
          </p>
        </div>
      </div>

      {/* Filters & Search Control Grid */}
      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาร้านค้า, บันทึก หรือหมวดหมู่..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-white placeholder-slate-500"
            />
          </div>

          {/* Type Selector */}
          <div className="sm:col-span-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold cursor-pointer"
            >
              <option value="all" className="bg-[#1e293b]">💸 ประเภท: ทั้งหมด</option>
              <option value="expense" className="bg-[#1e293b]">🔴 รายจ่าย เท่านั้น</option>
              <option value="income" className="bg-[#1e293b]">🟢 รายรับ เท่านั้น</option>
              <option value="transfer" className="bg-[#1e293b]">🔄 การโอนเงิน เท่านั้น</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold cursor-pointer"
            >
              <option value="all" className="bg-[#1e293b]">🏷️ หมวดหมู่: ทั้งหมด</option>
              {presentCategories.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1e293b]">
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort & Quick Reset row */}
        <div className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded-xl text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>จัดเรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none font-bold text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="date-desc" className="bg-[#1e293b] text-white">วันที่: ล่าสุดก่อน</option>
              <option value="date-asc" className="bg-[#1e293b] text-white">วันที่: เก่าสุดก่อน</option>
              <option value="amount-desc" className="bg-[#1e293b] text-white">จำนวนเงิน: สูง - ต่ำ</option>
              <option value="amount-asc" className="bg-[#1e293b] text-white">จำนวนเงิน: ต่ำ - สูง</option>
            </select>
          </div>
          {(search || filterType !== "all" || filterCategory !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterType("all");
                setFilterCategory("all");
              }}
              className="text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-2xl bg-white/5">
            <span className="text-2xl">📦</span>
            <p className="text-xs font-semibold text-slate-300 mt-2">ไม่พบประวัติรายการที่ค้นหา</p>
            <p className="text-[10px] text-slate-500 mt-1">ลองเปลี่ยนตัวกรอง คีย์เวิร์ด หรือเพิ่มรายการบันทึกใหม่</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const catInfo = CATEGORIES[tx.category] || DEFAULT_CATEGORY_INFO;

            // Resolve wallet display
            const srcWallet = wallets.find(w => w.id === tx.walletId);
            const dstWallet = wallets.find(w => w.id === tx.toWalletId);

            return (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/5 hover:border-white/15 hover:bg-white/10 hover:shadow-md transition-all duration-200 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Category icon */}
                  <div className={`p-2 rounded-xl shrink-0 ${catInfo.color} ${catInfo.textColor}`}>
                    <CategoryIcon name={catInfo.icon} className="w-5 h-5" />
                  </div>

                  {/* Merchant & note details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[150px] sm:max-w-none">
                        {tx.merchantName}
                      </span>
                      {tx.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setViewImageUrl(tx.imageUrl!)}
                          className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer animate-pulse"
                          title="ดูรูปภาพบิล"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 flex-wrap">
                      <span className="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded-sm font-bold">
                        {tx.category}
                      </span>
                      <span className="flex items-center gap-0.5 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatThaiDate(tx.date)} {tx.time || ""}
                      </span>

                      {/* Display wallet info */}
                      {tx.type === "transfer" && srcWallet && dstWallet ? (
                        <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1">
                          {srcWallet.icon} {srcWallet.name} <ArrowRight className="w-2.5 h-2.5" /> {dstWallet.icon} {dstWallet.name}
                        </span>
                      ) : srcWallet ? (
                        <span className="bg-white/5 border border-white/10 text-slate-300 px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1">
                          {srcWallet.icon} {srcWallet.name}
                        </span>
                      ) : null}

                      {tx.note && <span className="truncate max-w-[120px] sm:max-w-xs text-slate-400 italic">| {tx.note}</span>}
                    </div>
                  </div>
                </div>

                {/* Amount and actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t border-white/5 pt-2 sm:border-t-0 sm:pt-0">
                  <span
                    className={`font-bold text-sm sm:text-base tracking-tight ${
                      tx.type === "income" ? "text-emerald-400" : tx.type === "expense" ? "text-rose-400" : "text-indigo-400"
                    }`}
                  >
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "🔄"}฿
                    {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>

                  {/* Actions buttons panel */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(tx)}
                      className="p-2 sm:p-1.5 hover:bg-white/10 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                      title="แก้ไขข้อมูล"
                    >
                      <Edit className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
                          onDelete(tx.id);
                        }
                      }}
                      className="p-2 sm:p-1.5 hover:bg-white/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bill/Receipt image lightbox modal */}
      {viewImageUrl && (
        <div id="image-lightbox" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-[#1e293b] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1 uppercase tracking-wider">
                🖼️ หลักฐานรูปภาพที่สแกน
              </span>
              <button
                onClick={() => setViewImageUrl(null)}
                className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-black/20 flex items-center justify-center flex-1 overflow-y-auto min-h-0 max-h-[60vh]">
              <img src={viewImageUrl} alt="Scanned bill view" className="max-h-full max-w-full object-contain rounded-xl shadow-lg border border-white/5" />
            </div>
            <div className="p-4 border-t border-white/10 text-center bg-white/5 shrink-0">
              <button
                onClick={() => setViewImageUrl(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
