export type TransactionType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  merchantName: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  note?: string;
  imageUrl?: string; // Base64 or local blob URL for display
  createdAt: string;
  walletId?: string; // For expense/income/transfer (source)
  toWalletId?: string; // For transfer (destination)
  debtId?: string; // Optional field to link with a debt
}

export interface Wallet {
  id: string;
  name: string;
  type: "cash" | "bank" | "credit" | "other" | "saving";
  initialBalance: number;
  icon: string; // E.g., emoji or Lucide icon name
  color: string; // Tailwind gradient/color class
  accountNumber?: string;
  createdAt: string;
  sortOrder?: number;
  isDefault?: boolean;
  targetAmount?: number; // Target savings amount for savings jar (กระปุกออมสิน)
  dueDate?: string; // Due date for reaching the savings jar goal (YYYY-MM-DD)
  excludeFromTotal?: boolean; // ซ่อนยอดเงินนี้ ไม่รวมกับ ยอดเงินรวมทุกกระเป๋า
  goalPeriodValue?: number; // ระยะเวลาเป้าหมาย (เช่น 1, 10)
  goalPeriodUnit?: "month" | "year"; // หน่วยของระยะเวลาเป้าหมาย ("month" หรือ "year")
}

export interface MonthlyGoal {
  id: string; // "goal-YYYY-MM"
  month: string; // YYYY-MM
  amount: number; // monthly target savings amount in Baht
  createdAt: string;
}

export interface Debt {
  id: string;
  type: "borrowed" | "lent"; // "borrowed" = เราเป็นหนี้เขา, "lent" = เขาเป็นหนี้เรา
  creditorDebtorName: string; // ชื่อเจ้าหนี้ / ลูกหนี้
  amount: number; // ยอดกู้ยืมเริ่มต้น
  remainingAmount: number; // ยอดหนี้ที่ค้างอยู่
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  status: "active" | "paid";
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  walletId: string;
  date: string;
  note?: string;
  createdAt: string;
}

export interface CategoryInfo {
  name: string;
  color: string; // Tailwind class like "bg-red-500"
  icon: string; // Lucide icon name
  textColor: string; // Tailwind class like "text-red-500"
  borderColor: string; // Tailwind class like "border-red-200"
}

export const CATEGORIES: Record<string, CategoryInfo> = {
  "อาหารและเครื่องดื่ม": {
    name: "อาหารและเครื่องดื่ม",
    color: "bg-amber-100",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    icon: "Utensils",
  },
  "ช้อปปิ้งและของใช้": {
    name: "ช้อปปิ้งและของใช้",
    color: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: "ShoppingBag",
  },
  "การเดินทางและยานพาหนะ": {
    name: "การเดินทางและยานพาหนะ",
    color: "bg-purple-100",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    icon: "Car",
  },
  "ค่าสาธารณูปโภค": {
    name: "ค่าสาธารณูปโภค",
    color: "bg-cyan-100",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    icon: "Droplet",
  },
  "ความบันเทิง": {
    name: "ความบันเทิง",
    color: "bg-pink-100",
    textColor: "text-pink-700",
    borderColor: "border-pink-200",
    icon: "Tv",
  },
  "สุขภาพและความงาม": {
    name: "สุขภาพและความงาม",
    color: "bg-emerald-100",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    icon: "HeartPulse",
  },
  "ที่อยู่อาศัย": {
    name: "ที่อยู่อาศัย",
    color: "bg-orange-100",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    icon: "Home",
  },
  "เงินเดือนและรายได้": {
    name: "เงินเดือนและรายได้",
    color: "bg-green-100",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    icon: "Coins",
  },
  "ชำระหนี้": {
    name: "ชำระหนี้",
    color: "bg-rose-100",
    textColor: "text-rose-700",
    borderColor: "border-rose-200",
    icon: "Landmark",
  },
  "อื่นๆ": {
    name: "อื่นๆ",
    color: "bg-slate-100",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
    icon: "Grid",
  },
};

export const DEFAULT_CATEGORY_INFO: CategoryInfo = {
  name: "อื่นๆ",
  color: "bg-slate-100",
  textColor: "text-slate-700",
  borderColor: "border-slate-200",
  icon: "Grid",
};

export interface VehicleLog {
  id: string;
  date: string; // YYYY-MM-DD
  mileage: number; // km at oil change
  cost?: number;
  shopName?: string;
  note?: string;
}

export interface VehicleService {
  id: string;
  vehicleName: string; // e.g., "รถยนต์ Mazda 2", "รถมอเตอร์ไซค์ Click 125i"
  plateNumber?: string;
  currentMileage: number; // เลขมิเตอร์ปัจจุบัน (km)
  intervalKm: number; // กำหนดระยะ e.g. 3000 km
  intervalMonths: number; // กำหนดเดือน e.g. 4 เดือน
  lastServiceDate: string; // วันที่ถ่ายน้ำมันเครื่องล่าสุด (YYYY-MM-DD)
  lastServiceMileage: number; // เลขมิเตอร์ตอนถ่ายล่าสุด (km)
  lastServiceCost?: number;
  note?: string;
  history: VehicleLog[];
  createdAt: string;
}

export interface AcLog {
  id: string;
  date: string; // YYYY-MM-DD
  cost?: number;
  technician?: string;
  note?: string;
}

export interface AcService {
  id: string;
  name: string; // e.g., "แอร์ห้องนอน", "แอร์ห้องนั่งเล่น"
  location?: string;
  brand?: string;
  intervalMonths: number; // กำหนดเดือน e.g. 6 เดือน
  lastCleanDate: string; // วันที่ล้างแอร์ล่าสุด (YYYY-MM-DD)
  lastCleanCost?: number;
  technician?: string;
  note?: string;
  history: AcLog[];
  createdAt: string;
}

export interface UtilityBill {
  id: string;
  type: "electricity" | "water";
  billingMonth: string; // YYYY-MM (e.g. "2026-07")
  billDate: string; // YYYY-MM-DD
  startMeter: number; // เลขมิเตอร์ครั้งก่อน (e.g. 10710)
  endMeter: number; // เลขมิเตอร์ครั้งนี้ (e.g. 11253)
  unitsUsed: number; // จำนวนมิเตอร์ที่ใช้ไป (endMeter - startMeter)
  baseCost: number; // ค่าไฟ / ค่าน้ำ
  ftCost: number; // ค่า FT
  serviceFee: number; // ค่าบริการ
  vatPercent: number; // ภาษีมูลค่าเพิ่ม (%) เช่น 7
  vatAmount: number; // บาท
  totalAmount: number; // รวมเงิน
  ratePerUnit: number; // อัตราค่าน้ำ/ค่าไฟต่อหน่วย
  note?: string;
  walletId?: string; // กระเป๋าเงินที่ใช้จ่าย (ถ้าเลือก)
  paid?: boolean;
  createdAt: string;
}

