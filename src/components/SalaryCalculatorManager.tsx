import React, { useState, useEffect, useMemo } from "react";
import { 
  Calculator, DollarSign, Calendar, Clock, Briefcase, Award, 
  CheckCircle2, Plus, Trash2, Settings, Save, FileSpreadsheet, 
  Download, Sparkles, Moon, Sun, AlertCircle, Building, Home, 
  Truck, Coffee, HelpCircle, Check, Edit, ShieldAlert, ArrowRight, 
  ChevronDown, ChevronUp, RefreshCw, Sliders, Landmark, Wallet as WalletIcon,
  Printer, ArrowUpRight, Flag, CalendarCheck, UserCheck, Star, ShieldCheck,
  FileCheck, Repeat, Loader2, CreditCard, Coins, TrendingUp, TrendingDown,
  BarChart3, Search, ArrowUp, ArrowDown, Utensils, Info
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Wallet, Transaction } from "../types";

function cleanObjectForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanObjectForFirestore(item)) as any;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = (obj as any)[key];
        if (val !== undefined) {
          cleaned[key] = cleanObjectForFirestore(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export type WorkStatus = 
  | "work"             // 🟢 มาทำงาน
  | "off"              // ⚪️ วันหยุดประจำสัปดาห์
  | "public_holiday"   // 🚩 วันหยุดนักขัตฤกษ์
  | "shifted_holiday"  // 🔁 ปรับเลื่อนวันหยุด / ชดเชย
  | "personal_leave"   // 🟡 ลากิจ
  | "sick_leave"       // 🔵 ลาป่วย
  | "vacation_leave";  // 🟣 ลาพักร้อน

export interface CustomAdjustmentItem {
  id: string;
  name: string;
  amount: number;
}

export interface PublicHolidayItem {
  id: string;
  dateStr: string; // YYYY-MM-DD
  name: string; // เช่น วันขึ้นปีใหม่, วันสงกรานต์
}

export interface SalaryRaiseItem {
  id: string;
  effectiveMonth: string; // YYYY-MM e.g. "2026-04"
  type: "amount" | "percent"; // "amount" (บาท) or "percent" (%)
  value: number; // e.g. 2000 or 5
  note?: string; // e.g. "ปรับประจำปี 2026"
}

export interface SalaryConfig {
  baseSalary: number; // ฐานเงินเดือน
  mealAllowanceDaily: number; // ค่าข้าว ต่อวัน (default 47)
  separateMealPay?: boolean; // แยกค่าข้าวเข้าบัตรพนักงาน (ไม่รวมกับเงินเดือนสุทธิ)
  salaryWalletId?: string; // กระเป๋าสำหรับรับเงินเดือนสุทธิ
  mealWalletId?: string; // กระเป๋าสำหรับรับค่าข้าว (บัตรพนักงาน)
  travelAllowanceDaily: number; // ค่าเดินทาง ต่อวัน (default 50)
  otMealAllowanceDaily: number; // ค่าข้าว OT ต่อวัน (default 35)
  nightShiftAllowanceDaily: number; // ค่ากะ ต่อวัน (default 80)
  kpiAllowanceMonthly: number; // ค่า KPI ต่อเดือน (default 600)
  housingAllowanceMonthly: number; // ค่าที่พัก ต่อเดือน (default 800)
  positionAllowanceMonthly: number; // ค่าตำแหน่ง ต่อเดือน (default 300)
  otherIncomeMonthly: number; // รายได้เพิ่มเติม (default 200)
  
  // รายรับเพิ่มเติมใหม่
  diligentAllowance: number; // เบี้ยขยัน (จ่ายช่วงไฮซีซัน)
  vacationRefund: number; // พักร้อนคืนเงิน
  seniorityAllowance: number; // ค่าอายุงานประจำปี
  specialDutyAllowance: number; // ค่าจุดพิเศษ
  certificateAllowance: number; // ค่าวุฒิบัตร

  annualBonus: number; // โบนัสประจำปี (จ่าย ธันวาคม)
  studentLoanDeduction: number; // หัก กยศ. (default 900)
  socialSecurityPercent: number; // ประกันสังคม % (default 5%)
  socialSecurityMaxCap?: number; // ยอดหักสูงสุดประกันสังคม (default 750)
  includeAllowancesInSocialSecurity?: boolean; // รวมเงินเดือน + ค่าตำแหน่ง + ค่าเดินทาง ในฐานประกันสังคม
  kpiDeduction: number; // หัก KPI
  otherDeduction: number; // รายการหักเพิ่มเติม

  publicHolidays: PublicHolidayItem[]; // รายการวันหยุดนักขัตฤกษ์ที่กำหนดไว้
  workingSaturdays?: string[]; // รายการวันเสาร์ทำงาน (office w) YYYY-MM-DD
  salaryRaises?: SalaryRaiseItem[]; // ประวัติ/กำหนดการปรับขึ้นเงินเดือน
}

export interface DailyAttendance {
  day: number;
  dateStr: string; // YYYY-MM-DD
  status: WorkStatus; // สถานะการทำงาน
  isNightShift: boolean;
  ot15Hours: number; // OT 1.5
  ot10Hours: number; // Holiday work 1.0 (8h)
  ot30Hours: number; // Holiday OT 3.0
  note?: string;
}

export interface QuickSummaryData {
  workDaysInput: number;
  ot15HoursInput: number;
  ot10HoursInput: number;
  ot30HoursInput: number;
  otMealDaysInput: number;
  nightShiftDaysInput: number;
  kpiAllowanceInput: number;
  positionAllowanceInput: number;
  otherIncomeInput: number;
  studentLoanInput: number;
  socialSecurityInput: number;
}

export interface RecordedPeriodStatus {
  salaryRecorded: boolean;
  salaryRecordedAt?: string;
  salaryAmount?: number;
  mealRecorded: boolean;
  mealRecordedAt?: string;
  mealAmount?: number;
  quickSummary?: QuickSummaryData;
}

interface SalaryCalculatorManagerProps {
  wallets: Wallet[];
  transactions?: Transaction[];
  onAddTransaction: (data: Omit<Transaction, "id" | "createdAt">) => void;
  currentUser: string;
}

export const DEFAULT_HOLIDAYS_2025: PublicHolidayItem[] = [
  { id: "h25_1", dateStr: "2025-01-01", name: "วันขึ้นปีใหม่" },
  { id: "h25_2", dateStr: "2025-01-02", name: "วันหยุดพิเศษปีใหม่" },
  { id: "h25_3", dateStr: "2025-02-12", name: "วันมาฆบูชา" },
  { id: "h25_4", dateStr: "2025-04-14", name: "วันสงกรานต์" },
  { id: "h25_5", dateStr: "2025-04-15", name: "วันสงกรานต์" },
  { id: "h25_6", dateStr: "2025-04-16", name: "วันสงกรานต์" },
  { id: "h25_7", dateStr: "2025-04-17", name: "วันสงกรานต์" },
  { id: "h25_8", dateStr: "2025-05-01", name: "วันแรงงานแห่งชาติ" },
  { id: "h25_9", dateStr: "2025-06-03", name: "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี" },
  { id: "h25_10", dateStr: "2025-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { id: "h25_11", dateStr: "2025-08-12", name: "วันแม่แห่งชาติ" },
  { id: "h25_12", dateStr: "2025-10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { id: "h25_13", dateStr: "2025-12-05", name: "วันพ่อแห่งชาติ" },
  { id: "h25_14", dateStr: "2025-12-30", name: "วันหยุดพิเศษส่งท้ายปี" },
  { id: "h25_15", dateStr: "2025-12-31", name: "วันสิ้นปี" },
];

export const DEFAULT_HOLIDAYS_2026: PublicHolidayItem[] = [
  { id: "h26_1", dateStr: "2026-01-01", name: "วันขึ้นปีใหม่" },
  { id: "h26_2", dateStr: "2026-01-02", name: "วันหยุดพิเศษปีใหม่" },
  { id: "h26_3", dateStr: "2026-03-03", name: "วันมาฆบูชา" },
  { id: "h26_4", dateStr: "2026-04-13", name: "วันสงกรานต์" },
  { id: "h26_5", dateStr: "2026-04-14", name: "วันสงกรานต์" },
  { id: "h26_6", dateStr: "2026-04-15", name: "วันสงกรานต์" },
  { id: "h26_7", dateStr: "2026-04-16", name: "วันสงกรานต์" },
  { id: "h26_8", dateStr: "2026-05-01", name: "วันแรงงานแห่งชาติ" },
  { id: "h26_9", dateStr: "2026-06-03", name: "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี" },
  { id: "h26_10", dateStr: "2026-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { id: "h26_11", dateStr: "2026-08-12", name: "วันแม่แห่งชาติ" },
  { id: "h26_12", dateStr: "2026-10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { id: "h26_13", dateStr: "2026-12-05", name: "วันพ่อแห่งชาติ" },
  { id: "h26_14", dateStr: "2026-12-30", name: "วันหยุดพิเศษส่งท้ายปี" },
  { id: "h26_15", dateStr: "2026-12-31", name: "วันสิ้นปี" },
];

export const DEFAULT_HOLIDAYS_2027: PublicHolidayItem[] = [
  { id: "h27_1", dateStr: "2027-01-01", name: "วันขึ้นปีใหม่" },
  { id: "h27_2", dateStr: "2027-01-02", name: "วันหยุดพิเศษปีใหม่" },
  { id: "h27_3", dateStr: "2027-02-21", name: "วันมาฆบูชา" },
  { id: "h27_4", dateStr: "2027-04-06", name: "วันจักรี" },
  { id: "h27_5", dateStr: "2027-04-13", name: "วันสงกรานต์" },
  { id: "h27_6", dateStr: "2027-04-14", name: "วันสงกรานต์" },
  { id: "h27_7", dateStr: "2027-04-15", name: "วันสงกรานต์" },
  { id: "h27_8", dateStr: "2027-04-16", name: "วันหยุดชดเชยวันสงกรานต์" },
  { id: "h27_9", dateStr: "2027-05-01", name: "วันแรงงานแห่งชาติ" },
  { id: "h27_10", dateStr: "2027-05-04", name: "วันฉัตรมงคล" },
  { id: "h27_11", dateStr: "2027-05-20", name: "วันวิสาขบูชา" },
  { id: "h27_12", dateStr: "2027-06-03", name: "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี" },
  { id: "h27_13", dateStr: "2027-07-18", name: "วันอาสาฬหบูชา" },
  { id: "h27_14", dateStr: "2027-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { id: "h27_15", dateStr: "2027-08-12", name: "วันแม่แห่งชาติ" },
  { id: "h27_16", dateStr: "2027-10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { id: "h27_17", dateStr: "2027-10-23", name: "วันปิยมหาราช" },
  { id: "h27_18", dateStr: "2027-12-05", name: "วันพ่อแห่งชาติ" },
  { id: "h27_19", dateStr: "2027-12-10", name: "วันรัฐธรรมนูญ" },
  { id: "h27_20", dateStr: "2027-12-30", name: "วันหยุดพิเศษส่งท้ายปี" },
  { id: "h27_21", dateStr: "2027-12-31", name: "วันสิ้นปี" },
];

export const getPresetHolidaysForYear = (y: number): PublicHolidayItem[] => {
  if (y === 2025) return DEFAULT_HOLIDAYS_2025;
  if (y === 2026) return DEFAULT_HOLIDAYS_2026;
  if (y === 2027) return DEFAULT_HOLIDAYS_2027;

  // General official holiday list generator for any year (2028, 2029, 2030, etc.)
  const yStr = String(y);
  return [
    { id: `h_${y}_1`, dateStr: `${yStr}-01-01`, name: "วันขึ้นปีใหม่" },
    { id: `h_${y}_2`, dateStr: `${yStr}-01-02`, name: "วันหยุดพิเศษปีใหม่" },
    { id: `h_${y}_3`, dateStr: `${yStr}-04-06`, name: "วันจักรี" },
    { id: `h_${y}_4`, dateStr: `${yStr}-04-13`, name: "วันสงกรานต์" },
    { id: `h_${y}_5`, dateStr: `${yStr}-04-14`, name: "วันสงกรานต์" },
    { id: `h_${y}_6`, dateStr: `${yStr}-04-15`, name: "วันสงกรานต์" },
    { id: `h_${y}_7`, dateStr: `${yStr}-04-16`, name: "วันหยุดชดเชยวันสงกรานต์" },
    { id: `h_${y}_8`, dateStr: `${yStr}-05-01`, name: "วันแรงงานแห่งชาติ" },
    { id: `h_${y}_9`, dateStr: `${yStr}-05-04`, name: "วันฉัตรมงคล" },
    { id: `h_${y}_10`, dateStr: `${yStr}-06-03`, name: "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี" },
    { id: `h_${y}_11`, dateStr: `${yStr}-07-28`, name: "วันเฉลิมพระชนมพรรษา ร.10" },
    { id: `h_${y}_12`, dateStr: `${yStr}-08-12`, name: "วันแม่แห่งชาติ" },
    { id: `h_${y}_13`, dateStr: `${yStr}-10-13`, name: "วันคล้ายวันสวรรคต ร.9" },
    { id: `h_${y}_14`, dateStr: `${yStr}-10-23`, name: "วันปิยมหาราช" },
    { id: `h_${y}_15`, dateStr: `${yStr}-12-05`, name: "วันพ่อแห่งชาติ" },
    { id: `h_${y}_16`, dateStr: `${yStr}-12-10`, name: "วันรัฐธรรมนูญ" },
    { id: `h_${y}_17`, dateStr: `${yStr}-12-30`, name: "วันหยุดพิเศษส่งท้ายปี" },
    { id: `h_${y}_18`, dateStr: `${yStr}-12-31`, name: "วันสิ้นปี" },
  ];
};

export const DEFAULT_HOLIDAYS: PublicHolidayItem[] = [
  ...DEFAULT_HOLIDAYS_2025,
  ...DEFAULT_HOLIDAYS_2026,
  ...DEFAULT_HOLIDAYS_2027,
];

export const DEFAULT_WORKING_SATURDAYS_2025: string[] = [
  "2025-01-04", "2025-01-18", "2025-02-01", "2025-02-15", "2025-03-01", "2025-03-15", "2025-03-29",
  "2025-04-19", "2025-04-26", "2025-05-10", "2025-05-24", "2025-06-07", "2025-06-21", "2025-07-05",
  "2025-07-19", "2025-08-02", "2025-08-16", "2025-08-30", "2025-09-13", "2025-09-27", "2025-10-11",
  "2025-10-25", "2025-11-08", "2025-11-22", "2025-12-06", "2025-12-20"
];

export const DEFAULT_WORKING_SATURDAYS_2026: string[] = [
  "2026-01-03", "2026-01-17", "2026-01-31", "2026-02-14", "2026-02-28", "2026-03-14", "2026-03-28",
  "2026-04-11", "2026-04-25", "2026-05-09", "2026-05-23", "2026-06-06", "2026-06-20", "2026-07-04",
  "2026-07-18", "2026-08-01", "2026-08-15", "2026-08-29", "2026-09-12", "2026-09-26", "2026-10-10",
  "2026-10-24", "2026-11-07", "2026-11-21", "2026-12-05", "2026-12-19"
];

export const DEFAULT_WORKING_SATURDAYS: string[] = [
  ...DEFAULT_WORKING_SATURDAYS_2025,
  ...DEFAULT_WORKING_SATURDAYS_2026,
];

const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  baseSalary: 15000,
  mealAllowanceDaily: 47,
  separateMealPay: true,
  salaryWalletId: "",
  mealWalletId: "",
  travelAllowanceDaily: 50,
  otMealAllowanceDaily: 35,
  nightShiftAllowanceDaily: 80,
  kpiAllowanceMonthly: 0,
  housingAllowanceMonthly: 800,
  positionAllowanceMonthly: 300,
  otherIncomeMonthly: 200,
  
  // New allowances
  diligentAllowance: 0,
  vacationRefund: 0,
  seniorityAllowance: 0,
  specialDutyAllowance: 0,
  certificateAllowance: 0,

  annualBonus: 15000,
  studentLoanDeduction: 900,
  socialSecurityPercent: 5,
  socialSecurityMaxCap: 750,
  includeAllowancesInSocialSecurity: false,
  kpiDeduction: 0,
  otherDeduction: 0,
  publicHolidays: DEFAULT_HOLIDAYS,
  workingSaturdays: DEFAULT_WORKING_SATURDAYS,
};

// Helper: Calculate Official Payroll Payday according to rule (5th of next month, shifted before weekend/holiday)
export function getPaydayInfo(
  year: number,
  month: number,
  period: "full" | "p1" | "p2" = "full",
  publicHolidays: PublicHolidayItem[] = DEFAULT_HOLIDAYS,
  workingSaturdays: string[] = DEFAULT_WORKING_SATURDAYS
): {
  dateStr: string; // YYYY-MM-DD
  formattedThai: string; // e.g. "5 ก.พ. 2569"
  isShifted: boolean;
  originalTargetStr: string;
  reason: string;
  shiftNote?: string;
} {
  let targetYear = year;
  let targetMonth = month;
  let targetDay = 5;
  let reason = "จ่ายทุกวันที่ 5 ของเดือนถัดไป";

  if (month === 12) {
    if (period === "p1") {
      targetYear = year;
      targetMonth = 12;
      targetDay = 25; // Paid before year-end holiday
      reason = "งวดที่ 1 (1-20 ธ.ค.): จ่ายก่อนวันหยุดสิ้นปี";
    } else {
      targetYear = year + 1;
      targetMonth = 1;
      targetDay = 5;
      reason = "งวดที่ 2 (21-31 ธ.ค.): จ่ายวันที่ 5 มกราคม ของปีถัดไป";
    }
  } else {
    targetMonth = month + 1;
    targetDay = 5;
  }

  const originalTargetStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

  let checkDate = new Date(targetYear, targetMonth - 1, targetDay);
  let isShifted = false;
  let shiftReason = "";

  const isClosedDay = (d: Date) => {
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (dayOfWeek === 0) return "วันอาทิตย์ (วันหยุดประจำสัปดาห์)";

    if (dayOfWeek === 6) {
      // Check if this Saturday is a Working Saturday (office w)
      const isWorkingSat = workingSaturdays && workingSaturdays.includes(dStr);
      if (!isWorkingSat) {
        return "วันเสาร์ (วันหยุดประจำสัปดาห์ เสาร์เว้นเสาร์)";
      }
    }

    const hol = publicHolidays.find((h) => h.dateStr === dStr);
    if (hol) return `วันหยุดบริษัท/นักขัตฤกษ์ (${hol.name})`;

    return null;
  };

  let closedReason = isClosedDay(checkDate);
  while (closedReason) {
    if (!isShifted) {
      shiftReason = `ตรงกับ${closedReason} จึงเลื่อนจ่ายล่วงหน้ามาเป็นวันทำการก่อนหน้า`;
    }
    isShifted = true;
    checkDate.setDate(checkDate.getDate() - 1);
    closedReason = isClosedDay(checkDate);
  }

  const finalYear = checkDate.getFullYear();
  const finalMonth = checkDate.getMonth() + 1;
  const finalDay = checkDate.getDate();
  const dateStr = `${finalYear}-${String(finalMonth).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;

  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const thaiYear = finalYear + 543;
  const formattedThai = `${finalDay} ${monthsThai[finalMonth - 1]} ${thaiYear}`;

  return {
    dateStr,
    formattedThai,
    isShifted,
    originalTargetStr,
    reason,
    shiftNote: isShifted ? shiftReason : undefined,
  };
}

export default function SalaryCalculatorManager({
  wallets,
  transactions = [],
  onAddTransaction,
  currentUser,
}: SalaryCalculatorManagerProps) {
  // Config state with LocalStorage persistence per user
  const [config, setConfig] = useState<SalaryConfig>(() => {
    const saved = localStorage.getItem(`salary_config_${currentUser || "default"}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...DEFAULT_SALARY_CONFIG, 
          ...parsed,
          publicHolidays: parsed.publicHolidays && parsed.publicHolidays.length > 0 ? parsed.publicHolidays : DEFAULT_HOLIDAYS 
        };
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_SALARY_CONFIG;
  });

  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"summary" | "daily" | "payslip" | "annual">("summary");

  // Selected Month & Period
  const now = new Date();
  const defaultMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr); // YYYY-MM
  const [decemberPeriod, setDecemberPeriod] = useState<"p1" | "p2" | "full">("p1"); // For Dec: p1 (1-20), p2 (21-31), full (1-31)

  // Determine if selected month is December
  const isDecember = useMemo(() => {
    if (!selectedMonth) return false;
    const parts = selectedMonth.split("-");
    return parts[1] === "12";
  }, [selectedMonth]);

  // Unique Period Key for tracking recording status per period
  const periodKey = useMemo(() => {
    return `${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
  }, [selectedMonth, isDecember, decemberPeriod]);

  // Direct monthly overrides for KPI, Position, Other Income, Student Loan, Social Security
  const [kpiAllowanceInput, setKpiAllowanceInput] = useState<number>(config.kpiAllowanceMonthly);
  const [positionAllowanceInput, setPositionAllowanceInput] = useState<number>(config.positionAllowanceMonthly);
  const [otherIncomeInput, setOtherIncomeInput] = useState<number>(config.otherIncomeMonthly);

  const [studentLoanInput, setStudentLoanInput] = useState<number>(config.studentLoanDeduction);
  const [socialSecurityInput, setSocialSecurityInput] = useState<number>(750);

  // Search History for Custom Earnings Autocomplete
  const DEFAULT_EARNING_HISTORY = [
    "เบี้ยขยัน (จ่ายช่วงไฮซีซัน)",
    "พักร้อนคืนเงิน",
    "ค่าอายุงานประจำปี",
    "ค่าจุดพิเศษ",
    "ค่าวุฒิบัตร",
    "ค่าเข้าเวรพิเศษ",
    "ค่าเบี้ยเลี้ยงต่างจังหวัด",
    "ค่าโทรศัพท์",
    "ค่าคอมมิชชั่น",
    "เงินรางวัลพิเศษ",
    "ค่าเช่าคอมพิวเตอร์",
    "ค่าโอทีเหมาจ่าย",
    "ค่าครองชีพ",
    "ค่าตอบแทนพิเศษ",
    "โบนัสเป้าหมาย",
  ];

  const [earningHistory, setEarningHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem(`salary_earning_history_${currentUser || "default"}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_EARNING_HISTORY;
  });

  const [showEarningSuggestions, setShowEarningSuggestions] = useState<boolean>(false);

  // Search History for Custom Deductions Autocomplete
  const DEFAULT_DEDUCTION_HISTORY = [
    "ค่าวุฒิบัตร",
    "หัก KPI (ส่งงานเกินกำหนด/ผิดพลาด)",
    "ค่าปรับเข้างานสาย",
    "ค่าประกันเครื่องแบบ / อุปกรณ์",
    "ค่าของเสียหาย / ปรับทุจริต",
    "หักลาเกินกำหนด / ขาดงาน",
    "เงินกู้ยืมสวัสดิการ",
    "ค่าธรรมเนียมการโอน",
    "รายการหักอื่นๆ",
  ];

  const [deductionHistory, setDeductionHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem(`salary_deduction_history_${currentUser || "default"}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_DEDUCTION_HISTORY;
  });

  const [showDeductionSuggestions, setShowDeductionSuggestions] = useState<boolean>(false);

  // New Salary Raise Input state in config modal
  const [newRaiseMonth, setNewRaiseMonth] = useState<string>(defaultMonthStr);
  const [newRaiseType, setNewRaiseType] = useState<"amount" | "percent">("amount");
  const [newRaiseValue, setNewRaiseValue] = useState<string>("");
  const [newRaiseNote, setNewRaiseNote] = useState<string>("");

  // Annual Overview Year
  const [annualSelectedYear, setAnnualSelectedYear] = useState<number>(now.getFullYear());

  // Recorded Status for current month/period
  const [recordStatus, setRecordStatus] = useState<RecordedPeriodStatus>({
    salaryRecorded: false,
    mealRecorded: false,
  });

  // Load recordStatus and quick summary inputs from Firestore & localStorage when period changes
  useEffect(() => {
    if (!selectedMonth) return;
    let isMounted = true;

    async function fetchRecordStatus() {
      const storageKey = `salary_record_status_${currentUser || "default"}_${periodKey}`;
      const quickKey = `salary_quick_inputs_${currentUser || "default"}_${periodKey}`;
      const savedLocal = localStorage.getItem(storageKey);
      let localStatus: RecordedPeriodStatus = { salaryRecorded: false, mealRecorded: false };

      if (savedLocal) {
        try {
          localStatus = JSON.parse(savedLocal);
        } catch (e) {
          console.error("Error parsing local record status:", e);
        }
      }

      let savedQuick: QuickSummaryData | null = null;
      const savedQuickStr = localStorage.getItem(quickKey);
      if (savedQuickStr) {
        try { savedQuick = JSON.parse(savedQuickStr); } catch (e) { console.error(e); }
      } else if (localStatus.quickSummary) {
        savedQuick = localStatus.quickSummary;
      }

      if (currentUser) {
        const uId = currentUser.toLowerCase().trim();
        try {
          const docRef = doc(db, "users", uId, "salary_records", periodKey);
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            const cloudData = snap.data() as RecordedPeriodStatus;
            if (cloudData) {
              localStatus = cloudData;
              localStorage.setItem(storageKey, JSON.stringify(cloudData));
              if (cloudData.quickSummary) {
                savedQuick = cloudData.quickSummary;
              }
            }
          }
        } catch (e) {
          console.error("Error fetching salary_records from Firestore:", e);
        }
      }

      if (isMounted) {
        setRecordStatus(localStatus);
        if (savedQuick) {
          if (typeof savedQuick.workDaysInput === "number") setWorkDaysInput(savedQuick.workDaysInput);
          if (typeof savedQuick.ot15HoursInput === "number") setOt15HoursInput(savedQuick.ot15HoursInput);
          if (typeof savedQuick.ot10HoursInput === "number") setOt10HoursInput(savedQuick.ot10HoursInput);
          if (typeof savedQuick.ot30HoursInput === "number") setOt30HoursInput(savedQuick.ot30HoursInput);
          if (typeof savedQuick.otMealDaysInput === "number") setOtMealDaysInput(savedQuick.otMealDaysInput);
          if (typeof savedQuick.nightShiftDaysInput === "number") setNightShiftDaysInput(savedQuick.nightShiftDaysInput);
          if (typeof savedQuick.kpiAllowanceInput === "number") setKpiAllowanceInput(savedQuick.kpiAllowanceInput);
          if (typeof savedQuick.positionAllowanceInput === "number") setPositionAllowanceInput(savedQuick.positionAllowanceInput);
          if (typeof savedQuick.otherIncomeInput === "number") setOtherIncomeInput(savedQuick.otherIncomeInput);
          if (typeof savedQuick.studentLoanInput === "number") setStudentLoanInput(savedQuick.studentLoanInput);
          if (typeof savedQuick.socialSecurityInput === "number") setSocialSecurityInput(savedQuick.socialSecurityInput);
        }
      }
    }

    fetchRecordStatus();

    return () => {
      isMounted = false;
    };
  }, [periodKey, currentUser, selectedMonth]);

  // Check matching income transactions in transactions list
  const hasMatchingSalaryTx = useMemo(() => {
    if (!transactions || transactions.length === 0) return false;
    return transactions.some((t) => {
      if (t.type !== "income") return false;
      const isSalaryCat = t.category === "เงินเดือน";
      const nameMatch = t.merchantName?.includes(`เงินเดือน ${selectedMonth}`);
      return isSalaryCat && nameMatch;
    });
  }, [transactions, selectedMonth]);

  const hasMatchingMealTx = useMemo(() => {
    if (!transactions || transactions.length === 0) return false;
    return transactions.some((t) => {
      if (t.type !== "income") return false;
      const isMealCat = t.category === "สวัสดิการอาหาร";
      const nameMatch = t.merchantName?.includes(`ค่าข้าวเข้าบัตรพนักงาน ${selectedMonth}`);
      return isMealCat && nameMatch;
    });
  }, [transactions, selectedMonth]);

  const isSalaryAlreadyRecorded = recordStatus.salaryRecorded || hasMatchingSalaryTx;
  const isMealAlreadyRecorded = recordStatus.mealRecorded || hasMatchingMealTx;

  // Days in month helper
  const totalDaysInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return 30;
    const [year, month] = selectedMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  // Quick summary inputs
  const [workDaysInput, setWorkDaysInput] = useState<number>(22);
  const [ot15HoursInput, setOt15HoursInput] = useState<number>(10);
  const [ot10HoursInput, setOt10HoursInput] = useState<number>(0);
  const [ot30HoursInput, setOt30HoursInput] = useState<number>(0);
  const [otMealDaysInput, setOtMealDaysInput] = useState<number>(2); // days with OT >= 2.5
  const [nightShiftDaysInput, setNightShiftDaysInput] = useState<number>(0);

  // Leave tally summary
  const [personalLeaveDays, setPersonalLeaveDays] = useState<number>(0);
  const [sickLeaveDays, setSickLeaveDays] = useState<number>(0);
  const [vacationLeaveDays, setVacationLeaveDays] = useState<number>(0);
  const [publicHolidayCount, setPublicHolidayCount] = useState<number>(0);
  const [shiftedHolidayCount, setShiftedHolidayCount] = useState<number>(0);

  // Daily calendar attendance state
  const [useDailyLog, setUseDailyLog] = useState<boolean>(false);
  const [dailyLogs, setDailyLogs] = useState<DailyAttendance[]>([]);

  // Custom Earnings & Custom Deductions List State (+KPI *ตักจับงานขาด, -KPI *ส่งงานเกิน, ฯลฯ)
  const [customEarnings, setCustomEarnings] = useState<CustomAdjustmentItem[]>([]);
  const [customDeductions, setCustomDeductions] = useState<CustomAdjustmentItem[]>([]);

  const [newEarningName, setNewEarningName] = useState<string>("");
  const [newEarningAmount, setNewEarningAmount] = useState<string>("");
  const [newDeductionName, setNewDeductionName] = useState<string>("");
  const [newDeductionAmount, setNewDeductionAmount] = useState<string>("");

  // Holiday Input & Filter states in config modal
  const [newHolidayDate, setNewHolidayDate] = useState<string>("");
  const [newHolidayName, setNewHolidayName] = useState<string>("");
  const [holidayYearFilter, setHolidayYearFilter] = useState<string>("2026");

  // Editing Holiday state
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [editHolidayDate, setEditHolidayDate] = useState<string>("");
  const [editHolidayName, setEditHolidayName] = useState<string>("");

  // Selected wallet for saving salary & meal card transactions
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedMealWalletId, setSelectedMealWalletId] = useState<string>("");
  const [recordedSuccess, setRecordedSuccess] = useState<boolean>(false);
  const [recordedMealSuccess, setRecordedMealSuccess] = useState<boolean>(false);

  // Auto sync wallet state with config or wallets list
  useEffect(() => {
    if (wallets.length === 0) return;

    if (config.salaryWalletId && wallets.some((w) => w.id === config.salaryWalletId)) {
      setSelectedWalletId(config.salaryWalletId);
    } else if (!selectedWalletId || !wallets.some((w) => w.id === selectedWalletId)) {
      setSelectedWalletId(wallets[0]?.id || "");
    }

    if (config.mealWalletId && wallets.some((w) => w.id === config.mealWalletId)) {
      setSelectedMealWalletId(config.mealWalletId);
    } else if (!selectedMealWalletId || !wallets.some((w) => w.id === selectedMealWalletId)) {
      const foundCardWallet = wallets.find((w) =>
        w.name.includes("บัตรพนักงาน") ||
        w.name.includes("ค่าข้าว") ||
        w.name.includes("บัตรอาหาร") ||
        w.name.toLowerCase().includes("food")
      );
      setSelectedMealWalletId(foundCardWallet?.id || wallets[0]?.id || "");
    }
  }, [config.salaryWalletId, config.mealWalletId, wallets]);

  // Cloud sync status state
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "error">("synced");

  // Load config from Firestore on mount / user change
  useEffect(() => {
    let isMounted = true;
    async function loadSalaryConfigFromFirestore() {
      if (!currentUser) return;
      const uId = currentUser.toLowerCase().trim();
      try {
        const configRef = doc(db, "users", uId, "salary_config", "config");
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const cloudData = snap.data();
          if (isMounted && cloudData) {
            const mergedConfig: SalaryConfig = {
              ...DEFAULT_SALARY_CONFIG,
              ...cloudData,
              publicHolidays:
                cloudData.publicHolidays && cloudData.publicHolidays.length > 0
                  ? cloudData.publicHolidays
                  : DEFAULT_HOLIDAYS,
            };
            setConfig(mergedConfig);
            localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(mergedConfig));
          }
        } else {
          // If not in Firestore yet, push current local config
          const saved = localStorage.getItem(`salary_config_${currentUser || "default"}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              await setDoc(configRef, cleanObjectForFirestore(parsed));
            } catch (e) {
              console.error(e);
            }
          }
        }
      } catch (err) {
        console.error("Error loading salary config from Firestore:", err);
      }
    }
    loadSalaryConfigFromFirestore();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Storage key for custom earnings and deductions per month/period
  const customAdjustmentsStorageKey = useMemo(() => {
    return `salary_custom_adj_${currentUser || "default"}_${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
  }, [currentUser, selectedMonth, isDecember, decemberPeriod]);

  // Load custom earnings & deductions from Firestore with localStorage fallback
  useEffect(() => {
    if (!selectedMonth) return;
    let isMounted = true;

    async function fetchCustomAdjustments() {
      const savedStr = localStorage.getItem(customAdjustmentsStorageKey);
      let localEarnings: CustomAdjustmentItem[] = [];
      let localDeductions: CustomAdjustmentItem[] = [];

      if (savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          if (parsed && Array.isArray(parsed.earnings)) localEarnings = parsed.earnings;
          if (parsed && Array.isArray(parsed.deductions)) localDeductions = parsed.deductions;
        } catch (e) {
          console.error("Failed to parse custom adjustments:", e);
        }
      } else {
        localEarnings = [];
        localDeductions = [];
      }

      if (currentUser) {
        const uId = currentUser.toLowerCase().trim();
        const periodKey = `${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
        try {
          const docRef = doc(db, "users", uId, "salary_custom_adjustments", periodKey);
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            const cloudData = snap.data();
            const earnings = Array.isArray(cloudData.earnings) ? cloudData.earnings : [];
            const deductions = Array.isArray(cloudData.deductions) ? cloudData.deductions : [];
            setCustomEarnings(earnings);
            setCustomDeductions(deductions);
            localStorage.setItem(customAdjustmentsStorageKey, JSON.stringify({ earnings, deductions }));
            return;
          }
        } catch (e) {
          console.error("Failed to load custom adjustments from Firestore:", e);
        }
      }

      if (isMounted) {
        setCustomEarnings(localEarnings);
        setCustomDeductions(localDeductions);
      }
    }

    fetchCustomAdjustments();

    return () => {
      isMounted = false;
    };
  }, [customAdjustmentsStorageKey, selectedMonth, currentUser, isDecember, decemberPeriod]);

  // Helper to persist custom earnings & deductions to localStorage AND Firestore
  const saveCustomAdjustments = async (
    updatedEarnings: CustomAdjustmentItem[],
    updatedDeductions: CustomAdjustmentItem[]
  ) => {
    setCustomEarnings(updatedEarnings);
    setCustomDeductions(updatedDeductions);

    const dataToSave = {
      earnings: updatedEarnings,
      deductions: updatedDeductions,
    };
    localStorage.setItem(customAdjustmentsStorageKey, JSON.stringify(dataToSave));

    if (currentUser && selectedMonth) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        const periodKey = `${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
        await setDoc(doc(db, "users", uId, "salary_custom_adjustments", periodKey), {
          earnings: cleanObjectForFirestore(updatedEarnings),
          deductions: cleanObjectForFirestore(updatedDeductions),
          updatedAt: new Date().toISOString(),
        });
        setSyncStatus("synced");
      } catch (e) {
        console.error("Failed to sync custom adjustments to Firestore:", e);
        setSyncStatus("error");
      }
    }
  };

  // Preset Quick Add Handlers for Custom Earnings & Deductions
  const handleAddPresetEarning = (name: string, amount: number) => {
    const newItem: CustomAdjustmentItem = {
      id: `ce_${Date.now()}`,
      name,
      amount,
    };
    const updated = [...customEarnings, newItem];
    saveCustomAdjustments(updated, customDeductions);
  };

  const handleAddPresetDeduction = (name: string, amount: number) => {
    const newItem: CustomAdjustmentItem = {
      id: `cd_${Date.now()}`,
      name,
      amount,
    };
    const updated = [...customDeductions, newItem];
    saveCustomAdjustments(customEarnings, updated);
  };

  // Handlers for Custom Earnings & Deductions
  const handleAddCustomEarning = () => {
    const trimmedName = newEarningName.trim();
    if (!trimmedName) {
      alert("กรุณากรอกชื่อรายการรับเพิ่มเติม");
      return;
    }
    const amt = Number(newEarningAmount) || 0;
    const newItem: CustomAdjustmentItem = {
      id: `ce_${Date.now()}`,
      name: trimmedName,
      amount: amt,
    };
    const updated = [...customEarnings, newItem];
    saveCustomAdjustments(updated, customDeductions);

    // Save to history list for autocomplete search
    if (!earningHistory.includes(trimmedName)) {
      const updatedHistory = [trimmedName, ...earningHistory].slice(0, 20);
      setEarningHistory(updatedHistory);
      localStorage.setItem(`salary_earning_history_${currentUser || "default"}`, JSON.stringify(updatedHistory));
    }

    setNewEarningName("");
    setNewEarningAmount("");
    setShowEarningSuggestions(false);
  };

  const handleDeleteCustomEarning = (id: string) => {
    const updated = customEarnings.filter((item) => item.id !== id);
    saveCustomAdjustments(updated, customDeductions);
  };

  const handleAddCustomDeduction = () => {
    const trimmedName = newDeductionName.trim();
    if (!trimmedName) {
      alert("กรุณากรอกชื่อรายการหักเพิ่มเติม");
      return;
    }
    const amt = Number(newDeductionAmount) || 0;
    const newItem: CustomAdjustmentItem = {
      id: `cd_${Date.now()}`,
      name: trimmedName,
      amount: amt,
    };
    const updated = [...customDeductions, newItem];
    saveCustomAdjustments(customEarnings, updated);

    // Save to deduction history list for autocomplete search
    if (!deductionHistory.includes(trimmedName)) {
      const updatedHistory = [trimmedName, ...deductionHistory].slice(0, 20);
      setDeductionHistory(updatedHistory);
      localStorage.setItem(`salary_deduction_history_${currentUser || "default"}`, JSON.stringify(updatedHistory));
    }

    setNewDeductionName("");
    setNewDeductionAmount("");
    setShowDeductionSuggestions(false);
  };

  const handleDeleteCustomDeduction = (id: string) => {
    const updated = customDeductions.filter((item) => item.id !== id);
    saveCustomAdjustments(customEarnings, updated);
  };

  // Save config to local storage and Firestore
  const handleSaveConfig = async (newConfig: SalaryConfig) => {
    setConfig(newConfig);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConfig));
    setShowConfigModal(false);

    if (currentUser) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_config", "config"), cleanObjectForFirestore(newConfig));
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error syncing config to Firestore:", err);
        setSyncStatus("error");
      }
    }
  };

  // Add Public Holiday to config
  const handleAddPublicHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      alert("กรุณาระบุวันที่และชื่อวันหยุดนักขัตฤกษ์");
      return;
    }
    const yearOfNew = newHolidayDate.split("-")[0];
    const updatedHolidays = [
      ...config.publicHolidays,
      { id: `h_${Date.now()}`, dateStr: newHolidayDate, name: newHolidayName.trim() }
    ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const newConf = { ...config, publicHolidays: updatedHolidays };
    setConfig(newConf);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConf));
    setNewHolidayDate("");
    setNewHolidayName("");
    if (yearOfNew) setHolidayYearFilter(yearOfNew);

    if (currentUser) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_config", "config"), cleanObjectForFirestore(newConf));
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error syncing holiday to Firestore:", err);
        setSyncStatus("error");
      }
    }
  };

  // Start Edit Holiday
  const handleStartEditHoliday = (h: PublicHolidayItem) => {
    setEditingHolidayId(h.id);
    setEditHolidayDate(h.dateStr);
    setEditHolidayName(h.name);
  };

  // Cancel Edit Holiday
  const handleCancelEditHoliday = () => {
    setEditingHolidayId(null);
    setEditHolidayDate("");
    setEditHolidayName("");
  };

  // Save Edited Holiday
  const handleSaveEditHoliday = async (id: string) => {
    if (!editHolidayDate || !editHolidayName.trim()) {
      alert("กรุณาระบุวันที่และชื่อวันหยุดนักขัตฤกษ์");
      return;
    }
    const updatedHolidays = config.publicHolidays
      .map((h) => (h.id === id ? { ...h, dateStr: editHolidayDate, name: editHolidayName.trim() } : h))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const newConf = { ...config, publicHolidays: updatedHolidays };
    setConfig(newConf);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConf));
    setEditingHolidayId(null);

    if (currentUser) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_config", "config"), cleanObjectForFirestore(newConf));
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error syncing edited holiday to Firestore:", err);
        setSyncStatus("error");
      }
    }
  };

  // Delete Public Holiday
  const handleDeletePublicHoliday = async (id: string) => {
    const updatedHolidays = config.publicHolidays.filter((h) => h.id !== id);
    const newConf = { ...config, publicHolidays: updatedHolidays };
    setConfig(newConf);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConf));

    if (currentUser) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_config", "config"), cleanObjectForFirestore(newConf));
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error syncing deleted holiday to Firestore:", err);
        setSyncStatus("error");
      }
    }
  };

  // Import Official Preset Holidays by Year (e.g. 2025, 2026, 2027, 2028...)
  const handleImportPresetHolidaysByYear = async (yearStr: string) => {
    const yearNum = parseInt(yearStr, 10) || 2027;
    const presetToImport = getPresetHolidaysForYear(yearNum);

    // Filter out existing holidays from that year, then merge with presetToImport
    const otherYearHolidays = config.publicHolidays.filter((h) => !h.dateStr.startsWith(`${yearStr}-`));
    const updatedHolidays = [...otherYearHolidays, ...presetToImport].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const newConf = { ...config, publicHolidays: updatedHolidays };
    setConfig(newConf);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConf));
    setHolidayYearFilter(yearStr);

    if (currentUser) {
      setSyncStatus("saving");
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_config", "config"), cleanObjectForFirestore(newConf));
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error syncing preset holidays to Firestore:", err);
        setSyncStatus("error");
      }
    }
    alert(`⚡ นำเข้าข้อมูลวันหยุดประจำปี ${yearStr} (${yearNum + 543}) เรียบร้อยแล้ว! (${presetToImport.length} รายการ)`);
  };

  // Filtered Holidays according to chosen year filter
  const filteredHolidays = useMemo(() => {
    if (holidayYearFilter === "all") {
      return [...config.publicHolidays].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }
    return config.publicHolidays
      .filter((h) => h.dateStr.startsWith(`${holidayYearFilter}-`))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [config.publicHolidays, holidayYearFilter]);

  // Storage key helper for current selected month & period
  const currentMonthStorageKey = useMemo(() => {
    return `salary_daily_logs_${currentUser || "default"}_${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
  }, [currentUser, selectedMonth, isDecember, decemberPeriod]);

  // Generate / Load Daily Attendance logs from Firestore & localStorage
  useEffect(() => {
    if (!selectedMonth) return;
    let isMounted = true;

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    let startDay = 1;
    let endDay = new Date(year, month, 0).getDate();

    if (month === 12) {
      if (decemberPeriod === "p1") {
        startDay = 1;
        endDay = 20;
      } else if (decemberPeriod === "p2") {
        startDay = 21;
        endDay = 31;
      }
    }

    async function fetchDailyLogs() {
      let savedMap: Record<number, DailyAttendance> = {};
      let loadedFromCloud = false;

      if (currentUser) {
        const uId = currentUser.toLowerCase().trim();
        const periodKey = `${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
        try {
          const docRef = doc(db, "users", uId, "salary_daily_logs", periodKey);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const cloudData = snap.data();
            if (cloudData && Array.isArray(cloudData.logs)) {
              cloudData.logs.forEach((item: DailyAttendance) => {
                if (item && typeof item.day === "number") {
                  savedMap[item.day] = item;
                }
              });
              loadedFromCloud = true;
              localStorage.setItem(currentMonthStorageKey, JSON.stringify(cloudData.logs));
            }
          }
        } catch (e) {
          console.error("Failed to load daily logs from Firestore:", e);
        }
      }

      if (!loadedFromCloud) {
        const savedStr = localStorage.getItem(currentMonthStorageKey);
        if (savedStr) {
          try {
            const parsedArr: DailyAttendance[] = JSON.parse(savedStr);
            if (Array.isArray(parsedArr)) {
              parsedArr.forEach((item) => {
                if (item && typeof item.day === "number") {
                  savedMap[item.day] = item;
                }
              });
            }
          } catch (e) {
            console.error("Failed to parse saved daily logs:", e);
          }
        }
      }

      const logs: DailyAttendance[] = [];
      for (let d = startDay; d <= endDay; d++) {
        const dateStr = `${yearStr}-${String(monthStr).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
        const isSun = dayOfWeek === 0;
        const isSat = dayOfWeek === 6;

        const matchingHoliday = config.publicHolidays.find((h) => h.dateStr === dateStr);
        const workingSats = config.workingSaturdays || DEFAULT_WORKING_SATURDAYS;
        const isWorkingSat = isSat && workingSats.includes(dateStr);

        let initialStatus: WorkStatus = "work";
        if (matchingHoliday) {
          initialStatus = "public_holiday";
        } else if (isSun) {
          initialStatus = "off";
        } else if (isSat && !isWorkingSat) {
          initialStatus = "off"; // Non-working Saturday (เสาร์เว้นเสาร์)
        }

        const savedItem = savedMap[d];
        if (savedItem && (!savedItem.dateStr || savedItem.dateStr === dateStr)) {
          logs.push({
            ...savedItem,
            day: d,
            dateStr,
            note: savedItem.note ?? (matchingHoliday ? matchingHoliday.name : undefined),
          });
        } else {
          logs.push({
            day: d,
            dateStr,
            status: initialStatus,
            isNightShift: false,
            ot15Hours: 0,
            ot10Hours: 0,
            ot30Hours: 0,
            note: matchingHoliday ? matchingHoliday.name : undefined,
          });
        }
      }

      if (isMounted) {
        setDailyLogs(logs);
      }
    }

    fetchDailyLogs();

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, decemberPeriod, config.publicHolidays, currentMonthStorageKey, currentUser, isDecember]);

  // Guard dailyLogs matching selected month before persisting to avoid month-change race conditions
  const isDailyLogsMatchingSelectedMonth = useMemo(() => {
    if (!dailyLogs || dailyLogs.length === 0) return false;
    return dailyLogs[0]?.dateStr?.startsWith(selectedMonth) ?? false;
  }, [dailyLogs, selectedMonth]);

  // Persist dailyLogs to localStorage AND Firestore (with 400ms debounce for smooth editing)
  useEffect(() => {
    if (!selectedMonth || dailyLogs.length === 0 || !isDailyLogsMatchingSelectedMonth) return;
    localStorage.setItem(currentMonthStorageKey, JSON.stringify(dailyLogs));

    if (currentUser) {
      setSyncStatus("saving");
      const timer = setTimeout(async () => {
        try {
          const uId = currentUser.toLowerCase().trim();
          const periodKey = `${selectedMonth}_${isDecember ? decemberPeriod : "full"}`;
          await setDoc(doc(db, "users", uId, "salary_daily_logs", periodKey), {
            logs: cleanObjectForFirestore(dailyLogs),
            updatedAt: new Date().toISOString(),
          });
          setSyncStatus("synced");
        } catch (e) {
          console.error("Error saving daily logs to Firestore:", e);
          setSyncStatus("error");
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [dailyLogs, currentMonthStorageKey, selectedMonth, currentUser, isDecember, decemberPeriod]);

  // Re-calculate totals from daily logs automatically
  useEffect(() => {
    if (!dailyLogs || dailyLogs.length === 0) return;
    let totalAllowanceDays = 0; // Days that qualify for daily travel allowance (50฿) & meal allowance (47฿)
    let ot15 = 0;
    let ot10 = 0;
    let ot30 = 0;
    let otMealDays = 0;
    let nightShiftDays = 0;

    let pLeave = 0;
    let sLeave = 0;
    let vLeave = 0;
    let pubHoliday = 0;
    let shiftHoliday = 0;

    dailyLogs.forEach((log) => {
      const isNormalWork = log.status === "work";
      const isHolidayOrOff = log.status === "off" || log.status === "public_holiday" || log.status === "shifted_holiday";
      const totalOtHoursInDay = (log.ot10Hours || 0) + (log.ot15Hours || 0) + (log.ot30Hours || 0);
      const workedOnHoliday = isHolidayOrOff && totalOtHoursInDay > 0;

      // Rule: Travel allowance & Meal allowance are earned on normal work days AND when coming in to work/OT on holidays/off days!
      // Leave days (ลากิจ/ลาป่วย/ลาพักร้อน) and unworked holiday days DO NOT get travel or meal allowance.
      if (isNormalWork || workedOnHoliday) {
        totalAllowanceDays++;
      }

      if (log.status === "personal_leave") pLeave++;
      if (log.status === "sick_leave") sLeave++;
      if (log.status === "vacation_leave") vLeave++;
      if (log.status === "public_holiday") pubHoliday++;
      if (log.status === "shifted_holiday") shiftHoliday++;

      if (log.isNightShift) nightShiftDays++;
      ot15 += log.ot15Hours || 0;
      ot10 += log.ot10Hours || 0;
      ot30 += log.ot30Hours || 0;

      // OT meal rule: OT 1.5 + OT 3.0 >= 2.5 hours
      const totalOtInDay = (log.ot15Hours || 0) + (log.ot30Hours || 0);
      if (totalOtInDay >= 2.5) {
        otMealDays++;
      }
    });

    setWorkDaysInput(totalAllowanceDays);
    setOt15HoursInput(ot15);
    setOt10HoursInput(ot10);
    setOt30HoursInput(ot30);
    setOtMealDaysInput(otMealDays);
    setNightShiftDaysInput(nightShiftDays);

    setPersonalLeaveDays(pLeave);
    setSickLeaveDays(sLeave);
    setVacationLeaveDays(vLeave);
    setPublicHolidayCount(pubHoliday);
    setShiftedHolidayCount(shiftHoliday);
  }, [dailyLogs]);

  // Effective Base Salary considering Salary Raises Schedule
  const effectiveBaseSalary = useMemo(() => {
    let currentBase = config.baseSalary;
    const raises = config.salaryRaises || [];
    if (raises.length > 0) {
      const sorted = [...raises].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
      for (const r of sorted) {
        if (selectedMonth >= r.effectiveMonth) {
          if (r.type === "amount") {
            currentBase += Number(r.value) || 0;
          } else if (r.type === "percent") {
            currentBase += currentBase * ((Number(r.value) || 0) / 100);
          }
        }
      }
    }
    return Math.round(currentBase);
  }, [config.baseSalary, config.salaryRaises, selectedMonth]);

  // Current selected period payday information
  const currentPaydayInfo = useMemo(() => {
    if (!selectedMonth) return null;
    const [yStr, mStr] = selectedMonth.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    return getPaydayInfo(y, m, isDecember ? decemberPeriod : "full", config.publicHolidays, config.workingSaturdays || DEFAULT_WORKING_SATURDAYS);
  }, [selectedMonth, isDecember, decemberPeriod, config.publicHolidays, config.workingSaturdays]);

  // Calculated default social security
  const defaultSocialSecurity = useMemo(() => {
    let periodWageBase = effectiveBaseSalary;
    if (config.includeAllowancesInSocialSecurity) {
      const posAllowance = config.positionAllowanceMonthly || 0;
      const travelAllowance = (config.travelAllowanceDaily || 0) * (workDaysInput || 22);
      periodWageBase += posAllowance + travelAllowance;
    }

    if (isDecember) {
      if (decemberPeriod === "p1") periodWageBase = (periodWageBase / 31) * 20;
      else if (decemberPeriod === "p2") periodWageBase = (periodWageBase / 31) * 11;
    }
    if (isDecember && decemberPeriod === "p2") return 0;
    const rawSocSec = periodWageBase * (config.socialSecurityPercent / 100);
    const maxCap = config.socialSecurityMaxCap ?? 750;
    return Math.min(maxCap, Math.round(rawSocSec));
  }, [
    effectiveBaseSalary,
    config.includeAllowancesInSocialSecurity,
    config.positionAllowanceMonthly,
    config.travelAllowanceDaily,
    workDaysInput,
    config.socialSecurityPercent,
    config.socialSecurityMaxCap,
    isDecember,
    decemberPeriod,
  ]);

  // Sync direct monthly inputs when config or period changes
  useEffect(() => {
    setKpiAllowanceInput(config.kpiAllowanceMonthly);
    setPositionAllowanceInput(config.positionAllowanceMonthly);
    setOtherIncomeInput(config.otherIncomeMonthly);
    setStudentLoanInput(config.studentLoanDeduction);
    setSocialSecurityInput(defaultSocialSecurity);
  }, [
    config.kpiAllowanceMonthly,
    config.positionAllowanceMonthly,
    config.otherIncomeMonthly,
    config.studentLoanDeduction,
    defaultSocialSecurity,
    periodKey,
  ]);

  // Main Salary Calculations
  const calcResults = useMemo(() => {
    // OT 1.0 Hourly Rate = Effective Base Salary / 30 / 8
    const ot1Rate = effectiveBaseSalary / 30 / 8;
    const ot15Rate = ot1Rate * 1.5;
    const ot3Rate = ot1Rate * 3.0;

    // Base salary for period
    let periodBaseSalary = effectiveBaseSalary;
    let periodDaysCount = totalDaysInSelectedMonth;

    if (isDecember) {
      if (decemberPeriod === "p1") {
        // งวด 1: วันที่ 1-20 ธันวาคม (20 วัน) คำนวณจาก ฐานเงินเดือน / 31 * 20
        periodBaseSalary = (effectiveBaseSalary / 31) * 20;
        periodDaysCount = 20;
      } else if (decemberPeriod === "p2") {
        // งวด 2: วันที่ 21-31 ธันวาคม (11 วัน) คำนวณจาก ฐานเงินเดือน / 31 * 11
        periodBaseSalary = (effectiveBaseSalary / 31) * 11;
        periodDaysCount = 11;
      } else {
        periodBaseSalary = effectiveBaseSalary;
        periodDaysCount = 31;
      }
    }

    // OT Earnings
    const ot15Pay = ot15HoursInput * ot15Rate;
    const ot10Pay = ot10HoursInput * ot1Rate;
    const ot30Pay = ot30HoursInput * ot3Rate;
    const totalOTPay = ot15Pay + ot10Pay + ot30Pay;

    // Daily Allowances
    const mealPay = workDaysInput * config.mealAllowanceDaily;
    const travelPay = workDaysInput * config.travelAllowanceDaily;
    const otMealPay = otMealDaysInput * config.otMealAllowanceDaily;
    const nightShiftPay = nightShiftDaysInput * config.nightShiftAllowanceDaily;

    const separateMealPay = config.separateMealPay !== false;

    // Monthly fixed allowances (หรือให้กรอกเพิ่มเองสำหรับ KPI, ค่าตำแหน่ง และ รายได้เพิ่มเติมอื่นๆ)
    const kpiPay = (isDecember && decemberPeriod === "p2") ? 0 : kpiAllowanceInput;
    const housingPay = (isDecember && decemberPeriod === "p2") ? 0 : config.housingAllowanceMonthly;
    const positionPay = (isDecember && decemberPeriod === "p2") ? 0 : positionAllowanceInput;
    const otherIncomePay = (isDecember && decemberPeriod === "p2") ? 0 : otherIncomeInput;

    // New Additional Earnings
    const diligentPay = (isDecember && decemberPeriod === "p2") ? 0 : config.diligentAllowance;
    const vacationRefundPay = (isDecember && decemberPeriod === "p2") ? 0 : config.vacationRefund;
    const seniorityPay = (isDecember && decemberPeriod === "p2") ? 0 : config.seniorityAllowance;
    const specialDutyPay = (isDecember && decemberPeriod === "p2") ? 0 : config.specialDutyAllowance;
    const certificatePay = (isDecember && decemberPeriod === "p2") ? 0 : config.certificateAllowance;

    // December Bonus: Paid in December Period 1 or Full month
    let bonusPay = 0;
    if (isDecember && (decemberPeriod === "p1" || decemberPeriod === "full")) {
      bonusPay = config.annualBonus;
    }

    // Dynamic Custom Earnings and Deductions
    const totalCustomEarnings = customEarnings.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    const totalCustomDeductions = customDeductions.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

    // Gross Cash Earnings (excludes meal allowance when separateMealPay is enabled)
    const grossSalaryCash = 
      periodBaseSalary + 
      totalOTPay + 
      (separateMealPay ? 0 : mealPay) + 
      travelPay + 
      otMealPay + 
      nightShiftPay + 
      kpiPay + 
      housingPay + 
      positionPay + 
      otherIncomePay + 
      diligentPay + 
      vacationRefundPay + 
      seniorityPay + 
      specialDutyPay + 
      certificatePay + 
      bonusPay + 
      totalCustomEarnings;

    // Total Gross Earnings (all allowances combined)
    const grossEarnings = grossSalaryCash + (separateMealPay ? mealPay : 0);

    // Deductions ( editable )
    const studentLoan = (isDecember && decemberPeriod === "p2") ? 0 : studentLoanInput;
    const socialSecurity = (isDecember && decemberPeriod === "p2") ? 0 : socialSecurityInput;

    const kpiDeductionVal = config.kpiDeduction;
    const otherDeductionVal = config.otherDeduction;

    const totalDeductions = studentLoan + socialSecurity + kpiDeductionVal + otherDeductionVal + totalCustomDeductions;

    // Net Payable Cash Salary (เงินเดือนสุทธิที่ได้รับ)
    const netSalary = Math.max(0, grossSalaryCash - totalDeductions);

    return {
      ot1Rate,
      ot15Rate,
      ot3Rate,
      periodBaseSalary,
      periodDaysCount,
      ot15Pay,
      ot10Pay,
      ot30Pay,
      totalOTPay,
      separateMealPay,
      mealPay,
      travelPay,
      otMealPay,
      nightShiftPay,
      kpiPay,
      housingPay,
      positionPay,
      otherIncomePay,
      diligentPay,
      vacationRefundPay,
      seniorityPay,
      specialDutyPay,
      certificatePay,
      bonusPay,
      totalCustomEarnings,
      totalCustomDeductions,
      grossSalaryCash,
      grossEarnings,
      studentLoan,
      socialSecurity,
      kpiDeductionVal,
      otherDeductionVal,
      totalDeductions,
      netSalary,
    };
  }, [
    config,
    isDecember,
    decemberPeriod,
    totalDaysInSelectedMonth,
    workDaysInput,
    ot15HoursInput,
    ot10HoursInput,
    ot30HoursInput,
    otMealDaysInput,
    nightShiftDaysInput,
    customEarnings,
    customDeductions,
    effectiveBaseSalary,
    kpiAllowanceInput,
    positionAllowanceInput,
    otherIncomeInput,
    studentLoanInput,
    socialSecurityInput,
  ]);

  // Salary Raise Handlers for Settings Modal
  const handleAddSalaryRaise = () => {
    if (!newRaiseMonth || !newRaiseValue) return;
    const val = parseFloat(newRaiseValue);
    if (isNaN(val) || val <= 0) return;

    const newRaise: SalaryRaiseItem = {
      id: Date.now().toString(),
      effectiveMonth: newRaiseMonth,
      type: newRaiseType,
      value: val,
      note: newRaiseNote.trim() || undefined,
    };

    const updatedRaises = [...(config.salaryRaises || []), newRaise];
    const newConfig = { ...config, salaryRaises: updatedRaises };
    setConfig(newConfig);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConfig));

    setNewRaiseValue("");
    setNewRaiseNote("");
  };

  const handleDeleteSalaryRaise = (raiseId: string) => {
    const updatedRaises = (config.salaryRaises || []).filter((r) => r.id !== raiseId);
    const newConfig = { ...config, salaryRaises: updatedRaises };
    setConfig(newConfig);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConfig));
  };

  // Annual Overview Data Calculation (Dynamic forecast based on historical OT average, calendar working days, and recorded daily logs)
  const annualOverviewData = useMemo(() => {
    const year = annualSelectedYear;
    const months = [
      { num: "01", name: "ม.ค." },
      { num: "02", name: "ก.พ." },
      { num: "03", name: "มี.ค." },
      { num: "04", name: "เม.ย." },
      { num: "05", name: "พ.ค." },
      { num: "06", name: "มิ.ย." },
      { num: "07", name: "ก.ค." },
      { num: "08", name: "ส.ค." },
      { num: "09", name: "ก.ย." },
      { num: "10", name: "ต.ค." },
      { num: "11", name: "พ.ย." },
      { num: "12", name: "ธ.ค." },
    ];

    const uId = currentUser ? currentUser.toLowerCase().trim() : "default";

    // Helper to calculate exact working days in a specific month according to calendar
    const getWorkingDaysInMonth = (y: number, m: number, holidays: PublicHolidayItem[], workingSats: string[]) => {
      const totalDays = new Date(y, m, 0).getDate();
      let workDays = 0;
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const date = new Date(y, m - 1, d);
        const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
        const isSun = dayOfWeek === 0;
        const isSat = dayOfWeek === 6;
        const isHoliday = holidays.some((h) => h.dateStr === dateStr);
        const isWorkingSat = isSat && workingSats.includes(dateStr);

        if (!isHoliday && !isSun && (!isSat || isWorkingSat)) {
          workDays++;
        }
      }
      return workDays;
    };

    // 1. Compute historical OT baseline from live calculated month or saved daily attendance logs
    let historicalOTSum = calcResults ? calcResults.totalOTPay : 0;
    let historicalOTCount = calcResults && calcResults.totalOTPay > 0 ? 1 : 0;

    months.forEach((m) => {
      const monthKey = `${year}-${m.num}`;
      const savedDailyLogsStr = localStorage.getItem(`salary_daily_logs_${uId}_${monthKey}_full`);
      if (savedDailyLogsStr) {
        try {
          const parsedArr: DailyAttendance[] = JSON.parse(savedDailyLogsStr);
          if (Array.isArray(parsedArr) && parsedArr.length > 0) {
            let mOt15 = 0;
            let mOt10 = 0;
            let mOt30 = 0;
            parsedArr.forEach((item) => {
              mOt15 += Number(item.ot15Hours) || 0;
              mOt10 += Number(item.ot10Hours) || 0;
              mOt30 += Number(item.ot30Hours) || 0;
            });
            const otRate = config.baseSalary / 30 / 8;
            const logOTPay = Math.round((mOt15 * 1.5 + mOt10 * 1.0 + mOt30 * 3.0) * otRate);
            if (logOTPay > 0) {
              historicalOTSum += logOTPay;
              historicalOTCount++;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    const averageHistoricalOTPay = historicalOTCount > 0 ? Math.round(historicalOTSum / historicalOTCount) : 0;

    let totalNet = 0;
    let totalOT = 0;
    let totalMeal = 0;
    let totalGross = 0;
    let recordedCount = 0;

    const list = months.map((m) => {
      const monthKey = `${year}-${m.num}`;

      // Calculate effective base salary for this specific month in the year (including raises)
      let monthBaseSalary = config.baseSalary;
      const raises = config.salaryRaises || [];
      if (raises.length > 0) {
        const sorted = [...raises].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
        for (const r of sorted) {
          if (monthKey >= r.effectiveMonth) {
            if (r.type === "amount") monthBaseSalary += Number(r.value) || 0;
            else if (r.type === "percent") monthBaseSalary += monthBaseSalary * ((Number(r.value) || 0) / 100);
          }
        }
      }
      monthBaseSalary = Math.round(monthBaseSalary);

      // Check recorded status across all potential period suffixes (_full, _p1, _p2)
      const pKeys = [`${monthKey}_full`, `${monthKey}_p1`, `${monthKey}_p2`];
      let isRecorded = false;
      let recordedStatusAmt = 0;
      let recordedDate = "";

      for (const pk of pKeys) {
        const keyLocal = `salary_record_status_${uId}_${pk}`;
        const keyDefault = `salary_record_status_default_${pk}`;
        const savedStr = localStorage.getItem(keyLocal) || localStorage.getItem(keyDefault);
        if (savedStr) {
          try {
            const parsed = JSON.parse(savedStr);
            if (parsed.salaryRecorded) {
              isRecorded = true;
              recordedStatusAmt += Number(parsed.salaryAmount) || 0;
              if (parsed.salaryRecordedAt) recordedDate = parsed.salaryRecordedAt;
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Calculate official payday for this month
      const monthPayday = getPaydayInfo(year, parseInt(m.num, 10), "full", config.publicHolidays, config.workingSaturdays || DEFAULT_WORKING_SATURDAYS);

      // Check transactions array for matching salary income
      const matchingSalaryTxs = (transactions || []).filter((t) => {
        if (t.type !== "income") return false;
        const isSalaryCategory = t.category === "เงินเดือน" || t.category?.includes("เงินเดือน");
        if (!isSalaryCategory) return false;

        const textToSearch = `${t.merchantName || ""} ${t.note || ""}`;
        if (textToSearch.includes(monthKey)) {
          return true;
        }

        const otherMonthMatch = textToSearch.match(/\b20\d\d-(0[1-9]|1[0-2])\b/);
        if (otherMonthMatch && otherMonthMatch[0] !== monthKey) {
          return false;
        }

        return t.date === monthPayday.dateStr;
      });

      const txSalarySum = matchingSalaryTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      if (matchingSalaryTxs.length > 0) {
        isRecorded = true;
      }

      const finalRecordedAmt = txSalarySum > 0 ? txSalarySum : recordedStatusAmt;

      // Check meal transactions
      const matchingMealTxs = (transactions || []).filter((t) => {
        if (t.type !== "income") return false;
        const isMealCat = t.category === "สวัสดิการอาหาร" || t.category?.includes("อาหาร") || t.category?.includes("ค่าข้าว");
        if (!isMealCat) return false;

        const textToSearch = `${t.merchantName || ""} ${t.note || ""}`;
        if (textToSearch.includes(monthKey)) {
          return true;
        }

        const otherMonthMatch = textToSearch.match(/\b20\d\d-(0[1-9]|1[0-2])\b/);
        if (otherMonthMatch && otherMonthMatch[0] !== monthKey) {
          return false;
        }

        return t.date === monthPayday.dateStr;
      });
      const txMealSum = matchingMealTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      // Calendar Working Days in this specific month
      const monthWorkingDays = getWorkingDaysInMonth(
        year,
        parseInt(m.num, 10),
        config.publicHolidays,
        config.workingSaturdays || DEFAULT_WORKING_SATURDAYS
      );

      // Check if saved daily logs exist for this specific month
      const savedDailyLogsStr = localStorage.getItem(`salary_daily_logs_${uId}_${monthKey}_full`);
      let monthLogWorkDays = 0;
      let monthLogOt15 = 0;
      let monthLogOt10 = 0;
      let monthLogOt30 = 0;
      let monthLogOtMealDays = 0;
      let monthLogNightShiftDays = 0;
      let hasDailyLogsForMonth = false;

      if (savedDailyLogsStr) {
        try {
          const parsedArr: DailyAttendance[] = JSON.parse(savedDailyLogsStr);
          if (Array.isArray(parsedArr) && parsedArr.length > 0) {
            hasDailyLogsForMonth = true;
            parsedArr.forEach((item) => {
              if (item.status === "work") monthLogWorkDays++;
              monthLogOt15 += Number(item.ot15Hours) || 0;
              monthLogOt10 += Number(item.ot10Hours) || 0;
              monthLogOt30 += Number(item.ot30Hours) || 0;
              const totalOtHr = (Number(item.ot15Hours) || 0) + (Number(item.ot10Hours) || 0) + (Number(item.ot30Hours) || 0);
              if (totalOtHr >= 2.5) monthLogOtMealDays++;
              if (item.isNightShift) monthLogNightShiftDays++;
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Calculations for this month's estimates
      const ot10Rate = monthBaseSalary / 30 / 8;

      let estOT = 0;
      let estMeal = 0;
      let estTravel = 0;
      let estOtMeal = 0;
      let estNightShift = 0;

      if (hasDailyLogsForMonth) {
        estOT = Math.round((monthLogOt15 * 1.5 + monthLogOt10 * 1.0 + monthLogOt30 * 3.0) * ot10Rate);
        estMeal = monthLogWorkDays * config.mealAllowanceDaily;
        estTravel = monthLogWorkDays * config.travelAllowanceDaily;
        estOtMeal = monthLogOtMealDays * config.otMealAllowanceDaily;
        estNightShift = monthLogNightShiftDays * config.nightShiftAllowanceDaily;
      } else {
        estOT = averageHistoricalOTPay;
        estMeal = monthWorkingDays * config.mealAllowanceDaily;
        estTravel = monthWorkingDays * config.travelAllowanceDaily;
      }

      const estKPI = m.num === "12" ? 0 : config.kpiAllowanceMonthly;
      const estHousing = m.num === "12" ? 0 : config.housingAllowanceMonthly;
      const estPosition = m.num === "12" ? 0 : config.positionAllowanceMonthly;
      const estBonus = m.num === "12" ? config.annualBonus : 0;

      const estGrossCash = monthBaseSalary + estOT + estTravel + estOtMeal + estNightShift + estKPI + estHousing + estPosition + estBonus;
      const estSocSec = Math.min(750, Math.round(monthBaseSalary * (config.socialSecurityPercent / 100)));
      const estDeductions = config.studentLoanDeduction + estSocSec;
      const estNet = Math.max(0, estGrossCash - estDeductions);

      let finalNet = estNet;
      let finalOT = estOT;
      let finalMeal = txMealSum > 0 ? txMealSum : estMeal;
      let finalGross = estGrossCash;

      if (isRecorded) {
        recordedCount++;
        finalNet = finalRecordedAmt;
        finalGross = Math.max(finalRecordedAmt, estGrossCash);
      } else if (monthKey === selectedMonth && calcResults) {
        // If current selected month and not recorded yet, use live calculated values from app state
        finalNet = Math.round(calcResults.netSalary);
        finalOT = Math.round(calcResults.totalOTPay);
        finalMeal = Math.round(calcResults.mealPay);
        finalGross = Math.round(calcResults.grossEarnings);
      }

      totalNet += finalNet;
      totalOT += finalOT;
      totalMeal += finalMeal;
      totalGross += finalGross;

      return {
        monthNum: m.num,
        monthName: m.name,
        monthKey,
        baseSalary: monthBaseSalary,
        otPay: finalOT,
        mealPay: finalMeal,
        grossCash: finalGross,
        netSalary: finalNet,
        isRecorded,
        recordedDate,
        isCurrentSelected: monthKey === selectedMonth,
        paydayInfo: monthPayday,
        workingDays: monthWorkingDays,
        hasDailyLogs: hasDailyLogsForMonth,
      };
    });

    const maxMonthlyGross = Math.max(...list.map((l) => l.grossCash), 1);

    return {
      year,
      list,
      totalNet,
      totalOT,
      totalMeal,
      totalGross,
      recordedCount,
      projectedCount: 12 - recordedCount,
      averageMonthlyNet: Math.round(totalNet / 12),
      averageHistoricalOTPay,
      maxMonthlyGross,
    };
  }, [annualSelectedYear, config, currentUser, transactions, selectedMonth, calcResults]);

  // User input for actual net salary received
  const [actualSalaryInput, setActualSalaryInput] = useState<string>("");

  // Auto-sync actualSalaryInput with calculated net salary whenever period or calculated net salary changes
  useEffect(() => {
    setActualSalaryInput(calcResults.netSalary.toFixed(2));
  }, [periodKey, calcResults.netSalary]);

  const calculatedNetSalary = useMemo(() => Number(calcResults.netSalary.toFixed(2)), [calcResults.netSalary]);

  const actualSalaryReceived = useMemo(() => {
    const parsed = parseFloat(actualSalaryInput);
    return isNaN(parsed) ? calculatedNetSalary : Number(parsed.toFixed(2));
  }, [actualSalaryInput, calculatedNetSalary]);

  const salaryDiff = useMemo(() => {
    return Number((actualSalaryReceived - calculatedNetSalary).toFixed(2));
  }, [actualSalaryReceived, calculatedNetSalary]);

  // Handle Recording Net Salary Transaction to Wallet
  const handleRecordSalaryToWallet = async (targetWalletId?: string) => {
    const wId = targetWalletId || selectedWalletId;
    if (!wId) {
      alert("กรุณาเลือกกระเป๋าเงินสำหรับรับเงินเดือน");
      return;
    }

    const periodLabel = isDecember 
      ? (decemberPeriod === "p1" ? "งวดที่ 1 (1-20 ธ.ค.)" : decemberPeriod === "p2" ? "งวดที่ 2 (21-31 ธ.ค.)" : "งวดเต็มเดือน ธ.ค.")
      : "ประจำเดือน";

    const calculatedNet = calculatedNetSalary;
    const actualAmt = actualSalaryReceived;
    const diff = salaryDiff;

    const diffNoteStr = diff === 0 
      ? "ตรงตามยอดคำนวณ (ไม่มีส่วนต่าง)"
      : diff > 0 
      ? `ได้รับมากกว่ายอดคำนวณ +฿${diff.toLocaleString()} บาท`
      : `ได้รับน้อยกว่ายอดคำนวณ -฿${Math.abs(diff).toLocaleString()} บาท`;

    // Duplicate recording check
    if (isSalaryAlreadyRecorded) {
      const timeStr = recordStatus.salaryRecordedAt ? ` (บันทึกเมื่อ ${recordStatus.salaryRecordedAt})` : "";
      const confirmMsg = `⚠️ ระบบตรวจพบว่า "เงินเดือนสุทธิ" สำหรับ ${selectedMonth} (${periodLabel}) ได้ถูกบันทึกเรียบร้อยแล้ว${timeStr}!\n\nคุณแน่ใจหรือไม่ว่าต้องการบันทึกเงินเดือนสุทธิซ้ำอีกครั้ง?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    const noteText = `[ระบบคำนวณเงินเดือน ${selectedMonth} ${periodLabel}]
• เงินเดือนสุทธิ (ตามคำนวณ): ฿${calculatedNet.toLocaleString()}
• เงินที่ได้รับจริง (โอนเข้าบัญชี): ฿${actualAmt.toLocaleString()}
• หมายเหตุส่วนต่าง: ${diffNoteStr}
----------------------------------------
• ฐานเงินเดือน/ค่าแรง: ฿${calcResults.periodBaseSalary.toLocaleString(undefined, { maximumFractionDigits: 2 })}
• รวม OT: ฿${calcResults.totalOTPay.toLocaleString()} (OT 1.5 = ${ot15HoursInput}ชม., OT 3.0 = ${ot30HoursInput}ชม.)
• ค่าเดินทาง: ฿${calcResults.travelPay.toLocaleString()} ${calcResults.separateMealPay ? "(ค่าข้าวแยกเข้าบัตรพนักงาน ฿" + calcResults.mealPay.toLocaleString() + ")" : `• ค่าข้าว: ฿${calcResults.mealPay.toLocaleString()}`}
• เบี้ยขยัน/วุฒิ/จุดพิเศษ/อายุงาน: ฿${(calcResults.diligentPay + calcResults.certificatePay + calcResults.specialDutyPay + calcResults.seniorityPay + calcResults.vacationRefundPay).toLocaleString()}
• ค่ากะ & สวัสดิการ: ฿${(calcResults.nightShiftPay + calcResults.kpiPay + calcResults.housingPay + calcResults.positionPay + calcResults.otherIncomePay).toLocaleString()}
${customEarnings.length > 0 ? `• รายการรับเพิ่มเติม: ${customEarnings.map((e) => `${e.name} (+฿${e.amount})`).join(", ")}\n` : ""}${calcResults.bonusPay > 0 ? `• โบนัสประจำปี: ฿${calcResults.bonusPay.toLocaleString()}\n` : ""}• รายการหัก: -฿${calcResults.totalDeductions.toLocaleString()} (กยศ ฿${calcResults.studentLoan}, ประกันสังคม ฿${calcResults.socialSecurity}${customDeductions.length > 0 ? `, หักเพิ่มเติม: ${customDeductions.map((d) => `${d.name} -฿${d.amount}`).join(", ")}` : ""})`;

    const paydayDate = currentPaydayInfo?.dateStr || new Date().toISOString().split("T")[0];

    onAddTransaction({
      type: "income",
      amount: actualAmt, // Record actual received amount into wallet
      category: "เงินเดือน",
      merchantName: `เงินเดือน ${selectedMonth} (${periodLabel})`,
      date: paydayDate,
      note: noteText,
      walletId: wId,
    });

    const nowStr = new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const currentQuickSummary: QuickSummaryData = {
      workDaysInput,
      ot15HoursInput,
      ot10HoursInput,
      ot30HoursInput,
      otMealDaysInput,
      nightShiftDaysInput,
      kpiAllowanceInput,
      positionAllowanceInput,
      otherIncomeInput,
      studentLoanInput,
      socialSecurityInput,
    };

    const updatedStatus: RecordedPeriodStatus = {
      ...recordStatus,
      salaryRecorded: true,
      salaryRecordedAt: nowStr,
      salaryAmount: actualAmt,
      quickSummary: currentQuickSummary,
    };

    setRecordStatus(updatedStatus);
    const storageKey = `salary_record_status_${currentUser || "default"}_${periodKey}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedStatus));

    const quickKey = `salary_quick_inputs_${currentUser || "default"}_${periodKey}`;
    localStorage.setItem(quickKey, JSON.stringify(currentQuickSummary));

    if (currentUser) {
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_records", periodKey), cleanObjectForFirestore(updatedStatus), { merge: true });
        await setDoc(doc(db, "users", uId, "salary_quick_inputs", periodKey), cleanObjectForFirestore(currentQuickSummary), { merge: true });
      } catch (e) {
        console.error("Error updating salary record status and quick summary:", e);
      }
    }

    setRecordedSuccess(true);
    setTimeout(() => setRecordedSuccess(false), 4000);
  };

  // Handle Recording Meal Allowance Transaction (Card Wallet / Food Card)
  const handleRecordMealToWallet = async (targetWalletId?: string) => {
    const wId = targetWalletId || selectedMealWalletId;
    if (!wId) {
      alert("กรุณาเลือกกระเป๋าเงิน/บัตรพนักงานสำหรับรับค่าข้าว");
      return;
    }

    if (calcResults.mealPay <= 0) {
      alert("ไม่มียอดค่าข้าวสำหรับบันทึกในงวดนี้");
      return;
    }

    const periodLabel = isDecember 
      ? (decemberPeriod === "p1" ? "งวดที่ 1" : decemberPeriod === "p2" ? "งวดที่ 2" : "เต็มเดือน")
      : "ประจำเดือน";

    // Duplicate recording check
    if (isMealAlreadyRecorded) {
      const timeStr = recordStatus.mealRecordedAt ? ` (บันทึกเมื่อ ${recordStatus.mealRecordedAt})` : "";
      const confirmMsg = `⚠️ ระบบตรวจพบว่า "ค่าข้าวเข้าบัตรพนักงาน" สำหรับ ${selectedMonth} (${periodLabel}) ได้ถูกบันทึกเรียบร้อยแล้ว${timeStr}!\n\nคุณแน่ใจหรือไม่ว่าต้องการบันทึกค่าข้าวเข้าบัตรซ้ำอีกครั้ง?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    const noteText = `[สิทธิสวัสดิการค่าข้าวเข้าบัตรพนักงาน ${selectedMonth} (${periodLabel})]
• จำนวนวันที่ได้ค่าข้าว: ${workDaysInput} วัน x ฿${config.mealAllowanceDaily}/วัน
• รวมสิทธิค่าข้าว: ฿${calcResults.mealPay.toLocaleString()} (แยกไม่รวมกับเงินเดือนสุทธิ)`;

    const paydayDate = currentPaydayInfo?.dateStr || new Date().toISOString().split("T")[0];

    onAddTransaction({
      type: "income",
      amount: Math.round(calcResults.mealPay),
      category: "สวัสดิการอาหาร",
      merchantName: `ค่าข้าวเข้าบัตรพนักงาน ${selectedMonth}`,
      date: paydayDate,
      note: noteText,
      walletId: wId,
    });

    const nowStr = new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const updatedStatus: RecordedPeriodStatus = {
      ...recordStatus,
      mealRecorded: true,
      mealRecordedAt: nowStr,
      mealAmount: Math.round(calcResults.mealPay),
    };

    setRecordStatus(updatedStatus);
    const storageKey = `salary_record_status_${currentUser || "default"}_${periodKey}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedStatus));

    if (currentUser) {
      try {
        const uId = currentUser.toLowerCase().trim();
        await setDoc(doc(db, "users", uId, "salary_records", periodKey), cleanObjectForFirestore(updatedStatus), { merge: true });
      } catch (e) {
        console.error("Error updating meal record status:", e);
      }
    }

    setRecordedMealSuccess(true);
    setTimeout(() => setRecordedMealSuccess(false), 4000);
  };

  // Legacy single call support
  const handleRecordToWallet = () => {
    handleRecordSalaryToWallet();
  };

  // Helper for Status Badge Display
  const renderStatusBadge = (status: WorkStatus) => {
    switch (status) {
      case "work":
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🟢 มาทำงาน</span>;
      case "off":
        return <span className="px-2.5 py-1 bg-slate-800 text-slate-400 border border-white/10 rounded-xl font-bold text-xs flex items-center gap-1">⚪️ หยุดประจำสัปดาห์</span>;
      case "public_holiday":
        return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🚩 หยุดนักขัตฤกษ์</span>;
      case "shifted_holiday":
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🔁 ปรับเลื่อนวันหยุด</span>;
      case "personal_leave":
        return <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🟡 ลากิจ</span>;
      case "sick_leave":
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🔵 ลาป่วย</span>;
      case "vacation_leave":
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl font-bold text-xs flex items-center gap-1">🟣 ลาพักร้อน</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Calculator className="w-6 h-6" />
            </span>
            <span>ระบบคำนวณเงินเดือน & ค่าแรง OT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            คำนวณฐานเงินเดือน, OT 1.5/3.0, สวัสดิการ, เบี้ยขยันไฮซีซัน, ค่าวุฒิ, ค่าจุดพิเศษ, พักร้อนคืนเงิน, วันหยุดนักขัตฤกษ์ & ลากิจ/ป่วย/พักร้อน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {syncStatus === "saving" && (
            <span className="px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>กำลังบันทึกไปยังคลาวด์...</span>
            </span>
          )}
          {syncStatus === "synced" && (
            <span className="px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>ซิงค์คลาวด์แล้ว</span>
            </span>
          )}
          {syncStatus === "error" && (
            <span className="px-3 py-1.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>บันทึกในเครื่อง</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-2 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>ตั้งค่าสวัสดิการ, รายรับ & วันหยุดนักขัตฤกษ์</span>
          </button>
        </div>
      </div>

      {/* Month Picker & December Split Mode Selector */}
      <div className="bg-[#111827] border border-white/10 rounded-3xl p-4 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                เลือกเดือนที่ต้องการคำนวณ
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold text-sm focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* December Special Rule Alert / Selector */}
          {isDecember ? (
            <div className="flex-1 min-w-[280px] bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">🎄 เดือนธันวาคม: เงื่อนไขจ่าย 2 งวด + โบนัส</span>
                  <span className="text-[11px] text-amber-200/80">งวด 1 (1-20 ธ.ค.) ฐานเงินเดือน÷31×20 + โบนัส | งวด 2 (21-31 ธ.ค.) ฐานเงินเดือน÷31×11</span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setDecemberPeriod("p1")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    decemberPeriod === "p1"
                      ? "bg-amber-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  งวด 1 (1-20 ธ.ค.)
                </button>
                <button
                  type="button"
                  onClick={() => setDecemberPeriod("p2")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    decemberPeriod === "p2"
                      ? "bg-amber-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  งวด 2 (21-31 ธ.ค.)
                </button>
                <button
                  type="button"
                  onClick={() => setDecemberPeriod("full")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    decemberPeriod === "full"
                      ? "bg-amber-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ทั้งเดือน
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-white/5 border border-white/5 px-3 py-2 rounded-xl">
              💡 อัตรา OT 1.0 = <strong className="text-indigo-300">฿{calcResults.ot1Rate.toFixed(2)}/ชม.</strong> | OT 1.5 = <strong className="text-emerald-300">฿{calcResults.ot15Rate.toFixed(2)}/ชม.</strong> | OT 3.0 = <strong className="text-rose-300">฿{calcResults.ot3Rate.toFixed(2)}/ชม.</strong>
            </div>
          )}
        </div>

        {/* Input Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("summary");
                setUseDailyLog(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "summary"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>ป้อนสรุปเร็ว</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("daily");
                setUseDailyLog(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "daily"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>ตารางลงเวลาประจำวัน</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("annual")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "annual"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>กราฟสรุปภาพรวมทั้งปี</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("payslip")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "payslip"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ใบแจ้งเงินเดือน (Pay Slip)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: QUICK SUMMARY INPUT FORM */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Work & OT Hours Entry */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <span>จำนวนวันทำงาน & ชั่วโมง OT ประจำงวด</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Working Days */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>จำนวนวันทำงาน (วัน)</span>
                    <span className="text-[10px] text-slate-400">(สำหรับค่าข้าว & ค่าเดินทาง)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={workDaysInput}
                    onChange={(e) => setWorkDaysInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-indigo-300 flex justify-between pt-1">
                    <span>ค่าข้าว ({config.mealAllowanceDaily}฿/วัน): ฿{(workDaysInput * config.mealAllowanceDaily).toLocaleString()}</span>
                    <span>ค่าเดินทาง ({config.travelAllowanceDaily}฿/วัน): ฿{(workDaysInput * config.travelAllowanceDaily).toLocaleString()}</span>
                  </div>
                </div>

                {/* OT 1.5 Hours */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>ชั่วโมง OT 1.5 (วันปกติ)</span>
                    <span className="text-[10px] text-emerald-400">฿{calcResults.ot15Rate.toFixed(1)}/ชม.</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ot15HoursInput}
                    onChange={(e) => setOt15HoursInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-emerald-300 pt-1">
                    รวมเงิน OT 1.5: <strong>฿{calcResults.ot15Pay.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                  </div>
                </div>

                {/* OT 1.0 (Holiday 8h) */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>ชั่วโมง ทำงานวันหยุด (OT 1.0)</span>
                    <span className="text-[10px] text-indigo-400">฿{calcResults.ot1Rate.toFixed(1)}/ชม.</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ot10HoursInput}
                    onChange={(e) => setOt10HoursInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-indigo-300 pt-1">
                    รวมเงิน OT 1.0: <strong>฿{calcResults.ot10Pay.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                  </div>
                </div>

                {/* OT 3.0 (Holiday Overtime) */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>ชั่วโมง OT วันหยุด (OT 3.0)</span>
                    <span className="text-[10px] text-rose-400">฿{calcResults.ot3Rate.toFixed(1)}/ชม.</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ot30HoursInput}
                    onChange={(e) => setOt30HoursInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-rose-300 pt-1">
                    รวมเงิน OT 3.0: <strong>฿{calcResults.ot30Pay.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                  </div>
                </div>

                {/* OT Meal Days (OT >= 2.5 hrs) */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>จำนวนวันทำ OT ≥ 2.5 ชม. (รับค่าข้าว OT)</span>
                    <span className="text-[10px] text-amber-400">฿{config.otMealAllowanceDaily}/วัน</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={otMealDaysInput}
                    onChange={(e) => setOtMealDaysInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-amber-300 pt-1">
                    รวมค่าข้าว OT: <strong>฿{calcResults.otMealPay.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Night Shift Days */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>จำนวนวันที่เข้ากะดึก (รับค่ากะ)</span>
                    <span className="text-[10px] text-purple-400">฿{config.nightShiftAllowanceDaily}/วัน</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={nightShiftDaysInput}
                    onChange={(e) => setNightShiftDaysInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-base focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-purple-300 pt-1">
                    รวมค่ากะ: <strong>฿{calcResults.nightShiftPay.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Income & Allowances Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Allowances Summary Box */}
              <div className="bg-[#111827] border border-white/10 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    <span>สวัสดิการ & รายรับเพิ่มเติม</span>
                  </span>
                  {calcResults.totalCustomEarnings > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      +฿{calcResults.totalCustomEarnings.toLocaleString()}
                    </span>
                  )}
                </h4>

                <div className="space-y-1.5 text-xs">
                  {calcResults.diligentPay > 0 && (
                    <div className="flex justify-between text-emerald-300 font-bold">
                      <span>เบี้ยขยัน (ช่วงไฮซีซัน):</span>
                      <span>฿{calcResults.diligentPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.vacationRefundPay > 0 && (
                    <div className="flex justify-between text-purple-300 font-bold">
                      <span>พักร้อนคืนเงิน:</span>
                      <span>฿{calcResults.vacationRefundPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.seniorityPay > 0 && (
                    <div className="flex justify-between text-sky-300 font-bold">
                      <span>ค่าอายุงานประจำปี:</span>
                      <span>฿{calcResults.seniorityPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.specialDutyPay > 0 && (
                    <div className="flex justify-between text-amber-300 font-bold">
                      <span>ค่าจุดพิเศษ:</span>
                      <span>฿{calcResults.specialDutyPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.certificatePay > 0 && (
                    <div className="flex justify-between text-teal-300 font-bold">
                      <span>ค่าวุฒิบัตร:</span>
                      <span>฿{calcResults.certificatePay.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-300 items-center">
                    <span>ค่า KPI ประจำเดือน:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">฿</span>
                      <input
                        type="number"
                        value={kpiAllowanceInput}
                        onChange={(e) => setKpiAllowanceInput(Number(e.target.value))}
                        className="w-24 px-2 py-0.5 bg-[#1e293b] border border-white/20 rounded-lg text-emerald-300 font-bold text-xs text-right focus:outline-hidden focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ค่าที่พัก:</span>
                    <span className="font-bold text-white">฿{calcResults.housingPay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 items-center">
                    <span>ค่าตำแหน่ง:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">฿</span>
                      <input
                        type="number"
                        value={positionAllowanceInput}
                        onChange={(e) => setPositionAllowanceInput(Number(e.target.value))}
                        className="w-24 px-2 py-0.5 bg-[#1e293b] border border-white/20 rounded-lg text-emerald-300 font-bold text-xs text-right focus:outline-hidden focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-300 items-center">
                    <span>รายได้เพิ่มเติมอื่นๆ:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">฿</span>
                      <input
                        type="number"
                        value={otherIncomeInput}
                        onChange={(e) => setOtherIncomeInput(Number(e.target.value))}
                        className="w-24 px-2 py-0.5 bg-[#1e293b] border border-white/20 rounded-lg text-emerald-300 font-bold text-xs text-right focus:outline-hidden focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  {calcResults.bonusPay > 0 && (
                    <div className="flex justify-between text-amber-300 font-bold pt-1 border-t border-amber-500/20">
                      <span>โบนัสประจำปี (ธ.ค.):</span>
                      <span>฿{calcResults.bonusPay.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Custom Earnings List (+รายการรับเพิ่มเติม) */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span>➕ รายการรับเพิ่มเติม (กำหนดเอง):</span>
                    <span>฿{calcResults.totalCustomEarnings.toLocaleString()}</span>
                  </div>

                  {/* Quick Chips for Custom Earnings */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      "+KPI *ตักจับงานขาด (+100฿)",
                      "เบี้ยขยัน (จ่ายช่วงไฮซีซัน)",
                      "พักร้อนคืนเงิน",
                      "ค่าอายุงานประจำปี",
                      "ค่าจุดพิเศษ",
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (opt.includes("+KPI *ตักจับงานขาด")) {
                            handleAddPresetEarning("+KPI *ตักจับงานขาด", 100);
                          } else {
                            setNewEarningName(opt);
                            setShowEarningSuggestions(true);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        + {opt}
                      </button>
                    ))}
                  </div>

                  {customEarnings.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {customEarnings.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-xs">
                          <span className="text-emerald-200 font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-300">+฿{item.amount.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomEarning(item.id)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                              title="ลบรายการรับนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Custom Earning Form with Search History */}
                  <div className="relative pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="พิมพ์ค้นหาประวัติ หรือชื่อรายการใหม่..."
                          value={newEarningName}
                          onFocus={() => setShowEarningSuggestions(true)}
                          onChange={(e) => {
                            setNewEarningName(e.target.value);
                            setShowEarningSuggestions(true);
                          }}
                          className="w-full px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500 pr-7"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
                      </div>

                      <input
                        type="number"
                        placeholder="จำนวน"
                        value={newEarningAmount}
                        onChange={(e) => setNewEarningAmount(e.target.value)}
                        className="w-20 px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-xs focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomEarning}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่ม</span>
                      </button>
                    </div>

                    {/* Autocomplete Suggestions Popup */}
                    {showEarningSuggestions && (
                      <div className="absolute left-0 right-24 bottom-full mb-1 z-30 bg-[#1e293b] border border-emerald-500/30 rounded-xl shadow-xl max-h-40 overflow-y-auto p-1 animate-in fade-in">
                        <div className="flex justify-between items-center px-2 py-1 border-b border-white/10 text-[10px] text-emerald-400 font-bold">
                          <span>🔍 ประวัติรายการรับเพิ่มเติม</span>
                          <button
                            type="button"
                            onClick={() => setShowEarningSuggestions(false)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {earningHistory.filter((item) =>
                          item.toLowerCase().includes(newEarningName.toLowerCase())
                        ).length === 0 ? (
                          <div className="px-2 py-1.5 text-[11px] text-slate-400 italic">
                            ไม่พบในประวัติ คุณสามารถพิมพ์ชื่อใหม่เพื่อเพิ่มได้
                          </div>
                        ) : (
                          earningHistory
                            .filter((item) => item.toLowerCase().includes(newEarningName.toLowerCase()))
                            .map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setNewEarningName(item);
                                  setShowEarningSuggestions(false);
                                }}
                                className="w-full text-left px-2 py-1 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <span>{item}</span>
                                <span className="text-[10px] text-slate-400">เลือก</span>
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Deductions Summary Box */}
              <div className="bg-[#111827] border border-white/10 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>รายการหักประจำเดือน</span>
                  </span>
                  {calcResults.totalCustomDeductions > 0 && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                      -฿{calcResults.totalCustomDeductions.toLocaleString()}
                    </span>
                  )}
                </h4>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300 items-center">
                    <span>หัก กยศ.:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">-฿</span>
                      <input
                        type="number"
                        value={studentLoanInput}
                        onChange={(e) => setStudentLoanInput(Number(e.target.value))}
                        className="w-24 px-2 py-0.5 bg-[#1e293b] border border-white/20 rounded-lg text-rose-300 font-bold text-xs text-right focus:outline-hidden focus:border-rose-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-300 items-center">
                    <span>ประกันสังคม ({config.socialSecurityPercent}% สูงสุด {config.socialSecurityMaxCap ?? 750}฿):</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">-฿</span>
                      <input
                        type="number"
                        value={socialSecurityInput}
                        onChange={(e) => setSocialSecurityInput(Number(e.target.value))}
                        className="w-24 px-2 py-0.5 bg-[#1e293b] border border-white/20 rounded-lg text-rose-300 font-bold text-xs text-right focus:outline-hidden focus:border-rose-400"
                      />
                    </div>
                  </div>
                  {config.kpiDeduction > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>หัก KPI:</span>
                      <span className="font-bold text-rose-300">-฿{calcResults.kpiDeductionVal.toLocaleString()}</span>
                    </div>
                  )}
                  {config.otherDeduction > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>รายการหักเพิ่มเติม:</span>
                      <span className="font-bold text-rose-300">-฿{calcResults.otherDeductionVal.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Custom Deductions List (-รายการหักเพิ่มเติม) */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                    <span>➖ รายการหักเพิ่มเติม (กำหนดเอง):</span>
                    <span>-฿{calcResults.totalCustomDeductions.toLocaleString()}</span>
                  </div>

                  {/* Quick Chips for Custom Deductions */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      "-KPI *ส่งงานเกิน (-500฿)",
                      "ค่าวุฒิบัตร",
                      "ค่าปรับเข้างานสาย",
                      "ค่าประกันเครื่องแบบ",
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (opt.includes("-KPI *ส่งงานเกิน")) {
                            handleAddPresetDeduction("-KPI *ส่งงานเกิน", 500);
                          } else {
                            setNewDeductionName(opt);
                            setShowDeductionSuggestions(true);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        - {opt}
                      </button>
                    ))}
                  </div>

                  {customDeductions.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {customDeductions.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl text-xs">
                          <span className="text-rose-200 font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-300">-฿{item.amount.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomDeduction(item.id)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                              title="ลบรายการหักนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Custom Deduction Form with Search History */}
                  <div className="relative pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="พิมพ์ค้นหาประวัติ หรือชื่อรายการหัก..."
                          value={newDeductionName}
                          onFocus={() => setShowDeductionSuggestions(true)}
                          onChange={(e) => {
                            setNewDeductionName(e.target.value);
                            setShowDeductionSuggestions(true);
                          }}
                          className="w-full px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white text-xs focus:border-rose-500 pr-7"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
                      </div>

                      <input
                        type="number"
                        placeholder="จำนวน"
                        value={newDeductionAmount}
                        onChange={(e) => setNewDeductionAmount(e.target.value)}
                        className="w-20 px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-xs focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomDeduction}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่ม</span>
                      </button>
                    </div>

                    {/* Autocomplete Suggestions Popup */}
                    {showDeductionSuggestions && (
                      <div className="absolute left-0 right-24 bottom-full mb-1 z-30 bg-[#1e293b] border border-rose-500/30 rounded-xl shadow-xl max-h-40 overflow-y-auto p-1 animate-in fade-in">
                        <div className="flex justify-between items-center px-2 py-1 border-b border-white/10 text-[10px] text-rose-400 font-bold">
                          <span>🔍 ประวัติรายการหักเพิ่มเติม</span>
                          <button
                            type="button"
                            onClick={() => setShowDeductionSuggestions(false)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {deductionHistory.filter((item) =>
                          item.toLowerCase().includes(newDeductionName.toLowerCase())
                        ).length === 0 ? (
                          <div className="px-2 py-1.5 text-[11px] text-slate-400 italic">
                            ไม่พบในประวัติ คุณสามารถพิมพ์ชื่อใหม่เพื่อเพิ่มได้
                          </div>
                        ) : (
                          deductionHistory
                            .filter((item) => item.toLowerCase().includes(newDeductionName.toLowerCase()))
                            .map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setNewDeductionName(item);
                                  setShowDeductionSuggestions(false);
                                }}
                                className="w-full text-left px-2 py-1 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <span>{item}</span>
                                <span className="text-[10px] text-slate-400">เลือก</span>
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-rose-400 font-bold pt-2 border-t border-white/10 text-xs">
                  <span>รวมรายการหักทั้งหมด:</span>
                  <span>-฿{calcResults.totalDeductions.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Net Salary Result & Quick Payout Card */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/60 via-[#111827] to-purple-900/60 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-6">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Calculator className="w-40 h-40 text-indigo-300" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[11px] font-bold rounded-full border border-indigo-500/30 mb-2">
                  💰 เงินเดือนสุทธิที่ได้รับ (Net Salary)
                </span>
                <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                  ฿{calcResults.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ประจำเดือน {selectedMonth} {isDecember ? `(${decemberPeriod === "p1" ? "งวด 1: 1-20 ธ.ค." : decemberPeriod === "p2" ? "งวด 2: 21-31 ธ.ค." : "ทั้งเดือน"})` : ""}
                </p>

                {currentPaydayInfo && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <CalendarCheck className="w-4 h-4 text-emerald-400" />
                        <span>กำหนดวันจ่ายเงินเดือน:</span>
                      </span>
                      <span className="text-emerald-200 font-extrabold text-xs bg-emerald-500/20 px-2.5 py-0.5 rounded-xl border border-emerald-500/30">
                        {currentPaydayInfo.formattedThai}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">
                      💡 {currentPaydayInfo.reason}
                      {currentPaydayInfo.isShifted && (
                        <span className="block text-amber-300 font-semibold mt-0.5">
                          ⚠️ {currentPaydayInfo.shiftNote}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Earnings vs Deductions Quick Breakdown */}
              <div className="space-y-2 border-t border-white/10 pt-4 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>ฐานเงินเดือน / ค่าแรงงวดนี้:</span>
                  <span className="font-bold text-white">฿{Math.round(calcResults.periodBaseSalary).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>รวมเงิน OT ทั้งหมด:</span>
                  <span className="font-bold text-emerald-400">+฿{Math.round(calcResults.totalOTPay).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>รวมสวัสดิการ & รายรับเพิ่มเติม:</span>
                  <span className="font-bold text-emerald-400">+฿{Math.round(calcResults.mealPay + calcResults.travelPay + calcResults.otMealPay + calcResults.nightShiftPay + calcResults.kpiPay + calcResults.housingPay + calcResults.positionPay + calcResults.otherIncomePay + calcResults.diligentPay + calcResults.vacationRefundPay + calcResults.seniorityPay + calcResults.specialDutyPay + calcResults.certificatePay).toLocaleString()}</span>
                </div>
                {calcResults.bonusPay > 0 && (
                  <div className="flex justify-between items-center text-amber-300 font-bold">
                    <span>โบนัสประจำปี:</span>
                    <span>+฿{calcResults.bonusPay.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-rose-300 border-t border-white/10 pt-2">
                  <span>หัก กยศ. / ประกันสังคม / อื่นๆ:</span>
                  <span className="font-bold">-฿{calcResults.totalDeductions.toLocaleString()}</span>
                </div>
              </div>

              {/* Save Income to Wallet Section */}
              <div className="border-t border-white/10 pt-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-indigo-400" />
                    <span>บันทึกรายได้เข้ากระเป๋าเงิน (Wallet)</span>
                  </label>
                  {calcResults.separateMealPay && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                      แยกค่าข้าว ฿{calcResults.mealPay.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Anti-Duplicate Status Summary Badges */}
                {(isSalaryAlreadyRecorded || (calcResults.separateMealPay && isMealAlreadyRecorded)) && (
                  <div className="space-y-1.5 p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-2xl text-xs">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>สถานะการบันทึกรายการประจำงวดนี้ ({selectedMonth}):</span>
                    </div>

                    {isSalaryAlreadyRecorded && (
                      <div className="flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-emerald-300 font-semibold">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>เงินเดือนสุทธิ: บันทึกเรียบร้อยแล้ว</span>
                        </span>
                        {recordStatus.salaryRecordedAt && (
                          <span className="text-[10px] text-emerald-400/80 font-normal">{recordStatus.salaryRecordedAt}</span>
                        )}
                      </div>
                    )}

                    {calcResults.separateMealPay && isMealAlreadyRecorded && (
                      <div className="flex items-center justify-between text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl text-amber-300 font-semibold">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          <span>ค่าข้าวเข้าบัตร: บันทึกเรียบร้อยแล้ว</span>
                        </span>
                        {recordStatus.mealRecordedAt && (
                          <span className="text-[10px] text-amber-400/80 font-normal">{recordStatus.mealRecordedAt}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actual Received Salary Input Box */}
                <div className="space-y-1.5 bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      <span>เงินที่ได้รับจริง (โอนเข้ากระเป๋า/บัญชี)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActualSalaryInput(calculatedNetSalary.toFixed(2))}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title="รีเซ็ตเป็นยอดตามคำนวณ"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>รีเซ็ตตามคำนวณ (฿{calculatedNetSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">฿</span>
                    <input
                      type="number"
                      step="any"
                      value={actualSalaryInput}
                      onChange={(e) => setActualSalaryInput(e.target.value)}
                      placeholder={calculatedNetSalary.toFixed(2)}
                      className="w-full pl-7 pr-3 py-2 bg-[#1e293b] border border-emerald-500/40 rounded-xl text-emerald-200 font-bold text-sm focus:outline-hidden focus:border-emerald-400"
                    />
                  </div>

                  {/* Difference display tag */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-slate-400">
                      ยอดคำนวณ: <strong className="text-slate-200">฿{calculatedNetSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </span>
                    {salaryDiff === 0 ? (
                      <span className="text-emerald-400/90 font-medium text-[10px]">✓ ตรงตามยอดคำนวณ</span>
                    ) : salaryDiff > 0 ? (
                      <span className="text-emerald-300 font-bold text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        <span>เกินกว่าคำนวณ +฿{salaryDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    ) : (
                      <span className="text-rose-300 font-bold text-[10px] bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3 text-rose-400" />
                        <span>น้อยกว่าคำนวณ -฿{Math.abs(salaryDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Salary Wallet Selection */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300 flex items-center gap-1 justify-between">
                    <span>🏦 กระเป๋ารับเงินเดือน (บันทึกจริง ฿{actualSalaryReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                    {isSalaryAlreadyRecorded && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        ✓ บันทึกแล้ว
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1e293b] border border-indigo-500/30 rounded-xl text-white font-semibold text-xs focus:outline-hidden cursor-pointer"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.icon} {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Meal Allowance Card Wallet Selection (if separated) */}
                {calcResults.separateMealPay && (
                  <div className="space-y-1 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                    <label className="block text-[11px] font-bold text-amber-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>💳 กระเป๋าบัตรพนักงาน / ค่าข้าว (฿{calcResults.mealPay.toLocaleString()})</span>
                      </span>
                      {isMealAlreadyRecorded ? (
                        <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                          ✓ บันทึกแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-normal">หนี้สินค่ารับ</span>
                      )}
                    </label>
                    <select
                      value={selectedMealWalletId}
                      onChange={(e) => setSelectedMealWalletId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-amber-500/30 rounded-xl text-white font-semibold text-xs focus:outline-hidden cursor-pointer"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.icon} {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleRecordSalaryToWallet()}
                    className={`py-2.5 px-3 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSalaryAlreadyRecorded
                        ? "bg-slate-800 hover:bg-emerald-950 border border-emerald-500/40 text-emerald-300"
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                    }`}
                  >
                    {isSalaryAlreadyRecorded ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>✓ บันทึกเงินเดือนแล้ว (กดเพื่อบันทึกซ้ำ)</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>บันทึกเงินเดือนสุทธิ</span>
                      </>
                    )}
                  </button>

                  {calcResults.separateMealPay && (
                    <button
                      type="button"
                      onClick={() => handleRecordMealToWallet()}
                      className={`py-2.5 px-3 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isMealAlreadyRecorded
                          ? "bg-slate-800 hover:bg-amber-950 border border-amber-500/40 text-amber-300"
                          : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                      }`}
                    >
                      {isMealAlreadyRecorded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          <span>✓ บันทึกค่าข้าวแล้ว (กดเพื่อบันทึกซ้ำ)</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>บันทึกค่าข้าวเข้าบัตร</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Feedback Alerts */}
                {recordedSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>บันทึกเงินเดือนสุทธิเข้าบัญชีเรียบร้อยแล้ว!</span>
                  </div>
                )}

                {recordedMealSuccess && (
                  <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    <span>บันทึกค่าข้าวเข้ากระเป๋าบัตรพนักงานเรียบร้อยแล้ว!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE LOG CALENDAR */}
      {activeTab === "daily" && (
        <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <span>ตารางลงเวลาทำงาน & วันหยุด/การลาประจำวัน ({selectedMonth})</span>
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>บันทึกอัตโนมัติแล้ว</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                เลือกสถานะ มาทำงาน / วันหยุดประจำสัปดาห์ / วันหยุดนักขัตฤกษ์ / ปรับเลื่อนวันหยุด / ลากิจ / ลาป่วย / ลาพักร้อน
              </p>
            </div>

            {/* Leave & Work Days Quick Counters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg">
                ทำงาน/ได้ค่าเดินทาง: <strong>{workDaysInput} วัน</strong>
              </span>
              <span className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg">
                ลากิจ: <strong>{personalLeaveDays} วัน</strong>
              </span>
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg">
                ลาป่วย: <strong>{sickLeaveDays} วัน</strong>
              </span>
              <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg">
                พักร้อน: <strong>{vacationLeaveDays} วัน</strong>
              </span>
              <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg">
                นักขัตฤกษ์: <strong>{publicHolidayCount} วัน</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">วันที่</th>
                  <th className="py-2.5 px-3">สถานะการทำงาน / ลา / วันหยุด</th>
                  <th className="py-2.5 px-3">เข้ากะดึก</th>
                  <th className="py-2.5 px-3">OT 1.5 (ปกติ)</th>
                  <th className="py-2.5 px-3">OT 1.0 / OT 3.0 (วันหยุด)</th>
                  <th className="py-2.5 px-3">สวัสดิการประจำวัน & ค่าข้าว OT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {dailyLogs.map((log, idx) => {
                  const totalOtInDay = (log.ot15Hours || 0) + (log.ot30Hours || 0);
                  const isOtMealQualify = totalOtInDay >= 2.5;

                  const isLeaveDay = log.status === "personal_leave" || log.status === "sick_leave" || log.status === "vacation_leave";
                  const isHolidayOrOff = log.status === "off" || log.status === "public_holiday" || log.status === "shifted_holiday";
                  const totalOtHoursInDay = (log.ot10Hours || 0) + (log.ot15Hours || 0) + (log.ot30Hours || 0);
                  const workedOnHoliday = isHolidayOrOff && totalOtHoursInDay > 0;
                  const isNormalWork = log.status === "work";

                  return (
                    <tr key={log.day} className={`hover:bg-white/5 transition-colors ${log.status === "public_holiday" ? "bg-rose-500/10" : log.status === "off" ? "bg-slate-800/30" : ""}`}>
                      <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                        <span>วันที่ {log.day}</span>
                        {log.note && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                            {log.note}
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <select
                          value={log.status}
                          onChange={(e) => {
                            const updated = [...dailyLogs];
                            updated[idx].status = e.target.value as WorkStatus;
                            setDailyLogs(updated);
                          }}
                          className="bg-[#1e293b] border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs focus:outline-hidden cursor-pointer"
                        >
                          <option value="work">🟢 มาทำงาน</option>
                          <option value="off">⚪️ วันหยุดประจำสัปดาห์</option>
                          <option value="public_holiday">🚩 วันหยุดนักขัตฤกษ์</option>
                          <option value="shifted_holiday">🔁 ปรับเลื่อนวันหยุด / ชดเชย</option>
                          <option value="personal_leave">🟡 ลากิจ</option>
                          <option value="sick_leave">🔵 ลาป่วย</option>
                          <option value="vacation_leave">🟣 ลาพักร้อน</option>
                        </select>
                      </td>

                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...dailyLogs];
                            updated[idx].isNightShift = !updated[idx].isNightShift;
                            setDailyLogs(updated);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                            log.isNightShift
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "text-slate-500 border border-transparent hover:border-white/10"
                          }`}
                        >
                          {log.isNightShift ? "🌙 กะดึก (80฿)" : "☀️ กะปกติ"}
                        </button>
                      </td>

                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={log.ot15Hours}
                          onChange={(e) => {
                            const updated = [...dailyLogs];
                            updated[idx].ot15Hours = Number(e.target.value);
                            setDailyLogs(updated);
                          }}
                          className="w-20 px-2 py-1 bg-[#1e293b] border border-white/10 rounded-lg text-white font-bold text-xs"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">ชม.</span>
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-indigo-300 font-bold">1.0:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="1.0"
                              value={log.ot10Hours || 0}
                              onChange={(e) => {
                                const updated = [...dailyLogs];
                                updated[idx].ot10Hours = Number(e.target.value);
                                setDailyLogs(updated);
                              }}
                              className="w-16 px-2 py-1 bg-[#1e293b] border border-indigo-500/30 rounded-lg text-indigo-200 font-bold text-xs focus:border-indigo-400"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-rose-300 font-bold">3.0:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="3.0"
                              value={log.ot30Hours || 0}
                              onChange={(e) => {
                                const updated = [...dailyLogs];
                                updated[idx].ot30Hours = Number(e.target.value);
                                setDailyLogs(updated);
                              }}
                              className="w-16 px-2 py-1 bg-[#1e293b] border border-rose-500/30 rounded-lg text-rose-200 font-bold text-xs focus:border-rose-400"
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {isNormalWork && (
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-md text-[10px] font-bold">
                              🚗 +50฿ 🍚 +47฿
                            </span>
                          )}
                          {workedOnHoliday && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-bold">
                              🚗 +50฿ 🍚 +47฿ (ทำงานวันหยุด)
                            </span>
                          )}
                          {isOtMealQualify && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-bold flex items-center gap-0.5">
                              <Coffee className="w-3 h-3" /> ☕️ ข้าว OT +35฿
                            </span>
                          )}
                          {isLeaveDay && (
                            <span className="text-slate-500 text-[10px]">
                              ❌ วันลา (ไม่ได้ค่าเดินทาง/อาหาร)
                            </span>
                          )}
                          {isHolidayOrOff && !workedOnHoliday && (
                            <span className="text-slate-500 text-[10px]">
                              ⚪️ วันหยุด (ไม่ได้มาทำงาน)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL PAY SLIP VIEW */}
      {activeTab === "payslip" && (
        <div className="space-y-4">
          <div className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-w-3xl mx-auto border border-slate-200">
            {/* Header Slip */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-indigo-900 tracking-wide">
                  ใบแจ้งเงินเดือน / PAY SLIP
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ประจำเดือน: <strong className="text-slate-800">{selectedMonth}</strong> {isDecember ? `(${decemberPeriod === "p1" ? "งวดที่ 1: 1-20 ธันวาคม" : decemberPeriod === "p2" ? "งวดที่ 2: 21-31 ธันวาคม" : "งวดเต็มเดือน ธ.ค."})` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  อนุมัติจ่ายแล้ว
                </span>
              </div>
            </div>

            {/* Attendance & Leave Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] text-center">
              <div>
                <span className="text-slate-500 block">มาทำงาน</span>
                <span className="font-bold text-slate-800">{workDaysInput} วัน</span>
              </div>
              <div>
                <span className="text-slate-500 block">ลากิจ</span>
                <span className="font-bold text-slate-800">{personalLeaveDays} วัน</span>
              </div>
              <div>
                <span className="text-slate-500 block">ลาป่วย</span>
                <span className="font-bold text-slate-800">{sickLeaveDays} วัน</span>
              </div>
              <div>
                <span className="text-slate-500 block">ลาพักร้อน</span>
                <span className="font-bold text-slate-800">{vacationLeaveDays} วัน</span>
              </div>
              <div>
                <span className="text-slate-500 block">วันหยุดนักขัตฤกษ์</span>
                <span className="font-bold text-slate-800">{publicHolidayCount} วัน</span>
              </div>
            </div>

            {/* Income vs Deductions Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  รายการรายได้ (Earnings)
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>ฐานเงินเดือน / ค่าแรงงวดนี้</span>
                    <span className="font-bold">฿{Math.round(calcResults.periodBaseSalary).toLocaleString()}</span>
                  </div>
                  {calcResults.ot15Pay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่า OT 1.5 ({ot15HoursInput} ชม.)</span>
                      <span className="font-bold text-emerald-700">฿{Math.round(calcResults.ot15Pay).toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.ot10Pay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่า OT 1.0 ({ot10HoursInput} ชม.)</span>
                      <span className="font-bold text-emerald-700">฿{Math.round(calcResults.ot10Pay).toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.ot30Pay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่า OT 3.0 ({ot30HoursInput} ชม.)</span>
                      <span className="font-bold text-emerald-700">฿{Math.round(calcResults.ot30Pay).toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.mealPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>ค่าอาหาร ({workDaysInput} วัน)</span>
                        {calcResults.separateMealPay && (
                          <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                            💳 แยกเข้าบัตรพนักงาน
                          </span>
                        )}
                      </span>
                      <span className="font-bold">฿{calcResults.mealPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.travelPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่าเดินทาง ({workDaysInput} วัน)</span>
                      <span className="font-bold">฿{calcResults.travelPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.otMealPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่าข้าว OT ({otMealDaysInput} วัน)</span>
                      <span className="font-bold">฿{calcResults.otMealPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.nightShiftPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่ากะดึก ({nightShiftDaysInput} วัน)</span>
                      <span className="font-bold">฿{calcResults.nightShiftPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.diligentPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 font-bold text-emerald-800">
                      <span>เบี้ยขยัน (ช่วงไฮซีซัน)</span>
                      <span>฿{calcResults.diligentPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.vacationRefundPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 font-bold text-purple-800">
                      <span>พักร้อนคืนเงิน</span>
                      <span>฿{calcResults.vacationRefundPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.seniorityPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 font-bold text-sky-800">
                      <span>ค่าอายุงานประจำปี</span>
                      <span>฿{calcResults.seniorityPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.specialDutyPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 font-bold text-amber-800">
                      <span>ค่าจุดพิเศษ</span>
                      <span>฿{calcResults.specialDutyPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.certificatePay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 font-bold text-teal-800">
                      <span>ค่าวุฒิบัตร</span>
                      <span>฿{calcResults.certificatePay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.kpiPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่า KPI</span>
                      <span className="font-bold">฿{calcResults.kpiPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.housingPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่าที่พัก</span>
                      <span className="font-bold">฿{calcResults.housingPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.positionPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>ค่าตำแหน่ง</span>
                      <span className="font-bold">฿{calcResults.positionPay.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.otherIncomePay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>รายได้เพิ่มเติม</span>
                      <span className="font-bold">฿{calcResults.otherIncomePay.toLocaleString()}</span>
                    </div>
                  )}
                  {customEarnings.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 border-b border-slate-100 text-emerald-800 font-bold">
                      <span>{item.name}</span>
                      <span>+฿{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {calcResults.bonusPay > 0 && (
                    <div className="flex justify-between py-1.5 bg-amber-50 px-2 rounded border border-amber-200 font-bold text-amber-900">
                      <span>🎁 โบนัสประจำปี (จ่าย ธ.ค.)</span>
                      <span>฿{calcResults.bonusPay.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 text-sm font-extrabold text-emerald-900 border-t-2 border-emerald-200">
                    <span>รวมรายได้ทั้งหมด</span>
                    <span>฿{Math.round(calcResults.grossEarnings).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider bg-rose-50 p-2 rounded-lg border border-rose-200">
                  รายการหัก (Deductions)
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>หัก ชำระหนี้ กยศ.</span>
                    <span className="font-bold text-rose-700">฿{calcResults.studentLoan.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>เงินสะสม ประกันสังคม</span>
                    <span className="font-bold text-rose-700">฿{calcResults.socialSecurity.toLocaleString()}</span>
                  </div>
                  {calcResults.kpiDeductionVal > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>หัก KPI</span>
                      <span className="font-bold text-rose-700">฿{calcResults.kpiDeductionVal.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResults.otherDeductionVal > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>รายการหักอื่นๆ</span>
                      <span className="font-bold text-rose-700">฿{calcResults.otherDeductionVal.toLocaleString()}</span>
                    </div>
                  )}
                  {customDeductions.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 border-b border-slate-100 text-rose-800 font-bold">
                      <span>{item.name}</span>
                      <span>-฿{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-extrabold text-rose-900 border-t-2 border-rose-200">
                    <span>รวมรายการหัก</span>
                    <span>฿{calcResults.totalDeductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Bottom Strip */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/30 text-white p-5 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-xl">
              <div className="space-y-1">
                <span className="text-xs text-indigo-300 block uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>ยอดเงินเดือนสุทธิประจำงวด {calcResults.separateMealPay ? "(ไม่รวมค่าข้าวเข้าบัตร)" : ""}</span>
                </span>
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>ยอดคำนวณสุทธิ: <strong className="text-white">฿{calculatedNetSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  <span>(รายได้เงินสด ฿{calcResults.grossSalaryCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - รายการหัก ฿{calcResults.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                </div>
                {calcResults.separateMealPay && (
                  <span className="block text-amber-300 font-medium text-[11px] pt-0.5">
                    💳 ค่าข้าวเข้าบัตรพนักงานต่างหาก: ฿{calcResults.mealPay.toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-end md:items-center gap-3 bg-indigo-900/60 p-3 rounded-xl border border-indigo-500/30">
                <div className="text-right">
                  <span className="text-[10px] text-slate-300 block font-semibold uppercase">เงินที่ได้รับจริง (โอนเข้าบัญชี)</span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight">
                    ฿{actualSalaryReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {salaryDiff !== 0 && (
                  <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border text-center whitespace-nowrap ${
                    salaryDiff > 0 
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}>
                    {salaryDiff > 0 ? `+฿${salaryDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-฿${Math.abs(salaryDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    <span className="block text-[9px] font-normal opacity-80">ส่วนต่าง</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANNUAL OVERVIEW CHART & SUMMARY */}
      {activeTab === "annual" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Year Selector */}
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <span>สรุปภาพรวมรายได้และเงินเดือนตลอดทั้งปี ({annualOverviewData.year})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                เปรียบเทียบรายได้รวม OT สวัสดิการ และเงินเดือนสุทธิรายเดือน พร้อมระบุรายการที่บันทึกแล้ว
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#1e293b] border border-white/10 p-1.5 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setAnnualSelectedYear(annualSelectedYear - 1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
              >
                ◀ {annualSelectedYear - 1}
              </button>
              <span className="px-4 py-1 text-sm font-black text-indigo-300">
                ปี {annualSelectedYear}
              </span>
              <button
                type="button"
                onClick={() => setAnnualSelectedYear(annualSelectedYear + 1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
              >
                {annualSelectedYear + 1} ▶
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-indigo-500/20 p-5 rounded-3xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">เงินเดือนสุทธิทั้งปี (Net)</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-300">
                ฿{annualOverviewData.totalNet.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400">เงินสดที่โอนเข้าบัญชีจริงทั้งปี</p>
            </div>

            <div className="bg-[#111827] border border-indigo-500/20 p-5 rounded-3xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">เฉลี่ยสุทธิ / เดือน</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Calculator className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-300">
                ฿{annualOverviewData.averageMonthlyNet.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400">คำนวณจากเฉลี่ย 12 เดือน</p>
            </div>

            <div className="bg-[#111827] border border-indigo-500/20 p-5 rounded-3xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">รายได้ OT สะสมทั้งปี</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-300">
                ฿{annualOverviewData.totalOT.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400">รวม OT 1.0 / 1.5 / 3.0 ทั้งปี</p>
            </div>

            <div className="bg-[#111827] border border-indigo-500/20 p-5 rounded-3xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">ค่าข้าวเข้าบัตรพนักงาน</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Utensils className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-300">
                ฿{annualOverviewData.totalMeal.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400">สวัสดิการอาหารแยกเข้าบัตร</p>
            </div>
          </div>

          {/* Visual Bar Chart Comparison */}
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>📊 กราฟเปรียบเทียบรายได้รายเดือน (ม.ค. - ธ.ค. {annualOverviewData.year})</span>
              </h4>

              {/* Clear Legend Badges for Mobile & Desktop */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-xs shadow-emerald-500/50" />
                  <span className="text-emerald-300 font-bold leading-normal">ได้รับจริงแล้ว (Recorded)</span>
                </div>
                <div className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/40 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0 shadow-xs shadow-indigo-500/50" />
                  <span className="text-indigo-300 font-bold leading-normal">คาดการณ์ (Projected)</span>
                </div>
              </div>
            </div>

            {/* Bars Container */}
            <div className="pt-4 pb-2 px-2 overflow-x-auto">
              <div className="min-w-[650px] h-64 flex items-end justify-between gap-3 border-b border-slate-700/60 pb-2">
                {annualOverviewData.list.map((m) => {
                  const netHeightPct = Math.round((m.netSalary / annualOverviewData.maxMonthlyGross) * 100);

                  return (
                    <div key={m.monthNum} className="flex-1 flex flex-col items-center gap-2 group relative">
                      {/* Tooltip Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-[#1e293b] border border-white/20 p-2 rounded-xl text-[10px] text-white shadow-2xl z-20 whitespace-nowrap pointer-events-none">
                        <div className="font-bold text-indigo-300">{m.monthName} {annualOverviewData.year}</div>
                        <div>สุทธิ: <strong className="text-emerald-300">฿{m.netSalary.toLocaleString()}</strong></div>
                        <div>ฐานเงินเดือน: ฿{m.baseSalary.toLocaleString()}</div>
                        <div>OT: ฿{m.otPay.toLocaleString()}</div>
                        <div>สถานะ: {m.isRecorded ? "✅ บันทึกแล้ว" : "⏳ คาดการณ์"}</div>
                      </div>

                      {/* Bar Graphic */}
                      <div className="w-full flex justify-center items-end h-48 bg-slate-800/40 rounded-t-xl p-1 relative">
                        <div
                          style={{ height: `${Math.max(netHeightPct, 6)}%` }}
                          className={`w-full max-w-[28px] rounded-t-lg transition-all duration-500 flex flex-col justify-between items-center py-1 ${
                            m.isRecorded
                              ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20"
                              : "bg-gradient-to-t from-indigo-700 to-indigo-500/70"
                          }`}
                        >
                          <span className="text-[9px] font-black text-white scale-90 tracking-tighter">
                            {(m.netSalary / 1000).toFixed(1)}k
                          </span>
                        </div>
                      </div>

                      {/* Month Label */}
                      <div className="text-center">
                        <span className="block text-xs font-bold text-slate-300">{m.monthName}</span>
                        {m.isRecorded ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mt-0.5" title="บันทึกแล้ว" />
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-600 mt-0.5" title="คาดการณ์" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 12-Month Detailed Summary Table */}
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📋 รายละเอียดเงินเดือน 12 เดือน ประจำปี {annualOverviewData.year}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  แสดงข้อมูลทั้งงวดที่บันทึกจริงลงกระเป๋าเงินแล้ว และงวดคาดการณ์ล่วงหน้า
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="px-3 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>บันทึกจริง: {annualOverviewData.recordedCount} เดือน</span>
                </span>
                <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-xl font-bold flex items-center gap-1.5">
                  <span>⏳ คาดการณ์: {annualOverviewData.projectedCount} เดือน</span>
                </span>
              </div>
            </div>

            {/* Explanation Note on How Forecast is Calculated */}
            <div className="text-[11px] bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-2xl text-slate-300 space-y-1">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>💡 ที่มาของการคำนวณยอด "คาดการณ์ (Projected)":</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 text-[11px] leading-relaxed">
                <li>
                  <strong>วันทำงาน & ค่าอาหาร/ค่าเดินทาง:</strong> คำนวณตามจำนวนวันทำงานจริงในปฏิทินของแต่ละเดือน (หักวันอาทิตย์ วันเสาร์หยุด และวันหยุดนักขัตฤกษ์ประจำเดือนนั้นๆ เช่น เม.ย. จะหักวันหยุดสงกรานต์)
                </li>
                <li>
                  <strong>ค่า OT คาดการณ์:</strong> คำนวณอ้างอิงจาก <span className="text-amber-300 font-bold">"ประวัติ OT เฉลี่ยจริงจากเดือนที่บันทึกไว้"</span> (ประมาณ ฿{annualOverviewData.averageHistoricalOTPay.toLocaleString()}/เดือน) หรือคำนวณจาก <span className="text-emerald-300 font-bold">"ข้อมูลลงเวลาประจำวันที่ระบุไว้"</span> ของเดือนนั้นๆ
                </li>
                <li>
                  <strong>ฐานเงินเดือน & โบนัส:</strong> รวมผลการปรับขึ้นเงินเดือนตามรอบย้อนหลัง/ล่วงหน้าที่ตั้งค่าไว้ + โบนัสประจำปี (ธ.ค.)
                </li>
              </ul>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">เดือน</th>
                    <th className="py-2.5 px-3">วันจ่ายเงินเดือน</th>
                    <th className="py-2.5 px-3">ฐานเงินเดือน</th>
                    <th className="py-2.5 px-3">รวม OT</th>
                    <th className="py-2.5 px-3">ค่าข้าวเข้าบัตร</th>
                    <th className="py-2.5 px-3">รายได้รวม</th>
                    <th className="py-2.5 px-3 text-right">เงินเดือนสุทธิ</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                    <th className="py-2.5 px-3 text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {annualOverviewData.list.map((m) => (
                    <tr key={m.monthNum} className={`hover:bg-white/5 transition-colors ${m.isCurrentSelected ? "bg-indigo-950/30" : ""}`}>
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                        <span>{m.monthName} {annualOverviewData.year}</span>
                        {m.isCurrentSelected && (
                          <span className="px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 text-[9px] rounded font-bold">
                            เลือกอยู่
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-300 text-xs">
                            {m.paydayInfo.formattedThai}
                          </span>
                          {m.paydayInfo.isShifted && (
                            <span className="text-[9px] text-amber-300 font-medium">
                              ⚠️ เลื่อนวันหยุด
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        ฿{m.baseSalary.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-amber-300">
                        ฿{m.otPay.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-purple-300">
                        ฿{m.mealPay.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-white font-bold">
                        ฿{m.grossCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-300 text-sm">
                        ฿{m.netSalary.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.isRecorded ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> บันทึกจริงแล้ว
                          </span>
                        ) : m.hasDailyLogs ? (
                          <span className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-bold inline-flex items-center gap-1" title="คำนวณจากบันทึกเวลาทำงานประจำวันที่ลงไว้ในระบบ">
                            📅 จากประวัติตารางงาน
                          </span>
                        ) : m.isCurrentSelected ? (
                          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            📝 ยอดคำนวณปัจจุบัน
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-white/10 rounded-full text-[10px] font-medium" title={`คาดการณ์จากวันทำงานจริง ${m.workingDays} วัน + OT เฉลี่ยอดีต`}>
                            ⏳ คาดการณ์ ({m.workingDays} วัน)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonth(m.monthKey);
                            setActiveTab("summary");
                          }}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                            m.isCurrentSelected
                              ? "bg-indigo-600 text-white border-indigo-400 shadow-md"
                              : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                          }`}
                        >
                          {m.isCurrentSelected ? "✏️ ป้อนข้อมูล/บันทึก" : "👉 สลับไปคำนวณเดือนนี้"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Explanatory Info Box */}
            <div className="bg-indigo-950/40 border border-indigo-500/20 p-4 rounded-2xl text-xs text-indigo-200/90 space-y-1">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>คำแนะนำการใช้งานและสถานะข้อมูลประจำปี:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 pl-1">
                <li><strong className="text-emerald-300">🟢 บันทึกจริงแล้ว:</strong> คือยอดเงินเดือนที่ผ่านการกด "บันทึกเงินเดือนลงกระเป๋าเงิน" เรียบร้อยแล้ว ซึ่งจะถูกนำยอดโอนจริงไปคำนวณในระบบบัญชี</li>
                <li><strong className="text-indigo-300">📝 ยอดคำนวณปัจจุบัน / ⏳ คาดการณ์:</strong> เป็นยอดประมาณการตามฐานเงินเดือนและสวัสดิการ สามารถกดปุ่ม <strong className="text-white">"สลับไปคำนวณเดือนนี้"</strong> เพื่อกรอกชั่วโมง OT วันลงเวลา หรือวันหยุดของเดือนนั้นๆ แล้วกดบันทึกเข้ากระเป๋าเงินได้ทันที</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <span>ตั้งค่าอัตราสวัสดิการ, รายรับพิเศษ & วันหยุดนักขัตฤกษ์</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveConfig(config);
              }}
              className="space-y-6"
            >
              {/* SECTION 1: ฐานเงินเดือน & รายรับเพิ่มเติม */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                  <DollarSign className="w-4 h-4" />
                  <span>ฐานเงินเดือน & รายรับประจำ/พิเศษ</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Base Salary */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">ฐานเงินเดือนเริ่มต้น (บาท)</label>
                    <input
                      type="number"
                      value={config.baseSalary}
                      onChange={(e) => setConfig({ ...config, baseSalary: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-sm"
                      required
                    />
                    <p className="text-[10px] text-slate-400">คำนวณ OT 1.0 = ฐานเงินเดือน ÷ 30 ÷ 8</p>
                  </div>

                  {/* Annual Bonus */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-amber-300">โบนัสประจำปี (จ่ายเดือน ธ.ค.)</label>
                    <input
                      type="number"
                      value={config.annualBonus}
                      onChange={(e) => setConfig({ ...config, annualBonus: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-amber-500/30 rounded-xl text-white font-bold text-sm"
                    />
                  </div>

                  {/* Diligent Allowance */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-emerald-300">เบี้ยขยัน (จ่ายช่วงไฮซีซัน)</label>
                    <input
                      type="number"
                      value={config.diligentAllowance}
                      onChange={(e) => setConfig({ ...config, diligentAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-emerald-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Vacation Refund */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-purple-300">พักร้อนคืนเงิน</label>
                    <input
                      type="number"
                      value={config.vacationRefund}
                      onChange={(e) => setConfig({ ...config, vacationRefund: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-purple-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Seniority Allowance */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-sky-300">ค่าอายุงานประจำปี</label>
                    <input
                      type="number"
                      value={config.seniorityAllowance}
                      onChange={(e) => setConfig({ ...config, seniorityAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-sky-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Special Duty Allowance */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-amber-300">ค่าจุดพิเศษ</label>
                    <input
                      type="number"
                      value={config.specialDutyAllowance}
                      onChange={(e) => setConfig({ ...config, specialDutyAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-amber-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Certificate Allowance */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-teal-300">ค่าวุฒิบัตร</label>
                    <input
                      type="number"
                      value={config.certificateAllowance}
                      onChange={(e) => setConfig({ ...config, certificateAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-teal-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Meal Allowance Daily */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่าข้าว (บาท/วัน - เริ่มต้น 47)</label>
                    <input
                      type="number"
                      value={config.mealAllowanceDaily}
                      onChange={(e) => setConfig({ ...config, mealAllowanceDaily: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Travel Allowance Daily */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่าเดินทาง (บาท/วัน - เริ่มต้น 50)</label>
                    <input
                      type="number"
                      value={config.travelAllowanceDaily}
                      onChange={(e) => setConfig({ ...config, travelAllowanceDaily: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* OT Meal Allowance Daily */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่าข้าว OT (บาท/วัน - เริ่มต้น 35 เมื่อ OT ≥ 2.5ชม.)</label>
                    <input
                      type="number"
                      value={config.otMealAllowanceDaily}
                      onChange={(e) => setConfig({ ...config, otMealAllowanceDaily: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Night Shift Allowance Daily */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่ากะดึก (บาท/วัน - เริ่มต้น 80)</label>
                    <input
                      type="number"
                      value={config.nightShiftAllowanceDaily}
                      onChange={(e) => setConfig({ ...config, nightShiftAllowanceDaily: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* KPI Allowance Monthly */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่า KPI (บาท/เดือน - เริ่มต้น 600)</label>
                    <input
                      type="number"
                      value={config.kpiAllowanceMonthly}
                      onChange={(e) => setConfig({ ...config, kpiAllowanceMonthly: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Housing Allowance Monthly */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่าที่พัก (บาท/เดือน - เริ่มต้น 800)</label>
                    <input
                      type="number"
                      value={config.housingAllowanceMonthly}
                      onChange={(e) => setConfig({ ...config, housingAllowanceMonthly: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Position Allowance Monthly */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">ค่าตำแหน่ง (บาท/เดือน - เริ่มต้น 300)</label>
                    <input
                      type="number"
                      value={config.positionAllowanceMonthly}
                      onChange={(e) => setConfig({ ...config, positionAllowanceMonthly: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Other Income Monthly */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">รายได้เพิ่มเติมอื่นๆ (บาท/เดือน)</label>
                    <input
                      type="number"
                      value={config.otherIncomeMonthly}
                      onChange={(e) => setConfig({ ...config, otherIncomeMonthly: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>
                </div>

                {/* Salary Raise Schedule Sub-section */}
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <ArrowUp className="w-4 h-4 text-emerald-400" />
                      <span>ประวัติ & กำหนดการปรับขึ้นเงินเดือน (Salary Raises Schedule):</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ระบุเดือนที่เริ่มปรับขึ้น และจำนวนเงิน/เปอร์เซ็นต์ที่ปรับ
                    </span>
                  </div>

                  {config.salaryRaises && config.salaryRaises.length > 0 ? (
                    <div className="space-y-2">
                      {config.salaryRaises.map((raise) => (
                        <div
                          key={raise.id}
                          className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-300">
                              เริ่มเดือน {raise.effectiveMonth}:
                            </span>{" "}
                            <span className="text-white font-semibold">
                              ปรับขึ้น {raise.type === "amount" ? `+฿${raise.value.toLocaleString()} บาท` : `+${raise.value}%`}
                            </span>
                            {raise.note && (
                              <span className="block text-[11px] text-slate-400 mt-0.5">
                                หมายเหตุ: {raise.note}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSalaryRaise(raise.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                            title="ลบรายการปรับขึ้นเงินเดือนนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic bg-white/5 p-3 rounded-xl">
                      ยังไม่มีการปรับขึ้นเงินเดือน (ใช้ฐานเงินเดือนปัจจุบัน ฿{config.baseSalary.toLocaleString()})
                    </div>
                  )}

                  {/* Add New Salary Raise Form */}
                  <div className="bg-[#1e293b]/60 border border-white/10 p-3 rounded-2xl space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 block">
                      + เพิ่มกำหนดการปรับขึ้นเงินเดือนใหม่:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">เดือนที่เริ่มปรับขึ้น</label>
                        <input
                          type="month"
                          value={newRaiseMonth}
                          onChange={(e) => setNewRaiseMonth(e.target.value)}
                          className="w-full px-2 py-1 bg-[#111827] border border-white/10 rounded-lg text-white text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">รูปแบบการปรับ</label>
                        <select
                          value={newRaiseType}
                          onChange={(e) => setNewRaiseType(e.target.value as "amount" | "percent")}
                          className="w-full px-2 py-1 bg-[#111827] border border-white/10 rounded-lg text-white text-xs font-bold"
                        >
                          <option value="amount">จำนวนเงิน (บาท)</option>
                          <option value="percent">เปอร์เซ็นต์ (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">
                          {newRaiseType === "amount" ? "จำนวนเงินที่ปรับขึ้น" : "เปอร์เซ็นต์ที่ปรับขึ้น (%)"}
                        </label>
                        <input
                          type="number"
                          placeholder={newRaiseType === "amount" ? "เช่น 1000" : "เช่น 5"}
                          value={newRaiseValue}
                          onChange={(e) => setNewRaiseValue(e.target.value)}
                          className="w-full px-2 py-1 bg-[#111827] border border-white/10 rounded-lg text-white text-xs font-bold"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddSalaryRaise}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มกำหนดการ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: รายการหัก */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>รายการหักเงินประจำเดือน</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Student Loan Deduction */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-rose-300">หัก กยศ. (บาท/เดือน - เริ่มต้น 900)</label>
                    <input
                      type="number"
                      value={config.studentLoanDeduction}
                      onChange={(e) => setConfig({ ...config, studentLoanDeduction: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-rose-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  {/* Social Security Percent & Max Cap */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-rose-300">อัตราหัก ประกันสังคม (%)</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, socialSecurityPercent: 4.8 })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition-all ${
                            config.socialSecurityPercent === 4.8
                              ? "bg-indigo-600 text-white border-indigo-400"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          4.8% (ปี 2569)
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, socialSecurityPercent: 5.0 })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition-all ${
                            config.socialSecurityPercent === 5.0
                              ? "bg-indigo-600 text-white border-indigo-400"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          5.0% (ปกติ)
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={config.socialSecurityPercent}
                      onChange={(e) => setConfig({ ...config, socialSecurityPercent: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-rose-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-rose-300">ยอดหักประกันสังคมสูงสุด (บาท/เดือน)</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, socialSecurityMaxCap: 730 })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition-all ${
                            config.socialSecurityMaxCap === 730
                              ? "bg-emerald-600 text-white border-emerald-400"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          730 บาท (สลิปบริษัท)
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, socialSecurityMaxCap: 750 })}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition-all ${
                            (config.socialSecurityMaxCap ?? 750) === 750
                              ? "bg-indigo-600 text-white border-indigo-400"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          750 บาท (ปกติ)
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      value={config.socialSecurityMaxCap ?? 750}
                      onChange={(e) => setConfig({ ...config, socialSecurityMaxCap: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-rose-500/30 rounded-xl text-white font-semibold text-sm"
                      placeholder="750"
                    />
                  </div>

                  {/* Wage Base Toggle */}
                  <div className="md:col-span-2 bg-indigo-950/30 border border-indigo-500/20 p-3.5 rounded-2xl space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!config.includeAllowancesInSocialSecurity}
                        onChange={(e) => setConfig({ ...config, includeAllowancesInSocialSecurity: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded border-white/20 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">
                          นำรายได้ที่มีลักษณะเป็น "เงินเดือนคงที่" (ค่าตำแหน่ง + ค่าเดินทางประจำ) มารวมในฐานคำนวณประกันสังคม
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          ตามกฎหมายประกันสังคม หากได้รับสวัสดิการค่าตำแหน่งคงที่ (฿{config.positionAllowanceMonthly.toLocaleString()}) และค่าเดินทางประจำ (฿{(config.travelAllowanceDaily * 27).toLocaleString()} / 27 วัน) จะถูกนำมารวมกับเงินเดือนหลักเป็นฐานคิด 
                          <span className="text-amber-300 font-bold ml-1">
                            (ฐานรวม = ฿{(config.baseSalary + config.positionAllowanceMonthly + config.travelAllowanceDaily * 27).toLocaleString()})
                          </span>
                        </p>
                      </div>
                    </label>

                    <div className="text-[10px] text-indigo-300/80 bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-500/10 mt-1">
                      💡 <strong>ตัวอย่างการคำนวณปี 2569:</strong> ฐานรวม 15,150 บาท × อัตราลดหย่อน 4.8% = 727.20 บาท (บริษัทอาจปัดเศษขึ้นเป็นยอด 730 บาท ถ้วนตามที่ปรากฏในสลิป)
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: ตั้งค่าวันหยุดนักขัตฤกษ์ & ปรับเลื่อนวันหยุด */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        ตั้งค่าวันหยุดนักขัตฤกษ์ & ปรับเลื่อนวันหยุด
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        เลือกปีที่ต้องการแสดง หรือเลือกปีเพื่อนำเข้าวันหยุดมาตรฐาน
                      </p>
                    </div>
                  </div>

                  {/* Clean Dropdowns for Filtering and Importing Year */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* 1. Filter Display Year Dropdown */}
                    <div className="flex items-center gap-1.5 bg-[#1e293b] px-2.5 py-1.5 rounded-xl border border-white/10">
                      <span className="text-[11px] text-slate-300 font-bold whitespace-nowrap">แสดงวันหยุดปี:</span>
                      <select
                        value={holidayYearFilter}
                        onChange={(e) => setHolidayYearFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
                      >
                        {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                          <option key={y} value={String(y)} className="bg-slate-900 text-white">
                            ปี {y} ({y + 543})
                          </option>
                        ))}
                        <option value="all" className="bg-slate-900 text-white">แสดงวันหยุดทุกปี (All)</option>
                      </select>
                    </div>

                    {/* 2. Import Preset Year Dropdown & Action */}
                    <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-xl border border-amber-500/30">
                      <select
                        id="importYearSelect"
                        defaultValue={holidayYearFilter === "all" ? "2027" : holidayYearFilter}
                        className="bg-transparent text-xs font-bold text-slate-200 px-2 py-0.5 focus:outline-none cursor-pointer"
                      >
                        {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                          <option key={y} value={String(y)} className="bg-slate-900 text-white">
                            ปี {y} ({y + 543})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("importYearSelect") as HTMLSelectElement;
                          const chosenYear = el ? el.value : "2027";
                          handleImportPresetHolidaysByYear(chosenYear);
                        }}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-[11px] rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        title="นำเข้าปฏิทินวันหยุดมาตรฐานสำหรับปีที่เลือก"
                      >
                        <span>⚡ นำเข้าวันหยุด</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Holiday Count Indicator */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/40 rounded-xl border border-white/5 text-xs text-slate-400 font-medium">
                  <span>
                    รายการวันหยุดในระบบ ({holidayYearFilter === "all" ? "ทุกปี" : `ปี ${holidayYearFilter} / ${parseInt(holidayYearFilter) + 543}`}):
                  </span>
                  <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                    {filteredHolidays.length} วัน
                  </span>
                </div>

                {/* Add new Holiday Form */}
                <div className="flex flex-col sm:flex-row items-end gap-2 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div className="flex-1 space-y-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-300">วันที่</label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-xs"
                    />
                  </div>
                  <div className="flex-1 space-y-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-300">ชื่อวันหยุดนักขัตฤกษ์ / วันชดเชย</label>
                    <input
                      type="text"
                      placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white font-bold text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPublicHoliday}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มวันหยุด</span>
                  </button>
                </div>

                {/* List of Public Holidays (Filtered by selected Year filter, with Edit & Delete support) */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredHolidays.length > 0 ? (
                    filteredHolidays.map((h) => {
                      const isEditing = editingHolidayId === h.id;

                      if (isEditing) {
                        return (
                          <div key={h.id} className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs">
                            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 w-full">
                              <input
                                type="date"
                                value={editHolidayDate}
                                onChange={(e) => setEditHolidayDate(e.target.value)}
                                className="px-2 py-1 bg-[#1e293b] border border-amber-500/40 rounded-lg text-white font-bold text-xs w-full sm:w-auto"
                              />
                              <input
                                type="text"
                                value={editHolidayName}
                                onChange={(e) => setEditHolidayName(e.target.value)}
                                className="px-2.5 py-1 bg-[#1e293b] border border-amber-500/40 rounded-lg text-white text-xs flex-1 w-full"
                                placeholder="ชื่อวันหยุด"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleSaveEditHoliday(h.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>บันทึก</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditHoliday}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={h.id} className="flex justify-between items-center p-2 bg-slate-800/60 border border-white/5 rounded-xl text-xs hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <Flag className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span className="font-bold text-amber-300 text-xs">{h.dateStr}</span>
                            <span className="text-slate-200 font-medium">{h.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditHoliday(h)}
                              className="text-slate-400 hover:text-amber-300 p-1 cursor-pointer transition-colors"
                              title="แก้ไขวันหยุดนี้"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePublicHoliday(h.id)}
                              className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                              title="ลบวันหยุดนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 italic bg-white/5 rounded-xl">
                      ยังไม่มีวันหยุดตั้งค่าไว้สำหรับปี {holidayYearFilter === "all" ? "ทั้งหมด" : holidayYearFilter} (กดปุ่ม "⚡ ปี {holidayYearFilter !== "all" ? holidayYearFilter : "2026"}" ด้านบนเพื่อนำเข้าวันหยุดประจำปีนี้)
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: ตั้งค่ากระเป๋าเงินรับเงิน & ค่าข้าวเข้าบัตรพนักงาน */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                  <Landmark className="w-4 h-4 text-indigo-400" />
                  <span>ตั้งค่ากระเป๋าเงินสำหรับรับเงิน (Wallets) & สวัสดิการค่าข้าว</span>
                </h4>

                <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-500/20 space-y-4">
                  {/* Separate Meal Pay Toggle */}
                  <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                    <input
                      type="checkbox"
                      id="separateMealPayToggle"
                      checked={config.separateMealPay !== false}
                      onChange={(e) => setConfig({ ...config, separateMealPay: e.target.checked })}
                      className="mt-0.5 w-4 h-4 accent-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="separateMealPayToggle" className="text-xs cursor-pointer space-y-0.5">
                      <span className="font-bold text-amber-300 block">
                        💳 แยกค่าข้าว (47 บาท/วัน) เข้ากระเป๋าบัตรพนักงาน (ไม่รวมกับเงินเดือนสุทธิ)
                      </span>
                      <span className="text-[11px] text-slate-300 block">
                        เมื่อเปิดใช้งาน เงินค่าข้าวจะถูกแยกเข้าบัตรพนักงานเป็นสิทธิ/หนี้สินค่ารับ และไม่นำไปรวมคำนวณเข้ายอดเงินเดือนสุทธิที่โอนเข้าบัญชีหลัก
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Default Salary Wallet */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                        <span>🏦 กระเป๋าเงินหลักสำหรับรับเงินเดือนสุทธิ</span>
                      </label>
                      <select
                        value={config.salaryWalletId || ""}
                        onChange={(e) => setConfig({ ...config, salaryWalletId: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e293b] border border-indigo-500/30 rounded-xl text-white font-semibold text-xs focus:outline-hidden cursor-pointer"
                      >
                        <option value="">-- เลือกกระเป๋าเงินเริ่มต้น --</option>
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.icon} {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Default Meal Allowance Wallet */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-amber-300 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>💳 กระเป๋าบัตรพนักงาน / ค่าข้าว</span>
                      </label>
                      <select
                        value={config.mealWalletId || ""}
                        onChange={(e) => setConfig({ ...config, mealWalletId: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e293b] border border-amber-500/30 rounded-xl text-white font-semibold text-xs focus:outline-hidden cursor-pointer"
                      >
                        <option value="">-- เลือกกระเป๋าบัตรพนักงาน --</option>
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.icon} {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าทั้งหมด</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
