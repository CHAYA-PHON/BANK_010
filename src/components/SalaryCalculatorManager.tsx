import React, { useState, useEffect, useMemo } from "react";
import { 
  Calculator, DollarSign, Calendar, Clock, Briefcase, Award, 
  CheckCircle2, Plus, Trash2, Settings, Save, FileSpreadsheet, 
  Download, Sparkles, Moon, Sun, AlertCircle, Building, Home, 
  Truck, Coffee, HelpCircle, Check, Edit, ShieldAlert, ArrowRight, 
  ChevronDown, ChevronUp, RefreshCw, Sliders, Landmark, Wallet as WalletIcon,
  Printer, ArrowUpRight, Flag, CalendarCheck, UserCheck, Star, ShieldCheck,
  FileCheck, Repeat, Loader2
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

export interface SalaryConfig {
  baseSalary: number; // ฐานเงินเดือน
  mealAllowanceDaily: number; // ค่าข้าว ต่อวัน (default 47)
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
  socialSecurityPercent: number; // ประกันสังคม % (default 5% max 750)
  kpiDeduction: number; // หัก KPI
  otherDeduction: number; // รายการหักเพิ่มเติม

  publicHolidays: PublicHolidayItem[]; // รายการวันหยุดนักขัตฤกษ์ที่กำหนดไว้
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

interface SalaryCalculatorManagerProps {
  wallets: Wallet[];
  onAddTransaction: (data: Omit<Transaction, "id" | "createdAt">) => void;
  currentUser: string;
}

const DEFAULT_HOLIDAYS: PublicHolidayItem[] = [
  { id: "h1", dateStr: "2026-01-01", name: "วันขึ้นปีใหม่" },
  { id: "h2", dateStr: "2026-04-13", name: "วันสงกรานต์" },
  { id: "h3", dateStr: "2026-04-14", name: "วันสงกรานต์" },
  { id: "h4", dateStr: "2026-04-15", name: "วันสงกรานต์" },
  { id: "h5", dateStr: "2026-05-01", name: "วันแรงงานแห่งชาติ" },
  { id: "h6", dateStr: "2026-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { id: "h7", dateStr: "2026-08-12", name: "วันแม่แห่งชาติ" },
  { id: "h8", dateStr: "2026-10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { id: "h9", dateStr: "2026-12-05", name: "วันพ่อแห่งชาติ" },
  { id: "h10", dateStr: "2026-12-10", name: "วันรัฐธรรมนูญ" },
  { id: "h11", dateStr: "2026-12-31", name: "วันสิ้นปี" },
];

const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  baseSalary: 15000,
  mealAllowanceDaily: 47,
  travelAllowanceDaily: 50,
  otMealAllowanceDaily: 35,
  nightShiftAllowanceDaily: 80,
  kpiAllowanceMonthly: 600,
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
  kpiDeduction: 0,
  otherDeduction: 0,
  publicHolidays: DEFAULT_HOLIDAYS,
};

export default function SalaryCalculatorManager({
  wallets,
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
  const [activeTab, setActiveTab] = useState<"summary" | "daily" | "payslip">("summary");

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

  // New Holiday Input state in config modal
  const [newHolidayDate, setNewHolidayDate] = useState<string>("");
  const [newHolidayName, setNewHolidayName] = useState<string>("");

  // Selected wallet for saving salary transaction
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || "");
  const [recordedSuccess, setRecordedSuccess] = useState<boolean>(false);

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
        localEarnings = [{ id: "ce-kpi1", name: "+KPI *ตักจับงานขาด", amount: 100 }];
        localDeductions = [{ id: "cd-kpi1", name: "-KPI *ส่งงานเกิน", amount: 500 }];
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

  // Handlers for Custom Earnings & Deductions
  const handleAddCustomEarning = () => {
    if (!newEarningName.trim()) {
      alert("กรุณากรอกชื่อรายการรับเพิ่มเติม");
      return;
    }
    const amt = Number(newEarningAmount) || 0;
    const newItem: CustomAdjustmentItem = {
      id: `ce_${Date.now()}`,
      name: newEarningName.trim(),
      amount: amt,
    };
    const updated = [...customEarnings, newItem];
    saveCustomAdjustments(updated, customDeductions);
    setNewEarningName("");
    setNewEarningAmount("");
  };

  const handleDeleteCustomEarning = (id: string) => {
    const updated = customEarnings.filter((item) => item.id !== id);
    saveCustomAdjustments(updated, customDeductions);
  };

  const handleAddCustomDeduction = () => {
    if (!newDeductionName.trim()) {
      alert("กรุณากรอกชื่อรายการหักเพิ่มเติม");
      return;
    }
    const amt = Number(newDeductionAmount) || 0;
    const newItem: CustomAdjustmentItem = {
      id: `cd_${Date.now()}`,
      name: newDeductionName.trim(),
      amount: amt,
    };
    const updated = [...customDeductions, newItem];
    saveCustomAdjustments(customEarnings, updated);
    setNewDeductionName("");
    setNewDeductionAmount("");
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
    const updatedHolidays = [
      ...config.publicHolidays,
      { id: `h_${Date.now()}`, dateStr: newHolidayDate, name: newHolidayName.trim() }
    ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const newConf = { ...config, publicHolidays: updatedHolidays };
    setConfig(newConf);
    localStorage.setItem(`salary_config_${currentUser || "default"}`, JSON.stringify(newConf));
    setNewHolidayDate("");
    setNewHolidayName("");

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

  // Delete Public Holiday
  const handleDeletePublicHoliday = async (id: string) => {
    const updatedHolidays = config.publicHolidays.filter(h => h.id !== id);
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
        const dayOfWeek = date.getDay(); // 0 = Sun
        const isSun = dayOfWeek === 0;

        const matchingHoliday = config.publicHolidays.find((h) => h.dateStr === dateStr);

        let initialStatus: WorkStatus = "work";
        if (matchingHoliday) {
          initialStatus = "public_holiday";
        } else if (isSun) {
          initialStatus = "off";
        }

        const savedItem = savedMap[d];
        if (savedItem) {
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

  // Persist dailyLogs to localStorage AND Firestore (with 400ms debounce for smooth editing)
  useEffect(() => {
    if (!selectedMonth || dailyLogs.length === 0) return;
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

  // Re-calculate totals from daily logs when in daily log mode
  useEffect(() => {
    if (!useDailyLog) return;
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
  }, [dailyLogs, useDailyLog]);

  // Main Salary Calculations
  const calcResults = useMemo(() => {
    // OT 1.0 Hourly Rate = Base Salary / 30 / 8
    const ot1Rate = config.baseSalary / 30 / 8;
    const ot15Rate = ot1Rate * 1.5;
    const ot3Rate = ot1Rate * 3.0;

    // Base salary for period
    let periodBaseSalary = config.baseSalary;
    let periodDaysCount = totalDaysInSelectedMonth;

    if (isDecember) {
      if (decemberPeriod === "p1") {
        // งวด 1: วันที่ 1-20 ธันวาคม (20 วัน) คำนวณจาก ฐานเงินเดือน / 31 * 20
        periodBaseSalary = (config.baseSalary / 31) * 20;
        periodDaysCount = 20;
      } else if (decemberPeriod === "p2") {
        // งวด 2: วันที่ 21-31 ธันวาคม (11 วัน) คำนวณจาก ฐานเงินเดือน / 31 * 11
        periodBaseSalary = (config.baseSalary / 31) * 11;
        periodDaysCount = 11;
      } else {
        periodBaseSalary = config.baseSalary;
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

    // Monthly fixed allowances
    const kpiPay = (isDecember && decemberPeriod === "p2") ? 0 : config.kpiAllowanceMonthly;
    const housingPay = (isDecember && decemberPeriod === "p2") ? 0 : config.housingAllowanceMonthly;
    const positionPay = (isDecember && decemberPeriod === "p2") ? 0 : config.positionAllowanceMonthly;
    const otherIncomePay = (isDecember && decemberPeriod === "p2") ? 0 : config.otherIncomeMonthly;

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

    // Total Gross Earnings
    const grossEarnings = 
      periodBaseSalary + 
      totalOTPay + 
      mealPay + 
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

    // Deductions
    const studentLoan = (isDecember && decemberPeriod === "p2") ? 0 : config.studentLoanDeduction;
    
    // Social Security: 5% capped at 750
    const rawSocSec = periodBaseSalary * (config.socialSecurityPercent / 100);
    const socialSecurity = (isDecember && decemberPeriod === "p2") ? 0 : Math.min(750, Math.round(rawSocSec));

    const kpiDeductionVal = config.kpiDeduction;
    const otherDeductionVal = config.otherDeduction;

    const totalDeductions = studentLoan + socialSecurity + kpiDeductionVal + otherDeductionVal + totalCustomDeductions;

    // Net Payable Salary
    const netSalary = Math.max(0, grossEarnings - totalDeductions);

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
  ]);

  // Handle Recording Income Transaction to Wallet
  const handleRecordToWallet = () => {
    if (!selectedWalletId) {
      alert("กรุณาเลือกกระเป๋าเงินสำหรับรับเงินเดือน");
      return;
    }

    const periodLabel = isDecember 
      ? (decemberPeriod === "p1" ? "งวดที่ 1 (1-20 ธ.ค.)" : decemberPeriod === "p2" ? "งวดที่ 2 (21-31 ธ.ค.)" : "งวดเต็มเดือน ธ.ค.")
      : "ประจำเดือน";

    const noteText = `[ระบบคำนวณเงินเดือน ${selectedMonth} ${periodLabel}]
• ฐานเงินเดือน/ค่าแรง: ฿${calcResults.periodBaseSalary.toLocaleString(undefined, { maximumFractionDigits: 2 })}
• รวม OT: ฿${calcResults.totalOTPay.toLocaleString()} (OT 1.5 = ${ot15HoursInput}ชม., OT 3.0 = ${ot30HoursInput}ชม.)
• ค่าข้าว & เดินทาง: ฿${(calcResults.mealPay + calcResults.travelPay + calcResults.otMealPay).toLocaleString()}
• เบี้ยขยัน/วุฒิ/จุดพิเศษ/อายุงาน: ฿${(calcResults.diligentPay + calcResults.certificatePay + calcResults.specialDutyPay + calcResults.seniorityPay + calcResults.vacationRefundPay).toLocaleString()}
• ค่ากะ & สวัสดิการ: ฿${(calcResults.nightShiftPay + calcResults.kpiPay + calcResults.housingPay + calcResults.positionPay + calcResults.otherIncomePay).toLocaleString()}
${customEarnings.length > 0 ? `• รายการรับเพิ่มเติม: ${customEarnings.map((e) => `${e.name} (+฿${e.amount})`).join(", ")}\n` : ""}${calcResults.bonusPay > 0 ? `• โบนัสประจำปี: ฿${calcResults.bonusPay.toLocaleString()}\n` : ""}• รายการหัก: -฿${calcResults.totalDeductions.toLocaleString()} (กยศ ฿${calcResults.studentLoan}, ประกันสังคม ฿${calcResults.socialSecurity}${customDeductions.length > 0 ? `, หักเพิ่มเติม: ${customDeductions.map((d) => `${d.name} -฿${d.amount}`).join(", ")}` : ""})`;

    onAddTransaction({
      type: "income",
      amount: Math.round(calcResults.netSalary),
      category: "เงินเดือน",
      merchantName: `เงินเดือน ${selectedMonth} (${periodLabel})`,
      date: new Date().toISOString().split("T")[0],
      note: noteText,
      walletId: selectedWalletId,
    });

    setRecordedSuccess(true);
    setTimeout(() => setRecordedSuccess(false), 4000);
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
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("summary");
                setUseDailyLog(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "summary"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>ป้อนสรุปเร็ว (Quick Summary)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("daily");
                setUseDailyLog(true);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "daily"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>ตารางลงเวลาประจำวัน (Daily Log)</span>
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
                  <div className="flex justify-between text-slate-300">
                    <span>ค่า KPI ประจำเดือน:</span>
                    <span className="font-bold text-white">฿{calcResults.kpiPay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ค่าที่พัก:</span>
                    <span className="font-bold text-white">฿{calcResults.housingPay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ค่าตำแหน่ง:</span>
                    <span className="font-bold text-white">฿{calcResults.positionPay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>รายได้เพิ่มเติมอื่นๆ:</span>
                    <span className="font-bold text-white">฿{calcResults.otherIncomePay.toLocaleString()}</span>
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

                  {/* Add Custom Earning Form */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="เช่น +KPI *ตักจับงานขาด"
                      value={newEarningName}
                      onChange={(e) => setNewEarningName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500"
                    />
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
                  <div className="flex justify-between text-slate-300">
                    <span>หัก กยศ.:</span>
                    <span className="font-bold text-rose-300">-฿{calcResults.studentLoan.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ประกันสังคม ({config.socialSecurityPercent}% สูงสุด 750฿):</span>
                    <span className="font-bold text-rose-300">-฿{calcResults.socialSecurity.toLocaleString()}</span>
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

                  {/* Add Custom Deduction Form */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="เช่น -KPI *ส่งงานเกิน"
                      value={newDeductionName}
                      onChange={(e) => setNewDeductionName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#1e293b] border border-white/10 rounded-xl text-white text-xs focus:border-rose-500"
                    />
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
                  ฿{Math.round(calcResults.netSalary).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ประจำเดือน {selectedMonth} {isDecember ? `(${decemberPeriod === "p1" ? "งวด 1: 1-20 ธ.ค." : decemberPeriod === "p2" ? "งวด 2: 21-31 ธ.ค." : "ทั้งเดือน"})` : ""}
                </p>
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
              <div className="border-t border-white/10 pt-4 space-y-3">
                <label className="block text-xs font-bold text-indigo-300">
                  🏦 บันทึกเงินเดือนสุทธิเข้ากระเป๋าเงิน
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

                <button
                  type="button"
                  onClick={handleRecordToWallet}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>บันทึกเป็นรายรับ ฿{Math.round(calcResults.netSalary).toLocaleString()}</span>
                </button>

                {recordedSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>บันทึกเงินเดือนเข้าบัญชีเรียบร้อยแล้ว!</span>
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
                      <span>ค่าอาหาร ({workDaysInput} วัน)</span>
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
            <div className="bg-indigo-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
              <div>
                <span className="text-xs text-indigo-200 block uppercase font-bold tracking-wider">
                  ยอดเงินรับสุทธิ (NET PAYABLE)
                </span>
                <span className="text-xs text-indigo-300">
                  รวมรายได้ ฿{Math.round(calcResults.grossEarnings).toLocaleString()} - รวมรายการหัก ฿{calcResults.totalDeductions.toLocaleString()}
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-300 tracking-tight">
                ฿{Math.round(calcResults.netSalary).toLocaleString()}
              </div>
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
                    <label className="block text-xs font-bold text-slate-300">ฐานเงินเดือน (บาท)</label>
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

                  {/* Social Security Percent */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-rose-300">หัก ประกันสังคม (% - ปกติ 5% สูงสุด 750฿)</label>
                    <input
                      type="number"
                      value={config.socialSecurityPercent}
                      onChange={(e) => setConfig({ ...config, socialSecurityPercent: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#1e293b] border border-rose-500/30 rounded-xl text-white font-semibold text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: ตั้งค่าวันหยุดนักขัตฤกษ์ & ปรับเลื่อนวันหยุด */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                  <Flag className="w-4 h-4" />
                  <span>ตั้งค่าวันหยุดนักขัตฤกษ์ & ปรับเลื่อนวันหยุด</span>
                </h4>

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

                {/* List of configured Public Holidays */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {config.publicHolidays.map((h) => (
                    <div key={h.id} className="flex justify-between items-center p-2 bg-slate-800/60 border border-white/5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="font-bold text-amber-300">{h.dateStr}</span>
                        <span className="text-slate-300 font-medium">{h.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePublicHoliday(h.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        title="ลบวันหยุดนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
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
