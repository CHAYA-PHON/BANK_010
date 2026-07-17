import { useState } from "react";
import { CATEGORIES, DEFAULT_CATEGORY_INFO, Transaction } from "../types";
import CategoryIcon from "./CategoryIcon";

interface CategoryBreakdownProps {
  transactions: Transaction[];
}

export default function CategoryBreakdown({ transactions }: CategoryBreakdownProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter to expenses only
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate totals by category
  const categoryTotalsMap: Record<string, number> = {};
  expenses.forEach((tx) => {
    categoryTotalsMap[tx.category] = (categoryTotalsMap[tx.category] || 0) + tx.amount;
  });

  // Convert to sorted list of objects
  const categoriesData = Object.entries(categoryTotalsMap)
    .map(([name, amount]) => {
      const info = CATEGORIES[name] || DEFAULT_CATEGORY_INFO;
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        name,
        amount,
        percentage,
        info,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Math for SVG Donut chart
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.16

  let accumulatedPercentage = 0;

  // Let's map categories to stroke properties
  const slices = categoriesData.map((item, index) => {
    const percentage = item.percentage;
    const strokeLength = (percentage * circumference) / 100;
    const strokeOffset = circumference - (accumulatedPercentage * circumference) / 100;
    accumulatedPercentage += percentage;

    // Determine the color
    // We map Tailwind backgrounds to nice hex code or simple CSS color
    let hexColor = "#64748b"; // Slate
    if (item.name === "อาหารและเครื่องดื่ม") hexColor = "#f59e0b"; // Amber
    else if (item.name === "ช้อปปิ้งและของใช้") hexColor = "#3b82f6"; // Blue
    else if (item.name === "การเดินทางและยานพาหนะ") hexColor = "#a855f7"; // Purple
    else if (item.name === "ค่าสาธารณูปโภค") hexColor = "#06b6d4"; // Cyan
    else if (item.name === "ความบันเทิง") hexColor = "#ec4899"; // Pink
    else if (item.name === "สุขภาพและความงาม") hexColor = "#10b981"; // Emerald
    else if (item.name === "ที่อยู่อาศัย") hexColor = "#f97316"; // Orange
    else if (item.name === "เงินเดือนและรายได้") hexColor = "#22c55e"; // Green

    return {
      ...item,
      strokeLength,
      strokeOffset,
      color: hexColor,
      index,
    };
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : slices[0];

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-lg flex flex-col h-full">
      <div className="mb-4">
        <h3 className="font-bold text-white text-base">สัดส่วนค่าใช้จ่ายรายหมวดหมู่</h3>
        <p className="text-xs text-slate-400">สัดส่วนและจำนวนเงินที่ใช้จ่ายในแต่ละหมวดหมู่</p>
      </div>

      {totalExpense === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 border border-white/10 rounded-3xl bg-white/5">
          <span className="text-3xl mb-2">🍽️</span>
          <p className="text-sm font-medium text-slate-300">ไม่มีข้อมูลค่าใช้จ่ายในเดือนนี้</p>
          <p className="text-xs text-slate-500">ลองเพิ่มรายการค่าใช้จ่ายเพื่อดูสัดส่วนของคุณ</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart Display */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-44 h-44 sm:w-48 sm:h-48">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                {/* Background Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth={strokeWidth}
                />
                {/* Colored Slices */}
                {slices.map((slice) => (
                  <circle
                    key={slice.name}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={strokeWidth + (hoveredIndex === slice.index ? 2 : 0)}
                    strokeDasharray={`${slice.strokeLength} ${circumference - slice.strokeLength}`}
                    strokeDashoffset={slice.strokeOffset}
                    strokeLinecap="round"
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(slice.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                ))}
              </svg>

              {/* Text Center Overlays */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[100px]">
                  {hoveredIndex !== null ? activeSlice.name : "รายจ่ายรวม"}
                </span>
                <span className="text-lg font-extrabold text-white tracking-tight block mt-0.5">
                  ฿
                  {(hoveredIndex !== null ? activeSlice.amount : totalExpense).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 0 }
                  )}
                </span>
                <span className="text-xs font-bold text-indigo-300 bg-white/10 px-2 py-0.5 rounded-full mt-1.5 shadow-sm">
                  {(hoveredIndex !== null ? activeSlice.percentage : 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-slate-400 mt-3 text-center">
              💡 ชี้ที่ชิ้นแผนภูมิเพื่อดูสถิติแยกหมวดหมู่
            </p>
          </div>

          {/* Progress List Display */}
          <div className="md:col-span-7 space-y-3.5 self-start w-full">
            {categoriesData.slice(0, 5).map((item, index) => {
              const slice = slices.find((s) => s.name === item.name);
              const colorClass = slice ? slice.color : "#64748b";

              return (
                <div
                  key={item.name}
                  className="space-y-1 cursor-pointer transition-all p-2 rounded-2xl hover:bg-white/5"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2 text-slate-300">
                      <div className={`p-1.5 ${item.info.color} ${item.info.textColor} rounded-lg`}>
                        <CategoryIcon name={item.info.icon} className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">
                        ฿{item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-slate-400 ml-1.5">({item.percentage.toFixed(0)}%)</span>
                    </div>
                  </div>

                  {/* Custom Progress bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: colorClass,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {categoriesData.length > 5 && (
              <p className="text-[10px] text-slate-400 text-right pt-1 font-semibold">
                + อีก {categoriesData.length - 5} หมวดหมู่ที่เหลือด้านล่าง...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
