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
}

export interface Wallet {
  id: string;
  name: string;
  type: "cash" | "bank" | "credit" | "other";
  initialBalance: number;
  icon: string; // E.g., emoji or Lucide icon name
  color: string; // Tailwind gradient/color class
  accountNumber?: string;
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
