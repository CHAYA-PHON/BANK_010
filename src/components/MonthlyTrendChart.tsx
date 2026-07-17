import { useState } from "react";
import { Transaction } from "../types";

interface MonthlyTrendChartProps {
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM
}

export default function MonthlyTrendChart({ transactions, selectedMonth }: MonthlyTrendChartProps) {
  const [activePoint, setActivePoint] = useState<{ day: number; amount: number; x: number; y: number } | null>(null);

  const [yearStr, monthStr] = (selectedMonth || "").split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month)) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  // Get total days in this month
  let daysInMonth = new Date(year, month, 0).getDate();
  if (isNaN(daysInMonth) || daysInMonth <= 0) {
    daysInMonth = 30;
  }

  // Initialize days array with 0
  const dailySpending: number[] = Array(daysInMonth).fill(0);

  // Filter expenses and accumulate by day
  const expenses = transactions.filter((tx) => {
    if (tx.type !== "expense") return false;
    const [txYear, txMonth] = tx.date.split("-");
    return parseInt(txYear, 10) === year && parseInt(txMonth, 10) === month;
  });

  expenses.forEach((tx) => {
    const txDay = parseInt(tx.date.split("-")[2], 10);
    if (txDay >= 1 && txDay <= daysInMonth) {
      dailySpending[txDay - 1] += tx.amount;
    }
  });

  const maxSpending = Math.max(...dailySpending, 1000); // Minimum scale height is 1000 THB

  // Chart Dimensions
  const width = 500;
  const height = 200;
  const paddingX = 40;
  const paddingY = 25;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Calculate coordinates for SVG
  const points = dailySpending.map((amount, idx) => {
    const day = idx + 1;
    const x = paddingX + (idx / (daysInMonth - 1)) * chartWidth;
    const y = paddingY + chartHeight - (amount / maxSpending) * chartHeight;
    return { day, amount, x, y };
  });

  // Construct Area Path
  let areaPath = "";
  let linePath = "";

  if (points.length > 0) {
    // Generate straight line connection
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");

    // Generate closed area path for fill
    areaPath =
      `${linePath} L ${points[points.length - 1].x} ${paddingY + chartHeight} ` +
      `L ${points[0].x} ${paddingY + chartHeight} Z`;
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-lg flex flex-col">
      <div className="mb-4">
        <h3 className="font-bold text-white text-base">แนวโน้มการใช้จ่ายรายวัน</h3>
        <p className="text-xs text-slate-400">กราฟแสดงการใช้จ่ายสะสมในแต่ละวันของเดือน</p>
      </div>

      <div className="flex-1 min-h-[220px] relative">
        {/* Hover Tooltip */}
        {activePoint && (
          <div
            className="absolute bg-[#1e293b] border border-white/10 text-white rounded-xl px-3 py-2 text-xs pointer-events-none shadow-2xl z-10 -translate-x-1/2 -translate-y-[110%] transition-all duration-150"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <p className="font-semibold text-[10px] text-slate-400">วันที่ {activePoint.day}</p>
            <p className="font-bold text-emerald-400">฿{activePoint.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        )}

        {/* SVG Area Chart */}
        <div className="w-full h-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              {/* Fade blue gradient */}
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const yVal = paddingY + chartHeight * ratio;
              const amtLabel = maxSpending * (1 - ratio);
              return (
                <g key={ratio} className="opacity-60">
                  <line
                    x1={paddingX}
                    y1={yVal}
                    x2={width - paddingX}
                    y2={yVal}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingX - 8}
                    y={yVal + 3}
                    textAnchor="end"
                    className="text-[9px] font-semibold fill-slate-400"
                  >
                    {amtLabel >= 1000 ? `${(amtLabel / 1000).toFixed(1)}k` : amtLabel.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Grid labels for Days */}
            {[1, 5, 10, 15, 20, 25, daysInMonth].map((day) => {
              if (day > daysInMonth) return null;
              const point = points[day - 1];
              if (!point) return null;
              return (
                <text
                  key={day}
                  x={point.x}
                  y={height - 5}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-slate-400"
                >
                  {day}
                </text>
              );
            })}

            {/* Area Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-300" />
            )}

            {/* Line Stroke */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )}

            {/* Interactive Dots */}
            {points.map((p, idx) => {
              const isActive = activePoint && activePoint.day === p.day;
              return (
                <g key={p.day}>
                  {/* Invisible wide interactive area for each point */}
                  <rect
                    x={p.x - 7}
                    y={paddingY}
                    width="14"
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setActivePoint(p)}
                    onMouseLeave={() => setActivePoint(null)}
                  />

                  {/* Visual dot on hover or if amount > 0 */}
                  {(p.amount > 0 || isActive) && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 5 : 3.5}
                      fill={isActive ? "#10b981" : "#0f172a"}
                      stroke="#10b981"
                      strokeWidth={isActive ? 2.5 : 2}
                      className="transition-all duration-150 pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
