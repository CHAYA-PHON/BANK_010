import React, { useState, useMemo } from "react";
import { 
  UtilityBill, VehicleService, AcService, Wallet, Transaction, VehicleLog, AcLog, FuelLog, MaintenanceLog 
} from "../types";
import { 
  Zap, Droplet, Car, Snowflake, Gauge, Calendar, Plus, Trash2, Edit3, 
  CheckCircle2, AlertTriangle, Clock, History, BarChart3, TrendingUp, TrendingDown,
  Wrench, ChevronRight, Calculator, FileText, Check, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, Layers, Fuel
} from "lucide-react";

interface ServiceAndUtilityManagerProps {
  wallets: Wallet[];
  vehicles: VehicleService[];
  acServices: AcService[];
  utilityBills: UtilityBill[];
  onSaveVehicles: (vehicles: VehicleService[]) => void;
  onSaveAcServices: (acServices: AcService[]) => void;
  onSaveUtilityBills: (utilityBills: UtilityBill[]) => void;
  onAddTransaction?: (tx: Omit<Transaction, "id" | "createdAt">) => void;
  theme?: string;
}

export default function ServiceAndUtilityManager({
  wallets,
  vehicles,
  acServices,
  utilityBills,
  onSaveVehicles,
  onSaveAcServices,
  onSaveUtilityBills,
  onAddTransaction,
  theme = "dark"
}: ServiceAndUtilityManagerProps) {
  const [activeTab, setActiveTab] = useState<"utilities" | "vehicles" | "ac">("utilities");

  // Helper date utility
  const formatMonthTh = (yyyyMm: string) => {
    if (!yyyyMm || !yyyyMm.includes("-")) return yyyyMm;
    const [yearStr, monthStr] = yyyyMm.split("-");
    const year = parseInt(yearStr) + 543;
    const monthNames = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const monthIdx = parseInt(monthStr) - 1;
    return `${monthNames[monthIdx]} ${year}`;
  };

  const formatDateTh = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const monthNames = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  };

  const addMonthsToDate = (dateStr: string, months: number): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  const getDaysDiff = (targetDateStr: string): number => {
    if (!targetDateStr) return 999;
    const target = new Date(targetDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // ==========================================
  // UTILITY BILLS STATE & LOGIC
  // ==========================================
  const [showBillModal, setShowBillModal] = useState<boolean>(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billType, setBillType] = useState<"electricity" | "water">("electricity");
  const [billMonth, setBillMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [startMeter, setStartMeter] = useState<string>("");
  const [endMeter, setEndMeter] = useState<string>("");
  const [baseCost, setBaseCost] = useState<string>("");
  const [ftCost, setFtCost] = useState<string>("");
  const [serviceFee, setServiceFee] = useState<string>("");
  const [vatPercent, setVatPercent] = useState<string>("7");
  const [manualTotal, setManualTotal] = useState<string>("");
  const [billNote, setBillNote] = useState<string>("");
  const [billWalletId, setBillWalletId] = useState<string>("");
  const [autoFetchedMeterInfo, setAutoFetchedMeterInfo] = useState<string | null>(null);
  const [selectedUtilityYear, setSelectedUtilityYear] = useState<number>(new Date().getFullYear());
  const [historyYearFilter, setHistoryYearFilter] = useState<string>("selected");

  // Auto-fill previous meter when modal opens or billType/billMonth changes
  const handleOpenBillModal = (type: "electricity" | "water", billToEdit?: UtilityBill) => {
    if (billToEdit) {
      setEditingBillId(billToEdit.id);
      setBillType(billToEdit.type);
      setBillMonth(billToEdit.billingMonth);
      setBillDate(billToEdit.billDate);
      setStartMeter(billToEdit.startMeter.toString());
      setEndMeter(billToEdit.endMeter.toString());
      setBaseCost(billToEdit.baseCost.toString());
      setFtCost(billToEdit.ftCost.toString());
      setServiceFee(billToEdit.serviceFee.toString());
      setVatPercent(billToEdit.vatPercent.toString());
      setManualTotal(billToEdit.totalAmount.toString());
      setBillNote(billToEdit.note || "");
      setBillWalletId(billToEdit.walletId || "");
      setAutoFetchedMeterInfo(null);
    } else {
      setEditingBillId(null);
      setBillType(type);
      const currentYm = new Date().toISOString().slice(0, 7);
      setBillMonth(currentYm);
      setBillDate(new Date().toISOString().slice(0, 10));
      setBaseCost("");
      setFtCost(type === "electricity" ? "88.13" : "0");
      setServiceFee(type === "electricity" ? "24.62" : "0");
      setVatPercent("7");
      setManualTotal("");
      setBillNote("");
      setBillWalletId(wallets.find(w => w.isDefault)?.id || wallets[0]?.id || "");

      // Auto fetch previous month's ending meter
      const previousBill = utilityBills
        .filter(b => b.type === type)
        .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))[0];

      if (previousBill && previousBill.endMeter) {
        setStartMeter(previousBill.endMeter.toString());
        setEndMeter("");
        setAutoFetchedMeterInfo(`ดึงเลขมิเตอร์สิ้นสุดของเดือน ${formatMonthTh(previousBill.billingMonth)} (${previousBill.endMeter.toLocaleString()}) มาให้อัตโนมัติ`);
      } else {
        setStartMeter("");
        setEndMeter("");
        setAutoFetchedMeterInfo(null);
      }
    }
    setShowBillModal(true);
  };

  // Re-check auto-fetch when type changes inside form
  const handleTypeChangeInModal = (newType: "electricity" | "water") => {
    setBillType(newType);
    if (!editingBillId) {
      setFtCost(newType === "electricity" ? "88.13" : "0");
      setServiceFee(newType === "electricity" ? "24.62" : "0");
      const previousBill = utilityBills
        .filter(b => b.type === newType)
        .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))[0];

      if (previousBill && previousBill.endMeter) {
        setStartMeter(previousBill.endMeter.toString());
        setAutoFetchedMeterInfo(`ดึงเลขมิเตอร์สิ้นสุดของเดือน ${formatMonthTh(previousBill.billingMonth)} (${previousBill.endMeter.toLocaleString()}) มาให้อัตโนมัติ`);
      } else {
        setStartMeter("");
        setAutoFetchedMeterInfo(null);
      }
    }
  };

  // Live calculations for bill modal
  const calcStartMeter = parseFloat(startMeter) || 0;
  const calcEndMeter = parseFloat(endMeter) || 0;
  const calcUnitsUsed = Math.max(0, calcEndMeter - calcStartMeter);

  const calcFtCost = parseFloat(ftCost) || 0; // Empty counts as 0
  const calcServiceFee = parseFloat(serviceFee) || 0; // Empty counts as 0
  const calcVatPercent = parseFloat(vatPercent) || 0;

  const hasManualTotal = manualTotal.trim() !== "";
  const parsedManualTotal = parseFloat(manualTotal) || 0;
  const hasBaseCost = baseCost.trim() !== "";

  let calcBaseCost = 0;
  let calcSubtotal = 0;
  let calcVatAmount = 0;
  let computedTotal = 0;
  let finalTotalAmount = 0;
  let isReverseCalculated = false;

  if (hasBaseCost) {
    // Forward calculation when base cost is explicitly typed
    calcBaseCost = parseFloat(baseCost) || 0;
    calcSubtotal = calcBaseCost + calcFtCost + calcServiceFee;
    calcVatAmount = Math.round((calcSubtotal * (calcVatPercent / 100)) * 100) / 100;
    computedTotal = Math.round((calcSubtotal + calcVatAmount) * 100) / 100;
    finalTotalAmount = hasManualTotal ? parsedManualTotal : computedTotal;
  } else if (hasManualTotal && parsedManualTotal > 0) {
    // Reverse calculation when ONLY manualTotal is provided (baseCost is blank)
    isReverseCalculated = true;
    finalTotalAmount = parsedManualTotal;
    calcSubtotal = calcVatPercent > 0 
      ? Math.round((finalTotalAmount / (1 + calcVatPercent / 100)) * 100) / 100
      : finalTotalAmount;
    calcVatAmount = Math.round((finalTotalAmount - calcSubtotal) * 100) / 100;
    calcBaseCost = Math.max(0, Math.round((calcSubtotal - calcFtCost - calcServiceFee) * 100) / 100);
    computedTotal = finalTotalAmount;
  } else {
    calcBaseCost = 0;
    calcSubtotal = calcFtCost + calcServiceFee;
    calcVatAmount = Math.round((calcSubtotal * (calcVatPercent / 100)) * 100) / 100;
    computedTotal = Math.round((calcSubtotal + calcVatAmount) * 100) / 100;
    finalTotalAmount = computedTotal;
  }

  const calcRatePerUnit = calcUnitsUsed > 0 ? (finalTotalAmount / calcUnitsUsed) : 0;

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (calcEndMeter <= calcStartMeter && calcStartMeter > 0) {
      if (!confirm("เลขมิเตอร์ครั้งนี้ น้อยกว่าหรือเท่ากับ ครั้งก่อนหน้า คุณแน่ใจหรือไม่ที่จะบันทึก?")) {
        return;
      }
    }

    const billData: UtilityBill = {
      id: editingBillId || `bill-${Date.now()}`,
      type: billType,
      billingMonth: billMonth,
      billDate: billDate,
      startMeter: calcStartMeter,
      endMeter: calcEndMeter,
      unitsUsed: calcUnitsUsed,
      baseCost: calcBaseCost,
      ftCost: calcFtCost,
      serviceFee: calcServiceFee,
      vatPercent: calcVatPercent,
      vatAmount: calcVatAmount,
      totalAmount: finalTotalAmount,
      ratePerUnit: calcRatePerUnit,
      note: billNote,
      walletId: billWalletId,
      paid: true,
      createdAt: new Date().toISOString()
    };

    let updatedBills: UtilityBill[];
    if (editingBillId) {
      updatedBills = utilityBills.map(b => b.id === editingBillId ? billData : b);
    } else {
      updatedBills = [billData, ...utilityBills];
    }

    onSaveUtilityBills(updatedBills);

    // Optionally create Expense transaction if wallet selected and adding new bill
    if (!editingBillId && billWalletId && onAddTransaction && finalTotalAmount > 0) {
      onAddTransaction({
        type: "expense",
        amount: finalTotalAmount,
        category: "ค่าสาธารณูปโภค",
        merchantName: billType === "electricity" ? `ค่าไฟฟ้า (${formatMonthTh(billMonth)})` : `ค่าน้ำประปา (${formatMonthTh(billMonth)})`,
        date: billDate,
        note: `เลขมิเตอร์: ${calcStartMeter} -> ${calcEndMeter} (${calcUnitsUsed} หน่วย, @${calcRatePerUnit.toFixed(2)} บ./หน่วย)`,
        walletId: billWalletId
      });
    }

    setShowBillModal(false);
  };

  const handleDeleteBill = (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบบิลนี้?")) {
      onSaveUtilityBills(utilityBills.filter(b => b.id !== id));
    }
  };

  // Utility Bill Sorting & Monthly/Yearly Stats
  const sortedUtilityBills = useMemo(() => {
    return [...utilityBills].sort((a, b) => b.billingMonth.localeCompare(a.billingMonth) || b.billDate.localeCompare(a.billDate));
  }, [utilityBills]);

  const yearlyBills = useMemo(() => {
    return sortedUtilityBills.filter(b => b.billingMonth.startsWith(selectedUtilityYear.toString()));
  }, [sortedUtilityBills, selectedUtilityYear]);

  const availableUtilityYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(selectedUtilityYear);
    utilityBills.forEach(b => {
      const y = parseInt(b.billingMonth.split("-")[0]);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [utilityBills, selectedUtilityYear]);

  const filteredHistoryBills = useMemo(() => {
    if (historyYearFilter === "all") {
      return sortedUtilityBills;
    }
    const targetYear = historyYearFilter === "selected" ? selectedUtilityYear.toString() : historyYearFilter;
    return sortedUtilityBills.filter(b => b.billingMonth.startsWith(targetYear));
  }, [sortedUtilityBills, historyYearFilter, selectedUtilityYear]);

  // Compare previous month helper for a bill
  const getBillPreviousMonthComparison = (bill: UtilityBill) => {
    const [y, m] = bill.billingMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYm = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;
    const prevBill = utilityBills.find(b => b.type === bill.type && b.billingMonth === prevYm);

    if (!prevBill) return null;

    const diffAmount = bill.totalAmount - prevBill.totalAmount;
    const diffPercent = prevBill.totalAmount > 0 ? (diffAmount / prevBill.totalAmount) * 100 : 0;
    const diffUnits = bill.unitsUsed - prevBill.unitsUsed;
    const diffUnitsPercent = prevBill.unitsUsed > 0 ? (diffUnits / prevBill.unitsUsed) * 100 : 0;

    return {
      prevMonth: prevYm,
      diffAmount,
      diffPercent,
      diffUnits,
      diffUnitsPercent
    };
  };

  // Yearly monthly matrix for chart
  const monthlyMatrix = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mStr = (i + 1).toString().padStart(2, "0");
      const ym = `${selectedUtilityYear}-${mStr}`;
      const elecBill = yearlyBills.find(b => b.type === "electricity" && b.billingMonth === ym);
      const waterBill = yearlyBills.find(b => b.type === "water" && b.billingMonth === ym);
      
      const elecAmount = elecBill ? elecBill.totalAmount : 0;
      const waterAmount = waterBill ? waterBill.totalAmount : 0;
      const elecUnits = elecBill ? elecBill.unitsUsed : 0;
      const waterUnits = waterBill ? waterBill.unitsUsed : 0;

      return {
        monthIndex: i,
        monthName: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][i],
        ym,
        elecBill,
        waterBill,
        elecAmount,
        waterAmount,
        elecUnits,
        waterUnits,
        totalAmount: elecAmount + waterAmount
      };
    });

    const maxMonthlyTotal = Math.max(...months.map(m => m.totalAmount), 1);
    const totalElecYear = months.reduce((sum, m) => sum + m.elecAmount, 0);
    const totalWaterYear = months.reduce((sum, m) => sum + m.waterAmount, 0);
    const totalYear = totalElecYear + totalWaterYear;
    const activeMonthsCount = months.filter(m => m.totalAmount > 0).length || 1;
    const avgMonthly = totalYear / activeMonthsCount;

    return {
      months,
      maxMonthlyTotal,
      totalElecYear,
      totalWaterYear,
      totalYear,
      avgMonthly
    };
  }, [yearlyBills, selectedUtilityYear]);

  // ==========================================
  // VEHICLE MILEAGE & OIL CHANGE STATE & LOGIC
  // ==========================================
  const [showVehicleModal, setShowVehicleModal] = useState<boolean>(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleName, setVehicleName] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");
  const [vehicleCurrentMileage, setVehicleCurrentMileage] = useState<string>("");
  const [vehicleIntervalKm, setVehicleIntervalKm] = useState<string>("3000");
  const [vehicleIntervalMonths, setVehicleIntervalMonths] = useState<string>("4");
  const [vehicleLastDate, setVehicleLastDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [vehicleLastMileage, setVehicleLastMileage] = useState<string>("");
  const [vehicleLastCost, setVehicleLastCost] = useState<string>("");
  const [vehicleTankCapacity, setVehicleTankCapacity] = useState<string>("");
  const [vehicleNote, setVehicleNote] = useState<string>("");

  // Record Fuel Log Modal State
  const [showFuelLogModal, setShowFuelLogModal] = useState<boolean>(false);
  const [fuelingVehicle, setFuelingVehicle] = useState<VehicleService | null>(null);
  const [editingFuelLogId, setEditingFuelLogId] = useState<string | null>(null);
  const [fuelDate, setFuelDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fuelMileage, setFuelMileage] = useState<string>("");
  const [fuelCost, setFuelCost] = useState<string>("");
  const [fuelLiters, setFuelLiters] = useState<string>("");
  const [fuelTankCapacityInput, setFuelTankCapacityInput] = useState<string>("");
  const [fuelStation, setFuelStation] = useState<string>("");
  const [fuelType, setFuelType] = useState<string>("แก๊สโซฮอล์ 95");
  const [fuelIsFull, setFuelIsFull] = useState<boolean>(true);
  const [fuelNote, setFuelNote] = useState<string>("");
  const [fuelWalletId, setFuelWalletId] = useState<string>("");

  // Record Maintenance Log Modal State
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<boolean>(false);
  const [maintainingVehicle, setMaintainingVehicle] = useState<VehicleService | null>(null);
  const [editingMaintLogId, setEditingMaintLogId] = useState<string | null>(null);
  const [maintDate, setMaintDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [maintMileage, setMaintMileage] = useState<string>("");
  const [maintTitle, setMaintTitle] = useState<string>("");
  const [maintCategory, setMaintCategory] = useState<string>("ทั่วไป");
  const [maintCost, setMaintCost] = useState<string>("");
  const [maintShop, setMaintShop] = useState<string>("");
  const [maintNote, setMaintNote] = useState<string>("");
  const [maintWalletId, setMaintWalletId] = useState<string>("");

  // Vehicle Expense Summary Filters State
  const [vehicleExpenseSelectedVehicle, setVehicleExpenseSelectedVehicle] = useState<string>("all");
  const [vehicleExpenseSelectedYear, setVehicleExpenseSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Quick Mileage Update Modal
  const [showMileageUpdateModal, setShowMileageUpdateModal] = useState<boolean>(false);
  const [updatingVehicle, setUpdatingVehicle] = useState<VehicleService | null>(null);
  const [newMileageInput, setNewMileageInput] = useState<string>("");

  // Record New Oil Change Log Modal
  const [showOilChangeLogModal, setShowOilChangeLogModal] = useState<boolean>(false);
  const [loggingVehicle, setLoggingVehicle] = useState<VehicleService | null>(null);
  const [logDate, setLogDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [logMileage, setLogMileage] = useState<string>("");
  const [logCost, setLogCost] = useState<string>("");
  const [logShop, setLogShop] = useState<string>("");
  const [logNote, setLogNote] = useState<string>("");
  const [logWalletId, setLogWalletId] = useState<string>("");

  // History Log Viewer Modal
  const [viewHistoryVehicle, setViewHistoryVehicle] = useState<VehicleService | null>(null);
  const [vehicleHistoryTab, setVehicleHistoryTab] = useState<"fuel" | "oil" | "maint">("fuel");

  // Helper to recalculate km/L for all fuel logs
  const computeFuelHistoryWithKml = (fuelLogs: FuelLog[]): FuelLog[] => {
    if (!fuelLogs || fuelLogs.length === 0) return [];
    const sortedAsc = [...fuelLogs].sort((a, b) => a.mileage - b.mileage || a.date.localeCompare(b.date));
    
    const processed = sortedAsc.map((log, index) => {
      if (index === 0) {
        return { ...log, kmPerLiter: undefined };
      }
      const prevLog = sortedAsc[index - 1];
      const distanceDriven = log.mileage - prevLog.mileage;
      if (distanceDriven > 0 && log.liters && log.liters > 0) {
        const kml = distanceDriven / log.liters;
        return { ...log, kmPerLiter: parseFloat(kml.toFixed(2)) };
      }
      return { ...log, kmPerLiter: undefined };
    });

    return processed.sort((a, b) => b.date.localeCompare(a.date) || b.mileage - a.mileage);
  };

  const getVehicleAverageKmPerLiter = (v: VehicleService): number | null => {
    const history = computeFuelHistoryWithKml(v.fuelHistory || []);
    const validKml = history.map(h => h.kmPerLiter).filter((k): k is number => typeof k === "number" && k > 0);
    if (validKml.length === 0) return null;
    const sum = validKml.reduce((acc, cur) => acc + cur, 0);
    return parseFloat((sum / validKml.length).toFixed(2));
  };

  const handleOpenVehicleModal = (veh?: VehicleService) => {
    if (veh) {
      setEditingVehicleId(veh.id);
      setVehicleName(veh.vehicleName);
      setVehiclePlate(veh.plateNumber || "");
      setVehicleCurrentMileage(veh.currentMileage.toString());
      setVehicleIntervalKm(veh.intervalKm.toString());
      setVehicleIntervalMonths(veh.intervalMonths.toString());
      setVehicleLastDate(veh.lastServiceDate);
      setVehicleLastMileage(veh.lastServiceMileage.toString());
      setVehicleLastCost((veh.lastServiceCost || "").toString());
      setVehicleTankCapacity((veh.tankCapacity || "").toString());
      setVehicleNote(veh.note || "");
    } else {
      setEditingVehicleId(null);
      setVehicleName("");
      setVehiclePlate("");
      setVehicleCurrentMileage("");
      setVehicleIntervalKm("3000");
      setVehicleIntervalMonths("4");
      setVehicleLastDate(new Date().toISOString().slice(0, 10));
      setVehicleLastMileage("");
      setVehicleLastCost("");
      setVehicleTankCapacity("45");
      setVehicleNote("");
    }
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const currKm = parseFloat(vehicleCurrentMileage) || 0;
    const lastKm = parseFloat(vehicleLastMileage) || 0;
    const intKm = parseFloat(vehicleIntervalKm) || 3000;
    const intM = parseInt(vehicleIntervalMonths) || 4;
    const cost = parseFloat(vehicleLastCost) || 0;
    const tankCap = parseFloat(vehicleTankCapacity) || undefined;

    const existingVeh = editingVehicleId ? vehicles.find(v => v.id === editingVehicleId) : null;

    const newVehicle: VehicleService = {
      id: editingVehicleId || `veh-${Date.now()}`,
      vehicleName: vehicleName || "รถส่วนตัว",
      plateNumber: vehiclePlate,
      currentMileage: Math.max(currKm, lastKm),
      intervalKm: intKm,
      intervalMonths: intM,
      lastServiceDate: vehicleLastDate,
      lastServiceMileage: lastKm,
      lastServiceCost: cost,
      tankCapacity: tankCap,
      fuelHistory: existingVeh?.fuelHistory || [],
      note: vehicleNote,
      history: existingVeh ? (existingVeh.history || []) : [
        {
          id: `log-${Date.now()}`,
          date: vehicleLastDate,
          mileage: lastKm,
          cost: cost,
          note: "บันทึกครั้งแรก"
        }
      ],
      createdAt: new Date().toISOString()
    };

    let updated: VehicleService[];
    if (editingVehicleId) {
      updated = vehicles.map(v => v.id === editingVehicleId ? newVehicle : v);
    } else {
      updated = [newVehicle, ...vehicles];
    }

    onSaveVehicles(updated);
    setShowVehicleModal(false);
  };

  const handleDeleteVehicle = (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการรถนี้?")) {
      onSaveVehicles(vehicles.filter(v => v.id !== id));
    }
  };

  // Fuel Refill Handlers
  const handleOpenFuelLogModal = (v: VehicleService, fuelLogToEdit?: FuelLog) => {
    setFuelingVehicle(v);
    if (fuelLogToEdit) {
      setEditingFuelLogId(fuelLogToEdit.id);
      setFuelDate(fuelLogToEdit.date);
      setFuelMileage(fuelLogToEdit.mileage.toString());
      setFuelCost(fuelLogToEdit.totalCost.toString());
      setFuelLiters((fuelLogToEdit.liters || "").toString());
      setFuelTankCapacityInput((v.tankCapacity || 45).toString());
      setFuelStation(fuelLogToEdit.gasStation || "");
      setFuelType(fuelLogToEdit.fuelType || "แก๊สโซฮอล์ 95");
      setFuelIsFull(fuelLogToEdit.isFullTank ?? true);
      setFuelNote(fuelLogToEdit.note || "");
      setFuelWalletId(fuelLogToEdit.walletId || "");
    } else {
      setEditingFuelLogId(null);
      setFuelDate(new Date().toISOString().slice(0, 10));
      setFuelMileage(v.currentMileage.toString());
      setFuelCost("");
      setFuelLiters("");
      const isBike = v.vehicleName.toLowerCase().includes("มอเตอร์ไซค์") || v.vehicleName.toLowerCase().includes("click") || v.vehicleName.toLowerCase().includes("wave");
      setFuelTankCapacityInput((v.tankCapacity || (isBike ? 5.5 : 45)).toString());
      setFuelStation("");
      setFuelType("แก๊สโซฮอล์ 95");
      setFuelIsFull(true);
      setFuelNote("");
      setFuelWalletId(wallets.find(w => w.isDefault)?.id || wallets[0]?.id || "");
    }
    setShowFuelLogModal(true);
  };

  const handleSaveFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelingVehicle) return;

    const costVal = parseFloat(fuelCost) || 0;
    const litersVal = parseFloat(fuelLiters) || 0;
    const capVal = parseFloat(fuelTankCapacityInput) || 0;
    const km = parseFloat(fuelMileage) || fuelingVehicle.currentMileage;

    const pricePerLiter = litersVal > 0 && costVal > 0 ? (costVal / litersVal) : undefined;
    const fuelPercent = (litersVal > 0 && capVal > 0) ? ((litersVal / capVal) * 100) : undefined;

    const logData: FuelLog = {
      id: editingFuelLogId || `fuel-${Date.now()}`,
      date: fuelDate,
      mileage: km,
      totalCost: costVal,
      liters: litersVal > 0 ? litersVal : undefined,
      pricePerLiter: pricePerLiter,
      fuelPercent: fuelPercent,
      gasStation: fuelStation,
      fuelType: fuelType,
      isFullTank: fuelIsFull,
      note: fuelNote,
      walletId: fuelWalletId
    };

    let updatedFuelHistory = fuelingVehicle.fuelHistory || [];
    if (editingFuelLogId) {
      updatedFuelHistory = updatedFuelHistory.map(f => f.id === editingFuelLogId ? logData : f);
    } else {
      updatedFuelHistory = [logData, ...updatedFuelHistory];
    }

    // Recalculate fuel efficiency km/L
    updatedFuelHistory = computeFuelHistoryWithKml(updatedFuelHistory);

    const updatedVehicle: VehicleService = {
      ...fuelingVehicle,
      tankCapacity: capVal > 0 ? capVal : fuelingVehicle.tankCapacity,
      currentMileage: Math.max(fuelingVehicle.currentMileage, km),
      fuelHistory: updatedFuelHistory
    };

    const updatedList = vehicles.map(v => v.id === fuelingVehicle.id ? updatedVehicle : v);
    onSaveVehicles(updatedList);

    if (viewHistoryVehicle && viewHistoryVehicle.id === fuelingVehicle.id) {
      setViewHistoryVehicle(updatedVehicle);
    }

    if (!editingFuelLogId && fuelWalletId && onAddTransaction && costVal > 0) {
      onAddTransaction({
        type: "expense",
        amount: costVal,
        category: "การเดินทางและยานพาหนะ",
        merchantName: `เติมน้ำมัน (${fuelingVehicle.vehicleName})`,
        date: fuelDate,
        note: `เลขมิเตอร์: ${km.toLocaleString()} km${litersVal > 0 ? `, ${litersVal} ลิตร (฿${pricePerLiter?.toFixed(2)}/ลิตร)` : ""}${fuelPercent ? `, เติม ~${fuelPercent.toFixed(1)}% ถัง` : ""}${fuelStation ? `, ปั๊ม: ${fuelStation}` : ""}`,
        walletId: fuelWalletId
      });
    }

    setShowFuelLogModal(false);
  };

  const handleDeleteFuelLog = (vehicleId: string, logId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการเติมน้ำมันนี้?")) return;
    const targetVehicle = vehicles.find(v => v.id === vehicleId);
    if (!targetVehicle) return;

    let updatedHistory = (targetVehicle.fuelHistory || []).filter(f => f.id !== logId);
    updatedHistory = computeFuelHistoryWithKml(updatedHistory);

    const updatedVehicle = { ...targetVehicle, fuelHistory: updatedHistory };
    const updatedList = vehicles.map(v => v.id === vehicleId ? updatedVehicle : v);
    onSaveVehicles(updatedList);

    if (viewHistoryVehicle && viewHistoryVehicle.id === vehicleId) {
      setViewHistoryVehicle(updatedVehicle);
    }
  };

  // Maintenance Handlers
  const handleOpenMaintenanceModal = (v: VehicleService, logToEdit?: MaintenanceLog) => {
    setMaintainingVehicle(v);
    if (logToEdit) {
      setEditingMaintLogId(logToEdit.id);
      setMaintDate(logToEdit.date);
      setMaintMileage(logToEdit.mileage.toString());
      setMaintTitle(logToEdit.title);
      setMaintCategory(logToEdit.category || "ทั่วไป");
      setMaintCost(logToEdit.cost.toString());
      setMaintShop(logToEdit.shopName || "");
      setMaintNote(logToEdit.note || "");
      setMaintWalletId(logToEdit.walletId || "");
    } else {
      setEditingMaintLogId(null);
      setMaintDate(new Date().toISOString().slice(0, 10));
      setMaintMileage(v.currentMileage.toString());
      setMaintTitle("");
      setMaintCategory("ทั่วไป");
      setMaintCost("");
      setMaintShop("");
      setMaintNote("");
      setMaintWalletId(wallets.find(w => w.isDefault)?.id || wallets[0]?.id || "");
    }
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenanceLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintainingVehicle) return;

    const costVal = parseFloat(maintCost) || 0;
    const km = parseFloat(maintMileage) || maintainingVehicle.currentMileage;

    const newLog: MaintenanceLog = {
      id: editingMaintLogId || `maint-${Date.now()}`,
      date: maintDate,
      mileage: km,
      title: maintTitle || "ซ่อมบำรุงทั่วไป",
      category: maintCategory,
      cost: costVal,
      shopName: maintShop,
      note: maintNote,
      walletId: maintWalletId
    };

    let updatedMaintHistory = maintainingVehicle.maintenanceHistory || [];
    if (editingMaintLogId) {
      updatedMaintHistory = updatedMaintHistory.map(m => m.id === editingMaintLogId ? newLog : m);
    } else {
      updatedMaintHistory = [newLog, ...updatedMaintHistory];
    }

    updatedMaintHistory.sort((a, b) => b.date.localeCompare(a.date));

    const updatedVehicle: VehicleService = {
      ...maintainingVehicle,
      currentMileage: Math.max(maintainingVehicle.currentMileage, km),
      maintenanceHistory: updatedMaintHistory
    };

    const updatedList = vehicles.map(v => v.id === maintainingVehicle.id ? updatedVehicle : v);
    onSaveVehicles(updatedList);

    if (viewHistoryVehicle && viewHistoryVehicle.id === maintainingVehicle.id) {
      setViewHistoryVehicle(updatedVehicle);
    }

    if (!editingMaintLogId && maintWalletId && onAddTransaction && costVal > 0) {
      onAddTransaction({
        type: "expense",
        amount: costVal,
        category: "การเดินทางและยานพาหนะ",
        merchantName: `ค่าซ่อมบำรุง: ${maintTitle} (${maintainingVehicle.vehicleName})`,
        date: maintDate,
        note: `หมวดหมู่: ${maintCategory}, เลขมิเตอร์: ${km.toLocaleString()} km${maintShop ? `, ร้าน: ${maintShop}` : ""}`,
        walletId: maintWalletId
      });
    }

    setShowMaintenanceModal(false);
  };

  const handleDeleteMaintenanceLog = (vehicleId: string, logId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบประวัติค่าซ่อมบำรุงนี้?")) return;
    const targetVehicle = vehicles.find(v => v.id === vehicleId);
    if (!targetVehicle) return;

    const updatedHistory = (targetVehicle.maintenanceHistory || []).filter(m => m.id !== logId);
    const updatedVehicle = { ...targetVehicle, maintenanceHistory: updatedHistory };
    const updatedList = vehicles.map(v => v.id === vehicleId ? updatedVehicle : v);
    onSaveVehicles(updatedList);

    if (viewHistoryVehicle && viewHistoryVehicle.id === vehicleId) {
      setViewHistoryVehicle(updatedVehicle);
    }
  };

  const handleOpenMileageUpdate = (v: VehicleService) => {
    setUpdatingVehicle(v);
    setNewMileageInput(v.currentMileage.toString());
    setShowMileageUpdateModal(true);
  };

  const handleSaveQuickMileage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingVehicle) return;
    const newKm = parseFloat(newMileageInput) || 0;
    if (newKm < updatingVehicle.currentMileage) {
      if (!confirm("เลขมิเตอร์ใหม่ น้อยกว่าเลขมิเตอร์เดิม ยืนยันที่จะบันทึกหรือไม่?")) {
        return;
      }
    }
    const updated = vehicles.map(v => v.id === updatingVehicle.id ? { ...v, currentMileage: newKm } : v);
    onSaveVehicles(updated);
    setShowMileageUpdateModal(false);
  };

  const handleOpenOilChangeLog = (v: VehicleService) => {
    setLoggingVehicle(v);
    setLogDate(new Date().toISOString().slice(0, 10));
    setLogMileage(v.currentMileage.toString());
    setLogCost("");
    setLogShop("");
    setLogNote("");
    setLogWalletId(wallets.find(w => w.isDefault)?.id || wallets[0]?.id || "");
    setShowOilChangeLogModal(true);
  };

  const handleSaveOilChangeLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingVehicle) return;

    const km = parseFloat(logMileage) || loggingVehicle.currentMileage;
    const cost = parseFloat(logCost) || 0;

    const newLog: VehicleLog = {
      id: `log-${Date.now()}`,
      date: logDate,
      mileage: km,
      cost: cost,
      shopName: logShop,
      note: logNote
    };

    const updatedVehicle: VehicleService = {
      ...loggingVehicle,
      lastServiceDate: logDate,
      lastServiceMileage: km,
      lastServiceCost: cost,
      currentMileage: Math.max(loggingVehicle.currentMileage, km),
      history: [newLog, ...(loggingVehicle.history || [])]
    };

    const updatedList = vehicles.map(v => v.id === loggingVehicle.id ? updatedVehicle : v);
    onSaveVehicles(updatedList);

    // Optionally add expense transaction
    if (logWalletId && onAddTransaction && cost > 0) {
      onAddTransaction({
        type: "expense",
        amount: cost,
        category: "การเดินทางและยานพาหนะ",
        merchantName: `ถ่ายน้ำมันเครื่อง (${loggingVehicle.vehicleName})`,
        date: logDate,
        note: `เลขมิเตอร์: ${km.toLocaleString()} km${logShop ? `, ร้าน: ${logShop}` : ""}`,
        walletId: logWalletId
      });
    }

    setShowOilChangeLogModal(false);
  };

  // ==========================================
  // AIR CONDITIONER CLEANING STATE & LOGIC
  // ==========================================
  const [showAcModal, setShowAcModal] = useState<boolean>(false);
  const [editingAcId, setEditingAcId] = useState<string | null>(null);
  const [acName, setAcName] = useState<string>("");
  const [acLocation, setAcLocation] = useState<string>("");
  const [acBrand, setAcBrand] = useState<string>("");
  const [acIntervalMonths, setAcIntervalMonths] = useState<string>("6");
  const [acLastDate, setAcLastDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [acLastCost, setAcLastCost] = useState<string>("");
  const [acTechnician, setAcTechnician] = useState<string>("");
  const [acNote, setAcNote] = useState<string>("");

  // Record New AC Cleaning Log Modal
  const [showAcCleanLogModal, setShowAcCleanLogModal] = useState<boolean>(false);
  const [loggingAc, setLoggingAc] = useState<AcService | null>(null);
  const [acCleanDate, setAcCleanDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [acCleanCost, setAcCleanCost] = useState<string>("");
  const [acCleanTech, setAcCleanTech] = useState<string>("");
  const [acCleanNote, setAcCleanNote] = useState<string>("");
  const [acCleanWalletId, setAcCleanWalletId] = useState<string>("");

  // History Log Viewer Modal for AC
  const [viewHistoryAc, setViewHistoryAc] = useState<AcService | null>(null);

  const handleOpenAcModal = (ac?: AcService) => {
    if (ac) {
      setEditingAcId(ac.id);
      setAcName(ac.name);
      setAcLocation(ac.location || "");
      setAcBrand(ac.brand || "");
      setAcIntervalMonths(ac.intervalMonths.toString());
      setAcLastDate(ac.lastCleanDate);
      setAcLastCost((ac.lastCleanCost || "").toString());
      setAcTechnician(ac.technician || "");
      setAcNote(ac.note || "");
    } else {
      setEditingAcId(null);
      setAcName("");
      setAcLocation("");
      setAcBrand("");
      setAcIntervalMonths("6");
      setAcLastDate(new Date().toISOString().slice(0, 10));
      setAcLastCost("");
      setAcTechnician("");
      setAcNote("");
    }
    setShowAcModal(true);
  };

  const handleSaveAc = (e: React.FormEvent) => {
    e.preventDefault();
    const intM = parseInt(acIntervalMonths) || 6;
    const cost = parseFloat(acLastCost) || 0;

    const newAc: AcService = {
      id: editingAcId || `ac-${Date.now()}`,
      name: acName || "เครื่องปรับอากาศ",
      location: acLocation,
      brand: acBrand,
      intervalMonths: intM,
      lastCleanDate: acLastDate,
      lastCleanCost: cost,
      technician: acTechnician,
      note: acNote,
      history: editingAcId ? (acServices.find(a => a.id === editingAcId)?.history || []) : [
        {
          id: `aclog-${Date.now()}`,
          date: acLastDate,
          cost: cost,
          technician: acTechnician,
          note: "บันทึกครั้งแรก"
        }
      ],
      createdAt: new Date().toISOString()
    };

    let updated: AcService[];
    if (editingAcId) {
      updated = acServices.map(a => a.id === editingAcId ? newAc : a);
    } else {
      updated = [newAc, ...acServices];
    }

    onSaveAcServices(updated);
    setShowAcModal(false);
  };

  const handleDeleteAc = (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการแอร์นี้?")) {
      onSaveAcServices(acServices.filter(a => a.id !== id));
    }
  };

  const handleOpenAcCleanLog = (ac: AcService) => {
    setLoggingAc(ac);
    setAcCleanDate(new Date().toISOString().slice(0, 10));
    setAcCleanCost("");
    setAcCleanTech(ac.technician || "");
    setAcCleanNote("");
    setAcCleanWalletId(wallets.find(w => w.isDefault)?.id || wallets[0]?.id || "");
    setShowAcCleanLogModal(true);
  };

  const handleSaveAcCleanLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingAc) return;

    const cost = parseFloat(acCleanCost) || 0;

    const newLog: AcLog = {
      id: `aclog-${Date.now()}`,
      date: acCleanDate,
      cost: cost,
      technician: acCleanTech,
      note: acCleanNote
    };

    const updatedAc: AcService = {
      ...loggingAc,
      lastCleanDate: acCleanDate,
      lastCleanCost: cost,
      technician: acCleanTech || loggingAc.technician,
      history: [newLog, ...(loggingAc.history || [])]
    };

    const updatedList = acServices.map(a => a.id === loggingAc.id ? updatedAc : a);
    onSaveAcServices(updatedList);

    // Optionally add expense transaction
    if (acCleanWalletId && onAddTransaction && cost > 0) {
      onAddTransaction({
        type: "expense",
        amount: cost,
        category: "ที่อยู่อาศัย",
        merchantName: `ล้างแอร์ (${loggingAc.name})`,
        date: acCleanDate,
        note: `ช่าง: ${acCleanTech || "-"}, รอบถัดไปอีก ${loggingAc.intervalMonths} เดือน`,
        walletId: acCleanWalletId
      });
    }

    setShowAcCleanLogModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Feature Navigation Tabs */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-xl border ${
                theme === "light"
                  ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                  : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
              }`}>
                <Wrench className="w-5 h-5" />
              </span>
              <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${
                theme === "light" ? "text-slate-900" : "text-white"
              }`}>
                สาธารณูปโภค & บำรุงรักษา
              </h2>
            </div>
            <p className={`text-xs sm:text-sm mt-1 ${
              theme === "light" ? "text-slate-600 font-medium" : "text-slate-400"
            }`}>
              บันทึกค่าน้ำ-ค่าไฟ อัตราต่อหน่วย ระบบเตือนถ่ายน้ำมันเครื่องรถ และกำหนดรอบล้างแอร์
            </p>
          </div>

          {/* Tab Selection */}
          <div className={`flex items-center gap-1.5 p-1.5 rounded-xl border overflow-x-auto ${
            theme === "light" ? "bg-slate-200/70 border-slate-300" : "bg-black/40 border-white/10"
          }`}>
            <button
              onClick={() => setActiveTab("utilities")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "utilities"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg border border-white/20"
                  : theme === "light"
                    ? "text-slate-700 hover:text-slate-900 hover:bg-slate-300/60"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap className={`w-4 h-4 ${theme === "light" ? "text-amber-600" : "text-amber-400"}`} />
              <span>ค่าน้ำ / ค่าไฟ</span>
              {utilityBills.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                  theme === "light" ? "bg-slate-800 text-white" : "bg-white/20 text-white"
                }`}>
                  {utilityBills.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("vehicles")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "vehicles"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg border border-white/20"
                  : theme === "light"
                    ? "text-slate-700 hover:text-slate-900 hover:bg-slate-300/60"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Car className={`w-4 h-4 ${theme === "light" ? "text-purple-700" : "text-purple-400"}`} />
              <span>ถ่ายน้ำมันเครื่องรถ</span>
              {vehicles.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                  theme === "light" ? "bg-slate-800 text-white" : "bg-white/20 text-white"
                }`}>
                  {vehicles.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("ac")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "ac"
                  ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg border border-white/20"
                  : theme === "light"
                    ? "text-slate-700 hover:text-slate-900 hover:bg-slate-300/60"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Snowflake className={`w-4 h-4 ${theme === "light" ? "text-teal-700" : "text-cyan-400"}`} />
              <span>รอบล้างแอร์</span>
              {acServices.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                  theme === "light" ? "bg-slate-800 text-white" : "bg-white/20 text-white"
                }`}>
                  {acServices.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================
          TAB 1: UTILITIES (ค่าน้ำ - ค่าไฟ)
         ========================================== */}
      {activeTab === "utilities" && (
        <div className="space-y-6">
          {/* Action Header & Quick Stats */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
            theme === "light"
              ? "bg-white border-slate-200/90 shadow-2xs"
              : "bg-slate-900/60 border-white/10"
          }`}>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${
                theme === "light" ? "text-slate-900" : "text-white"
              }`}>
                <BarChart3 className={`w-5 h-5 ${theme === "light" ? "text-indigo-600" : "text-indigo-400"}`} />
                บันทึกบิลค่าน้ำและค่าไฟฟ้า
              </h3>
              <p className={`text-xs mt-0.5 ${
                theme === "light" ? "text-slate-600 font-medium" : "text-slate-400"
              }`}>
                คำนวณยูนิต อัตราต่อหน่วย ค่า FT ค่าบริการ ภาษี 7% พร้อมดึงเลขมิเตอร์เดือนก่อนมาให้อัตโนมัติ
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenBillModal("electricity")}
                className={`py-2 px-4 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  theme === "light"
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
                    : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30"
                }`}
              >
                <Zap className={`w-4 h-4 ${theme === "light" ? "text-amber-700 fill-amber-300" : "text-amber-400 fill-amber-400/30"}`} />
                <span>+ บันทึกบิลค่าไฟ</span>
              </button>
              <button
                onClick={() => handleOpenBillModal("water")}
                className={`py-2 px-4 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  theme === "light"
                    ? "bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border-cyan-300"
                    : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/30"
                }`}
              >
                <Droplet className={`w-4 h-4 ${theme === "light" ? "text-cyan-700 fill-cyan-300" : "text-cyan-400 fill-cyan-400/30"}`} />
                <span>+ บันทึกบิลค่าน้ำ</span>
              </button>
            </div>
          </div>

          {/* Yearly Trend Chart & Summary */}
          <div className={`rounded-2xl p-5 border ${
            theme === "light"
              ? "bg-white border-slate-200/90 shadow-2xs"
              : "bg-slate-900/80 border-white/10 backdrop-blur-xl"
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b ${
              theme === "light" ? "border-slate-200" : "border-white/10"
            }`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-5 h-5 ${theme === "light" ? "text-indigo-600" : "text-indigo-400"}`} />
                <h4 className={`font-bold text-base ${theme === "light" ? "text-slate-900" : "text-white"}`}>ภาพรวมการใช้น้ำ-ไฟ รายปี</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>เลือกปี:</span>
                <select
                  value={selectedUtilityYear}
                  onChange={(e) => setSelectedUtilityYear(parseInt(e.target.value))}
                  className={`text-xs rounded-lg px-2.5 py-1 font-mono font-bold focus:outline-none border ${
                    theme === "light"
                      ? "bg-slate-100 border-slate-300 text-slate-900"
                      : "bg-slate-800 border-white/20 text-white focus:border-indigo-500"
                  }`}
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>พ.ศ. {y + 543} ({y})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Cards for the selected year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className={`p-4 rounded-xl border transition-all ${
                theme === "light"
                  ? "bg-indigo-50/90 border-indigo-200 text-slate-800 shadow-2xs"
                  : "bg-gradient-to-br from-indigo-950/60 to-slate-900/80 border-indigo-500/20 text-white"
              }`}>
                <span className={`text-xs block font-semibold ${theme === "light" ? "text-indigo-950" : "text-slate-400"}`}>
                  รวมค่าน้ำ-ไฟ ทั้งปี ({selectedUtilityYear + 543})
                </span>
                <span className={`text-2xl font-black mt-1 block font-mono ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  ฿{monthlyMatrix.totalYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[11px] mt-1 block font-bold ${theme === "light" ? "text-indigo-800" : "text-indigo-300/80"}`}>
                  เฉลี่ยประมาณ ฿{monthlyMatrix.avgMonthly.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / เดือน
                </span>
              </div>

              <div className={`p-4 rounded-xl border transition-all ${
                theme === "light"
                  ? "bg-amber-50/90 border-amber-200 text-amber-950 shadow-2xs"
                  : "bg-gradient-to-br from-amber-950/50 to-slate-900/80 border-amber-500/20 text-amber-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1 ${theme === "light" ? "text-amber-950" : "text-amber-300"}`}>
                    <Zap className={`w-3.5 h-3.5 ${theme === "light" ? "text-amber-700" : "text-amber-400"}`} /> ค่าไฟรวมทั้งปี
                  </span>
                </div>
                <span className={`text-2xl font-black mt-1 block font-mono ${theme === "light" ? "text-amber-900" : "text-amber-200"}`}>
                  ฿{monthlyMatrix.totalElecYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[11px] mt-1 block font-bold ${theme === "light" ? "text-amber-800" : "text-amber-300/70"}`}>
                  {yearlyBills.filter(b => b.type === "electricity").reduce((sum, b) => sum + b.unitsUsed, 0).toLocaleString()} หน่วย
                </span>
              </div>

              <div className={`p-4 rounded-xl border transition-all ${
                theme === "light"
                  ? "bg-cyan-50/90 border-cyan-200 text-cyan-950 shadow-2xs"
                  : "bg-gradient-to-br from-cyan-950/50 to-slate-900/80 border-cyan-500/20 text-cyan-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1 ${theme === "light" ? "text-cyan-950" : "text-cyan-300"}`}>
                    <Droplet className={`w-3.5 h-3.5 ${theme === "light" ? "text-cyan-700" : "text-cyan-400"}`} /> ค่าน้ำรวมทั้งปี
                  </span>
                </div>
                <span className={`text-2xl font-black mt-1 block font-mono ${theme === "light" ? "text-cyan-900" : "text-cyan-200"}`}>
                  ฿{monthlyMatrix.totalWaterYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[11px] mt-1 block font-bold ${theme === "light" ? "text-cyan-800" : "text-cyan-300/70"}`}>
                  {yearlyBills.filter(b => b.type === "water").reduce((sum, b) => sum + b.unitsUsed, 0).toLocaleString()} หน่วย
                </span>
              </div>
            </div>

            {/* Monthly Bar Chart */}
            <div className="space-y-2">
              <span className={`text-xs font-bold block mb-2 ${theme === "light" ? "text-slate-700" : "text-slate-400"}`}>
                กราฟเปรียบเทียบแต่ละเดือน (ม.ค. - ธ.ค.)
              </span>
              <div className={`grid grid-cols-6 sm:grid-cols-12 gap-1.5 items-end h-40 p-3 rounded-xl border ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200"
                  : "bg-black/30 border-white/5"
              }`}>
                {monthlyMatrix.months.map((m) => {
                  const heightPercent = monthlyMatrix.maxMonthlyTotal > 0
                    ? Math.max(4, Math.round((m.totalAmount / monthlyMatrix.maxMonthlyTotal) * 100))
                    : 4;

                  return (
                    <div key={m.ym} className="flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-950 border border-white/20 p-2 rounded-lg text-[10px] text-white whitespace-nowrap z-30 shadow-xl pointer-events-none">
                        <span className="font-bold text-indigo-300">{m.monthName} {selectedUtilityYear + 543}</span>
                        {m.elecAmount > 0 && <span className="text-amber-300">⚡ ค่าไฟ: ฿{m.elecAmount.toLocaleString()} ({m.elecUnits} หน่วย)</span>}
                        {m.waterAmount > 0 && <span className="text-cyan-300">💧 ค่าน้ำ: ฿{m.waterAmount.toLocaleString()} ({m.waterUnits} หน่วย)</span>}
                        {m.totalAmount === 0 && <span className="text-slate-400">ไม่มีบันทึกข้อมูล</span>}
                      </div>

                      <div className={`w-full max-w-[28px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:scale-105 ${
                        theme === "light" ? "bg-slate-200" : "bg-slate-800"
                      }`} style={{ height: `${heightPercent}%` }}>
                        {m.elecAmount > 0 && (
                          <div 
                            className="w-full bg-gradient-to-t from-amber-600 to-amber-400" 
                            style={{ height: `${(m.elecAmount / (m.totalAmount || 1)) * 100}%` }}
                          />
                        )}
                        {m.waterAmount > 0 && (
                          <div 
                            className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400" 
                            style={{ height: `${(m.waterAmount / (m.totalAmount || 1)) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 font-bold ${
                        theme === "light" ? "text-slate-700" : "text-slate-400"
                      }`}>{m.monthName}</span>
                    </div>
                  );
                })}
              </div>
              <div className={`flex items-center justify-center gap-4 text-[11px] pt-2 font-medium ${
                theme === "light" ? "text-slate-700" : "text-slate-400"
              }`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> ค่าไฟ (⚡)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" /> ค่าน้ำ (💧)
                </span>
              </div>
            </div>
          </div>

          {/* Bill History List */}
          <div className={`rounded-2xl p-5 border ${
            theme === "light"
              ? "bg-white border-slate-200/90 shadow-2xs"
              : "bg-slate-900/80 border-white/10 backdrop-blur-xl"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className={`font-extrabold text-base flex items-center gap-2 ${
                  theme === "light" ? "text-slate-900" : "text-white"
                }`}>
                  <span>ประวัติบิลค่าน้ำและค่าไฟที่บันทึกไว้</span>
                </h4>
                <p className={`text-xs mt-0.5 ${
                  theme === "light" ? "text-slate-600 font-medium" : "text-slate-400"
                }`}>
                  {historyYearFilter === "all"
                    ? `แสดงข้อมูลทุกปี รวม ${filteredHistoryBills.length} รายการ`
                    : `แสดงประจำปี พ.ศ. ${(historyYearFilter === "selected" ? selectedUtilityYear : parseInt(historyYearFilter)) + 543} (${filteredHistoryBills.length} รายการ)`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold whitespace-nowrap ${
                  theme === "light" ? "text-slate-700" : "text-slate-300"
                }`}>
                  เลือกปี:
                </span>
                <select
                  value={historyYearFilter}
                  onChange={(e) => setHistoryYearFilter(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-1.5 font-mono font-bold focus:outline-none border transition-all ${
                    theme === "light"
                      ? "bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200"
                      : "bg-slate-800 border-white/20 text-white focus:border-indigo-500"
                  }`}
                >
                  <option value="selected">ปี พ.ศ. {selectedUtilityYear + 543} (ตามปีที่เลือก)</option>
                  <option value="all">แสดงทุกปี ({sortedUtilityBills.length} บิล)</option>
                  {availableUtilityYears.map(y => (
                    <option key={y} value={y.toString()}>ปี พ.ศ. {y + 543} ({y})</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredHistoryBills.length === 0 ? (
              <div className={`text-center py-10 border border-dashed rounded-xl ${
                theme === "light" ? "bg-slate-50/80 border-slate-300" : "bg-black/20 border-white/10"
              }`}>
                <Zap className={`w-10 h-10 mx-auto mb-2 ${theme === "light" ? "text-slate-400" : "text-slate-600"}`} />
                <p className={`text-sm font-bold ${theme === "light" ? "text-slate-700" : "text-slate-400"}`}>
                  ยังไม่มีประวัติการบันทึกบิลค่าน้ำ/ค่าไฟ ในปี พ.ศ. {(historyYearFilter === "selected" ? selectedUtilityYear : parseInt(historyYearFilter)) + 543}
                </p>
                <p className={`text-xs mt-1 ${theme === "light" ? "text-slate-500" : "text-slate-500"}`}>
                  คลิกปุ่ม "+ บันทึกบิลค่าไฟ" หรือ "+ บันทึกบิลค่าน้ำ" เพื่อเริ่มต้น หรือเลือกปีอื่นจากช่อง "เลือกปี:"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistoryBills.map((bill) => {
                  const isElec = bill.type === "electricity";
                  const comp = getBillPreviousMonthComparison(bill);

                  return (
                    <div 
                      key={bill.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        theme === "light"
                          ? isElec
                            ? "bg-amber-50/80 border-amber-200 hover:border-amber-400/80 shadow-2xs"
                            : "bg-cyan-50/80 border-cyan-200 hover:border-cyan-400/80 shadow-2xs"
                          : isElec 
                            ? "bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border-amber-500/20 hover:border-amber-500/40" 
                            : "bg-gradient-to-r from-cyan-950/20 via-slate-900 to-slate-900 border-cyan-500/20 hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Title & Date */}
                        <div className="flex items-start gap-3">
                          <span className={`p-2.5 rounded-xl border shrink-0 ${
                            theme === "light"
                              ? isElec
                                ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                                : "bg-cyan-100 text-cyan-900 border-cyan-300 shadow-2xs"
                              : isElec
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          }`}>
                            {isElec ? (
                              <Zap className={`w-5 h-5 ${theme === "light" ? "text-amber-700" : "text-amber-400"}`} />
                            ) : (
                              <Droplet className={`w-5 h-5 ${theme === "light" ? "text-cyan-700" : "text-cyan-400"}`} />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-extrabold text-base ${
                                theme === "light" ? "text-slate-900" : "text-white"
                              }`}>
                                {isElec ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} ประจำเดือน {formatMonthTh(bill.billingMonth)}
                              </span>
                              {comp && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                  theme === "light"
                                    ? comp.diffAmount > 0
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : comp.diffAmount < 0
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-slate-200 text-slate-800 border-slate-300"
                                    : comp.diffAmount > 0 
                                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30" 
                                      : comp.diffAmount < 0 
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                                      : "bg-slate-800 text-slate-300 border-slate-700"
                                }`}>
                                  {comp.diffAmount > 0 ? (
                                    <>
                                      <ArrowUpRight className={`w-3 h-3 ${theme === "light" ? "text-rose-700" : "text-rose-400"}`} />
                                      <span>+{comp.diffAmount.toFixed(1)} ฿ (+{comp.diffPercent.toFixed(1)}%) จากเดือนก่อน</span>
                                    </>
                                  ) : comp.diffAmount < 0 ? (
                                    <>
                                      <ArrowDownRight className={`w-3 h-3 ${theme === "light" ? "text-emerald-700" : "text-emerald-400"}`} />
                                      <span>{comp.diffAmount.toFixed(1)} ฿ ({comp.diffPercent.toFixed(1)}%) จากเดือนก่อน</span>
                                    </>
                                  ) : (
                                    <span>เท่ากับเดือนก่อน</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className={`flex items-center gap-3 text-xs mt-1 flex-wrap font-mono ${
                              theme === "light" ? "text-slate-600" : "text-slate-400"
                            }`}>
                              <span>มิเตอร์: <strong className={theme === "light" ? "text-slate-900 font-bold" : "text-white"}>{bill.startMeter.toLocaleString()}</strong> ➔ <strong className={theme === "light" ? "text-slate-900 font-bold" : "text-white"}>{bill.endMeter.toLocaleString()}</strong></span>
                              <span className={theme === "light" ? "text-slate-300" : "text-slate-600"}>|</span>
                              <span>ใช้งาน: <strong className={theme === "light" ? "text-sky-900 font-extrabold" : "text-sky-300"}>{bill.unitsUsed.toLocaleString()} หน่วย</strong></span>
                              <span className={theme === "light" ? "text-slate-300" : "text-slate-600"}>|</span>
                              <span>อัตรา: <strong className={theme === "light" ? "text-emerald-900 font-extrabold" : "text-emerald-300"}>{bill.ratePerUnit.toFixed(2)} ฿/หน่วย</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className={`flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 ${
                          theme === "light" ? "border-slate-200" : "border-white/5"
                        }`}>
                          <div className="text-right">
                            <span className={`text-xs block font-semibold ${
                              theme === "light" ? "text-slate-600" : "text-slate-400"
                            }`}>รวมทั้งสิ้น</span>
                            <span className={`text-xl font-black font-mono ${
                              theme === "light" ? "text-slate-900" : "text-white"
                            }`}>
                              ฿{bill.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenBillModal(bill.type, bill)}
                              className={`p-2 rounded-lg transition-all cursor-pointer ${
                                theme === "light"
                                  ? "bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 shadow-2xs"
                                  : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                              }`}
                              title="แก้ไขบิล"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBill(bill.id)}
                              className={`p-2 rounded-lg transition-all cursor-pointer ${
                                theme === "light"
                                  ? "bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 shadow-2xs"
                                  : "bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              }`}
                              title="ลบบิล"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Cost Breakdown Pills */}
                      <div className={`mt-3 pt-2.5 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono ${
                        theme === "light" ? "border-slate-200/80 text-slate-800" : "border-white/5 text-slate-300"
                      }`}>
                        <div className={`p-1.5 px-2.5 rounded-lg border ${
                          theme === "light" ? "bg-white/90 border-slate-200 text-slate-800 shadow-2xs" : "bg-black/30 border-white/5"
                        }`}>
                          <span className={`block text-[10px] ${theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"}`}>ค่าไฟ/ค่าน้ำฐาน:</span>
                          <span className={`font-extrabold ${theme === "light" ? "text-slate-900" : "text-white"}`}>฿{bill.baseCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className={`p-1.5 px-2.5 rounded-lg border ${
                          theme === "light" ? "bg-white/90 border-slate-200 text-slate-800 shadow-2xs" : "bg-black/30 border-white/5"
                        }`}>
                          <span className={`block text-[10px] ${theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"}`}>ค่า FT:</span>
                          <span className={`font-extrabold ${theme === "light" ? "text-amber-900" : "text-amber-300"}`}>฿{bill.ftCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className={`p-1.5 px-2.5 rounded-lg border ${
                          theme === "light" ? "bg-white/90 border-slate-200 text-slate-800 shadow-2xs" : "bg-black/30 border-white/5"
                        }`}>
                          <span className={`block text-[10px] ${theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"}`}>ค่าบริการ:</span>
                          <span className={`font-extrabold ${theme === "light" ? "text-sky-900" : "text-sky-300"}`}>฿{bill.serviceFee.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className={`p-1.5 px-2.5 rounded-lg border ${
                          theme === "light" ? "bg-white/90 border-slate-200 text-slate-800 shadow-2xs" : "bg-black/30 border-white/5"
                        }`}>
                          <span className={`block text-[10px] ${theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"}`}>VAT ({bill.vatPercent}%):</span>
                          <span className={`font-extrabold ${theme === "light" ? "text-purple-900" : "text-purple-300"}`}>฿{bill.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: VEHICLE MILEAGE & OIL CHANGE
         ========================================== */}
      {activeTab === "vehicles" && (
        <div className="space-y-6">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
            theme === "light"
              ? "bg-white border-slate-200/90 shadow-2xs"
              : "bg-slate-900/60 border-white/10"
          }`}>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${
                theme === "light" ? "text-slate-900" : "text-white"
              }`}>
                <Car className={`w-5 h-5 ${theme === "light" ? "text-purple-700" : "text-purple-400"}`} />
                ระบบบันทึกเลขมิเตอร์รถ & ถ่ายน้ำมันเครื่อง
              </h3>
              <p className={`text-xs mt-0.5 ${
                theme === "light" ? "text-slate-600 font-medium" : "text-slate-400"
              }`}>
                กำหนดรอบเปลี่ยนถ่ายน้ำมันเครื่อง เช่น ทุก 3,000 km หรือ 4 เดือน พร้อมระบบแจ้งเตือนและประวัติ
              </p>
            </div>

            <button
              onClick={() => handleOpenVehicleModal()}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มข้อมูลรถ</span>
            </button>
          </div>

          {/* Vehicle Monthly & Yearly Expense Summary */}
          {vehicles.length > 0 && (() => {
            const currentYr = new Date().getFullYear();
            const yearsSet = new Set<number>();
            yearsSet.add(currentYr);

            vehicles.forEach(v => {
              (v.fuelHistory || []).forEach(f => {
                const yr = parseInt(f.date.slice(0, 4));
                if (yr) yearsSet.add(yr);
              });
              (v.history || []).forEach(o => {
                const yr = parseInt(o.date.slice(0, 4));
                if (yr) yearsSet.add(yr);
              });
              (v.maintenanceHistory || []).forEach(m => {
                const yr = parseInt(m.date.slice(0, 4));
                if (yr) yearsSet.add(yr);
              });
            });

            const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

            const targetVehicles = vehicleExpenseSelectedVehicle === "all"
              ? vehicles
              : vehicles.filter(v => v.id === vehicleExpenseSelectedVehicle);

            const selYear = vehicleExpenseSelectedYear;

            const monthlyStats = Array.from({ length: 12 }, (_, monthIdx) => {
              const monthStr = (monthIdx + 1).toString().padStart(2, "0");
              const yearMonth = `${selYear}-${monthStr}`;

              let fuelTotal = 0;
              let oilTotal = 0;
              let maintTotal = 0;
              const kmlList: number[] = [];

              targetVehicles.forEach(v => {
                const recomputedFuel = computeFuelHistoryWithKml(v.fuelHistory || []);
                recomputedFuel.forEach(f => {
                  if (f.date.startsWith(yearMonth)) {
                    fuelTotal += (f.totalCost || 0);
                    if (f.kmPerLiter) kmlList.push(f.kmPerLiter);
                  }
                });
                (v.history || []).forEach(o => {
                  if (o.date.startsWith(yearMonth)) {
                    oilTotal += (o.cost || 0);
                  }
                });
                (v.maintenanceHistory || []).forEach(m => {
                  if (m.date.startsWith(yearMonth)) {
                    maintTotal += (m.cost || 0);
                  }
                });
              });

              const monthGrandTotal = fuelTotal + oilTotal + maintTotal;
              const avgKml = kmlList.length > 0 ? (kmlList.reduce((a, b) => a + b, 0) / kmlList.length) : null;

              return {
                monthIdx,
                monthName: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][monthIdx],
                fuelTotal,
                oilTotal,
                maintTotal,
                monthGrandTotal,
                avgKml
              };
            });

            const yearFuelTotal = monthlyStats.reduce((sum, m) => sum + m.fuelTotal, 0);
            const yearOilTotal = monthlyStats.reduce((sum, m) => sum + m.oilTotal, 0);
            const yearMaintTotal = monthlyStats.reduce((sum, m) => sum + m.maintTotal, 0);
            const yearGrandTotal = yearFuelTotal + yearOilTotal + yearMaintTotal;

            const allYearKmls: number[] = [];
            targetVehicles.forEach(v => {
              const recomputedFuel = computeFuelHistoryWithKml(v.fuelHistory || []);
              recomputedFuel.forEach(f => {
                if (f.date.startsWith(`${selYear}-`) && f.kmPerLiter) {
                  allYearKmls.push(f.kmPerLiter);
                }
              });
            });
            const yearAvgKml = allYearKmls.length > 0 ? (allYearKmls.reduce((a, b) => a + b, 0) / allYearKmls.length) : null;

            return (
              <div className={`p-4 sm:p-5 rounded-2xl border mb-6 ${
                theme === "light"
                  ? "bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border-indigo-200/80 shadow-md"
                  : "bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border-indigo-500/20 shadow-xl"
              }`}>
                {/* Summary Section Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-indigo-500/10">
                  <div>
                    <h3 className={`font-black text-base flex items-center gap-2 ${
                      theme === "light" ? "text-indigo-950" : "text-white"
                    }`}>
                      <BarChart3 className="w-5 h-5 text-indigo-500" />
                      <span>สรุปค่าใช้จ่ายยานพาหนะ รายเดือน / รายปี</span>
                    </h3>
                    <p className={`text-xs mt-0.5 ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
                      ผลรวมค่าน้ำมัน, ค่าถ่ายน้ำมันเครื่อง และค่าซ่อมบำรุงประจำปี พ.ศ. {selYear + 543} ({selYear})
                    </p>
                  </div>

                  {/* Dropdown Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={vehicleExpenseSelectedVehicle}
                      onChange={(e) => setVehicleExpenseSelectedVehicle(e.target.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                        theme === "light"
                          ? "bg-white border-slate-300 text-slate-800 shadow-2xs"
                          : "bg-slate-800 border-white/10 text-white"
                      }`}
                    >
                      <option value="all">🚗 รถทุกคัน ({vehicles.length} คัน)</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicleName} {v.plateNumber ? `(${v.plateNumber})` : ""}</option>
                      ))}
                    </select>

                    <select
                      value={vehicleExpenseSelectedYear}
                      onChange={(e) => setVehicleExpenseSelectedYear(parseInt(e.target.value))}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                        theme === "light"
                          ? "bg-white border-slate-300 text-slate-800 shadow-2xs"
                          : "bg-slate-800 border-white/10 text-white"
                      }`}
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>ปี พ.ศ. {yr + 543} ({yr})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
                  <div className={`p-3 rounded-xl border text-center ${
                    theme === "light" ? "bg-amber-50/90 border-amber-200" : "bg-amber-950/20 border-amber-500/20"
                  }`}>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">⛽ ค่าน้ำมันปีนี้</span>
                    <strong className="text-sm sm:text-base font-extrabold font-mono text-amber-900 dark:text-amber-200 block mt-0.5">
                      ฿{yearFuelTotal.toLocaleString()}
                    </strong>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${
                    theme === "light" ? "bg-emerald-50/90 border-emerald-200" : "bg-emerald-950/20 border-emerald-500/20"
                  }`}>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">🛢️ ค่าน้ำมันเครื่อง</span>
                    <strong className="text-sm sm:text-base font-extrabold font-mono text-emerald-900 dark:text-emerald-200 block mt-0.5">
                      ฿{yearOilTotal.toLocaleString()}
                    </strong>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${
                    theme === "light" ? "bg-purple-50/90 border-purple-200" : "bg-purple-950/20 border-purple-500/20"
                  }`}>
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 block">🛠️ ค่าซ่อมบำรุง</span>
                    <strong className="text-sm sm:text-base font-extrabold font-mono text-purple-900 dark:text-purple-200 block mt-0.5">
                      ฿{yearMaintTotal.toLocaleString()}
                    </strong>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${
                    theme === "light" ? "bg-indigo-100 border-indigo-300" : "bg-indigo-900/40 border-indigo-500/30"
                  }`}>
                    <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 block">💰 รวมค่าใช้จ่ายปีนี้</span>
                    <strong className="text-sm sm:text-base font-black font-mono text-indigo-950 dark:text-indigo-100 block mt-0.5">
                      ฿{yearGrandTotal.toLocaleString()}
                    </strong>
                  </div>

                  <div className={`p-3 rounded-xl border text-center col-span-2 sm:col-span-1 ${
                    theme === "light" ? "bg-teal-50/90 border-teal-200" : "bg-teal-950/20 border-teal-500/20"
                  }`}>
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 block">⚡ อัตราสิ้นเปลืองเฉลี่ย</span>
                    <strong className="text-sm sm:text-base font-extrabold font-mono text-teal-900 dark:text-teal-200 block mt-0.5">
                      {yearAvgKml ? `${yearAvgKml.toFixed(2)} KM/L` : "-"}
                    </strong>
                  </div>
                </div>

                {/* Monthly Expense Table */}
                <div className="overflow-x-auto rounded-xl border border-indigo-500/20">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold ${
                        theme === "light"
                          ? "bg-indigo-100/70 border-indigo-200 text-indigo-900"
                          : "bg-slate-800 border-white/10 text-indigo-300"
                      }`}>
                        <th className="py-2.5 px-3">เดือน</th>
                        <th className="py-2.5 px-3 text-right">⛽ ค่าน้ำมัน</th>
                        <th className="py-2.5 px-3 text-right">🛢️ น้ำมันเครื่อง</th>
                        <th className="py-2.5 px-3 text-right">🛠️ ค่าซ่อมบำรุง</th>
                        <th className="py-2.5 px-3 text-right">💰 รวม (บาท)</th>
                        <th className="py-2.5 px-3 text-right">⚡ เฉลี่ย (KM/L)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {monthlyStats.map((m) => {
                        const hasData = m.monthGrandTotal > 0 || m.avgKml !== null;
                        return (
                          <tr 
                            key={m.monthIdx}
                            className={`transition-colors ${
                              theme === "light"
                                ? hasData ? "hover:bg-indigo-50/60" : "opacity-60"
                                : hasData ? "hover:bg-white/5" : "opacity-40"
                            }`}
                          >
                            <td className={`py-2 px-3 font-bold font-sans ${
                              theme === "light" ? "text-slate-800" : "text-white"
                            }`}>
                              {m.monthName}
                            </td>
                            <td className={`py-2 px-3 text-right ${
                              m.fuelTotal > 0 
                                ? theme === "light" ? "text-amber-800 font-bold" : "text-amber-300 font-bold" 
                                : theme === "light" ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {m.fuelTotal > 0 ? `฿${m.fuelTotal.toLocaleString()}` : "-"}
                            </td>
                            <td className={`py-2 px-3 text-right ${
                              m.oilTotal > 0 
                                ? theme === "light" ? "text-emerald-800 font-bold" : "text-emerald-300 font-bold" 
                                : theme === "light" ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {m.oilTotal > 0 ? `฿${m.oilTotal.toLocaleString()}` : "-"}
                            </td>
                            <td className={`py-2 px-3 text-right ${
                              m.maintTotal > 0 
                                ? theme === "light" ? "text-purple-800 font-bold" : "text-purple-300 font-bold" 
                                : theme === "light" ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {m.maintTotal > 0 ? `฿${m.maintTotal.toLocaleString()}` : "-"}
                            </td>
                            <td className={`py-2 px-3 text-right font-extrabold ${
                              m.monthGrandTotal > 0 
                                ? theme === "light" ? "text-indigo-950" : "text-indigo-200" 
                                : theme === "light" ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {m.monthGrandTotal > 0 ? `฿${m.monthGrandTotal.toLocaleString()}` : "-"}
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${
                              m.avgKml 
                                ? theme === "light" ? "text-teal-800" : "text-teal-300" 
                                : theme === "light" ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {m.avgKml ? `${m.avgKml.toFixed(1)}` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t-2 font-bold font-mono text-xs ${
                        theme === "light" 
                          ? "bg-indigo-100/90 border-indigo-300 text-indigo-950" 
                          : "bg-slate-800 border-indigo-500/30 text-white"
                      }`}>
                        <td className="py-2.5 px-3 font-sans">รวมทั้งปี ({selYear})</td>
                        <td className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-300">฿{yearFuelTotal.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-300">฿{yearOilTotal.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-purple-800 dark:text-purple-300">฿{yearMaintTotal.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-900 dark:text-indigo-200 text-sm">฿{yearGrandTotal.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-teal-800 dark:text-teal-300">{yearAvgKml ? `${yearAvgKml.toFixed(2)}` : "-"}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Vehicle Cards Grid */}
          {vehicles.length === 0 ? (
            <div className={`text-center py-12 border border-dashed rounded-2xl ${
              theme === "light" ? "bg-slate-50 border-slate-300" : "bg-slate-900/40 border-white/10"
            }`}>
              <Car className={`w-12 h-12 mx-auto mb-3 ${theme === "light" ? "text-slate-400" : "text-slate-600"}`} />
              <p className={`text-base font-bold ${theme === "light" ? "text-slate-800" : "text-slate-300"}`}>ยังไม่มีข้อมูลยานพาหนะ</p>
              <p className={`text-xs mt-1 max-w-md mx-auto ${theme === "light" ? "text-slate-500" : "text-slate-500"}`}>
                กดปุ่ม "+ เพิ่มข้อมูลรถ" เพื่อตั้งค่ารอบถ่ายน้ำมันเครื่องสำหรับรถยนต์หรือรถมอเตอร์ไซค์ของคุณ
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v) => {
                const targetMileage = v.lastServiceMileage + v.intervalKm;
                const remainingKm = targetMileage - v.currentMileage;
                
                const targetDateStr = addMonthsToDate(v.lastServiceDate, v.intervalMonths);
                const remainingDays = getDaysDiff(targetDateStr);

                const isOverdue = remainingKm <= 0 || remainingDays <= 0;
                const isSoon = !isOverdue && (remainingKm <= 500 || remainingDays <= 15);

                const usedKm = Math.max(0, v.currentMileage - v.lastServiceMileage);
                const progressPercent = Math.min(100, Math.round((usedKm / (v.intervalKm || 1)) * 100));

                const avgKml = getVehicleAverageKmPerLiter(v);

                return (
                  <div 
                    key={v.id} 
                    className={`border rounded-2xl p-5 relative overflow-hidden transition-all shadow-md ${
                      theme === "light"
                        ? isOverdue
                          ? "bg-rose-50/70 border-rose-300"
                          : isSoon
                          ? "bg-amber-50/70 border-amber-300"
                          : "bg-white border-slate-200/90 shadow-2xs"
                        : isOverdue 
                          ? "bg-slate-900/90 border-rose-500/50 shadow-rose-950/20" 
                          : isSoon 
                          ? "bg-slate-900/90 border-amber-500/50 shadow-amber-950/20" 
                          : "bg-slate-900/90 border-white/10"
                    }`}
                  >
                    {/* Top Status Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`p-3 rounded-2xl border ${
                          theme === "light"
                            ? "bg-purple-100 text-purple-900 border-purple-200"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        }`}>
                          <Car className={`w-6 h-6 ${theme === "light" ? "text-purple-700" : "text-purple-300"}`} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`font-black text-lg ${theme === "light" ? "text-slate-900" : "text-white"}`}>{v.vehicleName}</h4>
                            {avgKml && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30" title="อัตราประหยัดน้ำมันเฉลี่ย">
                                ⚡ {avgKml.toFixed(1)} KM/L
                              </span>
                            )}
                          </div>
                          {v.plateNumber && (
                            <span className={`text-xs font-mono font-bold block ${
                              theme === "light" ? "text-purple-900" : "text-purple-300/80"
                            }`}>
                              ทะเบียน: {v.plateNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isOverdue ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>ถึงเวลาถ่ายน้ำมันเครื่อง!</span>
                        </span>
                      ) : isSoon ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>ใกล้ถึงรอบกำหนด</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>ระยะปกติ</span>
                        </span>
                      )}
                    </div>

                    {/* Mileage Box & Quick Update */}
                    <div className={`rounded-xl p-3 border mb-4 ${
                      theme === "light" ? "bg-slate-50 border-slate-200" : "bg-black/40 border-white/10"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-[11px] block font-semibold ${
                            theme === "light" ? "text-slate-600" : "text-slate-400"
                          }`}>เลขมิเตอร์ปัจจุบัน</span>
                          <span className={`text-2xl font-black font-mono tracking-tight ${
                            theme === "light" ? "text-slate-900" : "text-white"
                          }`}>
                            {v.currentMileage.toLocaleString()} <span className={`text-xs font-sans ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>km</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenMileageUpdate(v)}
                          className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer border ${
                            theme === "light"
                              ? "bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border-indigo-300"
                              : "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/30"
                          }`}
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span>อัปเดตเลขมิเตอร์</span>
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className={`flex justify-between text-[11px] mb-1 font-mono ${
                          theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"
                        }`}>
                          <span>ใช้ไปแล้ว {usedKm.toLocaleString()} / {v.intervalKm.toLocaleString()} km</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden border ${
                          theme === "light" ? "bg-slate-200 border-slate-300" : "bg-slate-800 border-white/5"
                        }`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverdue ? "bg-rose-500" : isSoon ? "bg-amber-500" : "bg-gradient-to-r from-purple-600 to-indigo-600"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rules & Targets Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div className={`p-2.5 rounded-xl border ${
                        theme === "light" ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-white/5"
                      }`}>
                        <span className={`block text-[10px] font-semibold ${
                          theme === "light" ? "text-slate-600" : "text-slate-400"
                        }`}>เป้าหมายถ่ายน้ำมันเครื่องครั้งถัดไป:</span>
                        <span className={`font-extrabold font-mono text-sm block mt-0.5 ${
                          theme === "light" ? "text-purple-900" : "text-purple-300"
                        }`}>
                          {targetMileage.toLocaleString()} km
                        </span>
                        <span className={`text-[11px] font-mono block mt-0.5 ${
                          theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"
                        }`}>
                          {remainingKm <= 0 ? (
                            <strong className="text-rose-600 dark:text-rose-400">เกินกำหนดไป {Math.abs(remainingKm).toLocaleString()} km</strong>
                          ) : (
                            <span>เหลืออีก <strong className={theme === "light" ? "text-slate-900" : "text-white"}>{remainingKm.toLocaleString()} km</strong></span>
                          )}
                        </span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${
                        theme === "light" ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-white/5"
                      }`}>
                        <span className={`block text-[10px] font-semibold ${
                          theme === "light" ? "text-slate-600" : "text-slate-400"
                        }`}>กำหนดวันที่ถ่ายถัดไป:</span>
                        <span className={`font-extrabold font-mono text-xs block mt-0.5 ${
                          theme === "light" ? "text-indigo-900" : "text-indigo-300"
                        }`}>
                          {formatDateTh(targetDateStr)}
                        </span>
                        <span className={`text-[11px] font-mono block mt-0.5 ${
                          theme === "light" ? "text-slate-600 font-semibold" : "text-slate-400"
                        }`}>
                          {remainingDays <= 0 ? (
                            <strong className="text-rose-600 dark:text-rose-400">เลยกำหนดไป {Math.abs(remainingDays)} วัน</strong>
                          ) : (
                            <span>เหลืออีก <strong className={theme === "light" ? "text-slate-900" : "text-white"}>{remainingDays} วัน</strong></span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Fuel Refill Info Summary */}
                    {v.fuelHistory && v.fuelHistory.length > 0 && (() => {
                      const latestFuel = v.fuelHistory[0];
                      return (
                        <div className={`text-[11px] p-2.5 rounded-xl border mb-3 flex flex-col gap-1.5 ${
                          theme === "light"
                            ? "bg-amber-50/80 border-amber-200 text-slate-800"
                            : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className="font-bold flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                              <Fuel className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>เติมน้ำมันล่าสุด ({formatDateTh(latestFuel.date)})</span>
                            </span>
                            <strong className="font-mono text-xs text-amber-800 dark:text-amber-300 font-extrabold">
                              ฿{latestFuel.totalCost.toLocaleString()}
                            </strong>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                            <span>
                              {latestFuel.liters ? `${latestFuel.liters} ลิตร` : ""} 
                              {latestFuel.pricePerLiter ? ` (@ ฿${latestFuel.pricePerLiter.toFixed(2)}/ลิตร)` : ""}
                              {latestFuel.gasStation ? ` • ปั๊ม ${latestFuel.gasStation}` : ""}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {latestFuel.kmPerLiter ? (
                                <span className="font-bold text-teal-800 dark:text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded">
                                  ⚡ {latestFuel.kmPerLiter.toFixed(1)} KM/L
                                </span>
                              ) : null}
                              {latestFuel.fuelPercent ? (
                                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                                  เติม ~{latestFuel.fuelPercent.toFixed(1)}% จากถัง
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Maintenance Info Summary */}
                    {v.maintenanceHistory && v.maintenanceHistory.length > 0 && (() => {
                      const latestMaint = v.maintenanceHistory[0];
                      return (
                        <div className={`text-[11px] p-2.5 rounded-xl border mb-3 flex flex-col gap-1.5 ${
                          theme === "light"
                            ? "bg-purple-50/80 border-purple-200 text-slate-800"
                            : "bg-purple-950/20 border-purple-500/30 text-purple-200"
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className="font-bold flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300">
                              <Wrench className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>ซ่อมบำรุงล่าสุด: {latestMaint.title} ({formatDateTh(latestMaint.date)})</span>
                            </span>
                            <strong className="font-mono text-xs text-purple-800 dark:text-purple-300 font-extrabold">
                              ฿{latestMaint.cost.toLocaleString()}
                            </strong>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                            <span>
                              หมวดหมู่: {latestMaint.category || "ทั่วไป"}
                              {latestMaint.shopName ? ` • ร้าน: ${latestMaint.shopName}` : ""}
                              {` • มิเตอร์: ${latestMaint.mileage.toLocaleString()} km`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Oil Service Info Summary */}
                    <div className={`text-[11px] p-2.5 rounded-xl border mb-4 flex justify-between items-center ${
                      theme === "light" ? "bg-slate-100/80 border-slate-200 text-slate-700" : "text-slate-400 bg-black/20 border-white/5"
                    }`}>
                      <div>
                        <span>ถ่ายน้ำมันเครื่องล่าสุด: <strong className={theme === "light" ? "text-slate-900" : "text-white"}>{formatDateTh(v.lastServiceDate)}</strong> ({v.lastServiceMileage.toLocaleString()} km)</span>
                        {v.lastServiceCost ? <span className={`ml-2 font-mono font-bold ${theme === "light" ? "text-emerald-800" : "text-emerald-300"}`}>฿{v.lastServiceCost.toLocaleString()}</span> : null}
                      </div>
                      <span className={`font-mono text-[10px] font-bold ${
                        theme === "light" ? "text-purple-900" : "text-purple-300/80"
                      }`}>รอบ: ทุก {v.intervalKm.toLocaleString()} km / {v.intervalMonths} เดือน</span>
                    </div>

                    {/* Action buttons */}
                    <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t ${
                      theme === "light" ? "border-slate-200" : "border-white/10"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setVehicleHistoryTab("fuel");
                            setViewHistoryVehicle(v);
                          }}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                            theme === "light"
                              ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                              : "bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          <History className={`w-3.5 h-3.5 ${theme === "light" ? "text-indigo-600" : "text-indigo-400"}`} />
                          <span>ประวัติ</span>
                        </button>
                        <button
                          onClick={() => handleOpenVehicleModal(v)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                            theme === "light"
                              ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                              : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                          }`}
                          title="แก้ไขข้อมูลรถ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                            theme === "light"
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs"
                              : "bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                          }`}
                          title="ลบรถ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => handleOpenFuelLogModal(v)}
                          className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-amber-600/20"
                        >
                          <Fuel className="w-3.5 h-3.5" />
                          <span>เติมน้ำมัน</span>
                        </button>
                        <button
                          onClick={() => handleOpenOilChangeLog(v)}
                          className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Droplet className="w-3.5 h-3.5" />
                          <span>ถ่ายน้ำมันเครื่อง</span>
                        </button>
                        <button
                          onClick={() => handleOpenMaintenanceModal(v)}
                          className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-purple-600/20"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>ซ่อมบำรุง</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3: AIR CONDITIONER CLEANING (ล้างแอร์)
         ========================================== */}
      {activeTab === "ac" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-cyan-400" />
                ระบบบันทึกวันที่ล้างแอร์ & กำหนดรอบถัดไป
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ตั้งค่ารอบการล้างแอร์ เช่น ทุก 6 เดือน บันทึกช่างผู้ให้บริการ ค่าใช้จ่าย และระบบแจ้งเตือนวันครบกำหนด
              </p>
            </div>

            <button
              onClick={() => handleOpenAcModal()}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มเครื่องปรับอากาศ</span>
            </button>
          </div>

          {/* AC Unit Cards Grid */}
          {acServices.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-slate-900/40">
              <Snowflake className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-300">ยังไม่มีข้อมูลเครื่องปรับอากาศ</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                กดปุ่ม "+ เพิ่มเครื่องปรับอากาศ" เพื่อเริ่มต้นระบบติดตามการล้างแอร์ตามระยะเวลา
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acServices.map((ac) => {
                const targetDateStr = addMonthsToDate(ac.lastCleanDate, ac.intervalMonths);
                const remainingDays = getDaysDiff(targetDateStr);

                const isOverdue = remainingDays <= 0;
                const isSoon = !isOverdue && remainingDays <= 30;

                return (
                  <div 
                    key={ac.id} 
                    className={`bg-slate-900/90 border rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden transition-all shadow-xl ${
                      isOverdue 
                        ? "border-rose-500/50 shadow-rose-950/20" 
                        : isSoon 
                        ? "border-amber-500/50 shadow-amber-950/20" 
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          <Snowflake className="w-6 h-6" />
                        </span>
                        <div>
                          <h4 className="font-black text-lg text-white">{ac.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                            {ac.location && <span>ตำแหน่ง: {ac.location}</span>}
                            {ac.brand && <span>| ยี่ห้อ: {ac.brand}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isOverdue ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>ถึงเวลาล้างแอร์แล้ว!</span>
                        </span>
                      ) : isSoon ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>ใกล้ครบกำหนด</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>พร้อมใช้งาน</span>
                        </span>
                      )}
                    </div>

                    {/* Maintenance Cycle Box */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/10 mb-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">วันที่ล้างแอร์ล่าสุด:</span>
                        <span className="font-bold text-white block mt-0.5">{formatDateTh(ac.lastCleanDate)}</span>
                        {ac.technician && <span className="text-[10px] text-cyan-300/80 block mt-0.5">ช่าง: {ac.technician}</span>}
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px]">กำหนดรอบถัดไป:</span>
                        <span className="font-bold text-cyan-300 block mt-0.5">{formatDateTh(targetDateStr)}</span>
                        <span className="text-[11px] block mt-0.5 font-mono">
                          {remainingDays <= 0 ? (
                            <strong className="text-rose-400">เลยกำหนดไป {Math.abs(remainingDays)} วัน</strong>
                          ) : (
                            <span className="text-emerald-300">เหลืออีก <strong>{remainingDays} วัน</strong></span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-black/20 p-2.5 rounded-xl border border-white/5 mb-4 flex justify-between items-center">
                      <span>รอบการล้าง: <strong>ทุกๆ {ac.intervalMonths} เดือน</strong></span>
                      {ac.lastCleanCost ? <span className="font-mono text-emerald-300">ค่าล้างล่าสุด: ฿{ac.lastCleanCost.toLocaleString()}</span> : null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewHistoryAc(ac)}
                          className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-teal-400" />
                          <span>ประวัติ</span>
                        </button>
                        <button
                          onClick={() => handleOpenAcModal(ac)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="แก้ไขข้อมูลแอร์"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAc(ac.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                          title="ลบข้อมูลแอร์"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenAcCleanLog(ac)}
                        className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-600/20"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>บันทึกการล้างแอร์</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODALS & FORM DIALOGS
         ========================================== */}

      {/* 1. Utility Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                {billType === "electricity" ? <Zap className="w-5 h-5 text-amber-400" /> : <Droplet className="w-5 h-5 text-cyan-400" />}
                <span>{editingBillId ? "แก้ไขบิล" : "บันทึกบิลใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBillModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => handleTypeChangeInModal("electricity")}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    billType === "electricity" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-4 h-4" /> ค่าไฟฟ้า
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChangeInModal("water")}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    billType === "water" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Droplet className="w-4 h-4" /> ค่าน้ำประปา
                </button>
              </div>

              {/* Month & Bill Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ประจำเดือน (YYYY-MM)</label>
                  <input
                    type="month"
                    value={billMonth}
                    onChange={(e) => setBillMonth(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่ในใบแจ้งหนี้</label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Meter Auto-Fetch Banner */}
              {autoFetchedMeterInfo ? (
                <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{autoFetchedMeterInfo}</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                  ℹ️ ไม่พบประวัติบิลเดือนก่อนหน้า สามารถกรอกเลขมิเตอร์ครั้งก่อนด้วยตัวเอง
                </div>
              )}

              {/* Meter Start & End */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ครั้งก่อน</label>
                  <input
                    type="number"
                    step="any"
                    value={startMeter}
                    onChange={(e) => setStartMeter(e.target.value)}
                    placeholder="เช่น 10710"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ครั้งนี้</label>
                  <input
                    type="number"
                    step="any"
                    value={endMeter}
                    onChange={(e) => setEndMeter(e.target.value)}
                    placeholder="เช่น 11253"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Live Units Calculated */}
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">จำนวนยูนิต/หน่วยที่ใช้ไป:</span>
                <span className="font-extrabold text-sky-300 font-mono text-sm">
                  {calcUnitsUsed.toLocaleString()} หน่วย
                </span>
              </div>

              {/* Breakdown Fields */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 block">รายละเอียดค่าใช้จ่ายในบิล</span>
                  <span className="text-[10px] text-amber-400 font-medium">* กรอกยอดรวมอย่างเดียวได้</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่าไฟ/ค่าน้ำฐาน (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={baseCost}
                      onChange={(e) => setBaseCost(e.target.value)}
                      placeholder={isReverseCalculated ? `ย้อนกลับ: ${calcBaseCost.toFixed(2)}` : "2175.01"}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่า FT (฿) <span className="text-[9px] text-slate-500">(เว้น=0)</span></label>
                    <input
                      type="number"
                      step="any"
                      value={ftCost}
                      onChange={(e) => setFtCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่าบริการ (฿) <span className="text-[9px] text-slate-500">(เว้น=0)</span></label>
                    <input
                      type="number"
                      step="any"
                      value={serviceFee}
                      onChange={(e) => setServiceFee(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ภาษีมูลค่าเพิ่ม (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={vatPercent}
                      onChange={(e) => setVatPercent(e.target.value)}
                      placeholder="7"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-extrabold text-amber-300">ยอดรวมเงิน (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={manualTotal}
                      onChange={(e) => setManualTotal(e.target.value)}
                      placeholder={hasBaseCost ? `คำนวณ: ${computedTotal}` : "เช่น 1070.00"}
                      className="w-full bg-slate-800 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-amber-200 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Banner when reverse calculation is active */}
                {isReverseCalculated && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between gap-2 font-sans">
                    <span className="leading-tight">
                      ⚡ คำนวณย้อนกลับจากยอดรวม <strong>฿{finalTotalAmount.toFixed(2)}</strong> → ได้ค่าฐานก่อน VAT = <strong>฿{calcBaseCost.toFixed(2)}</strong> (VAT {calcVatPercent}%: ฿{calcVatAmount.toFixed(2)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setBaseCost(calcBaseCost.toFixed(2))}
                      className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all border border-amber-500/30"
                    >
                      ใส่ค่าในช่องฐาน
                    </button>
                  </div>
                )}
              </div>

              {/* Calculated Summary Box */}
              <div className="bg-gradient-to-r from-indigo-950/80 to-purple-950/80 p-3.5 rounded-xl border border-indigo-500/30 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>รวมก่อน VAT:</span>
                  <span>฿{calcSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>ภาษี VAT ({calcVatPercent}%):</span>
                  <span>฿{calcVatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-1 border-t border-white/10 text-sm">
                  <span>ยอดสุทธิรวมทั้งสิ้น:</span>
                  <span className="text-emerald-300 text-base">฿{finalTotalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sky-300 text-[11px] pt-0.5">
                  <span>อัตราต่อหน่วย:</span>
                  <span>{calcRatePerUnit.toFixed(2)} บาท / หน่วย</span>
                </div>
              </div>

              {/* Select Wallet Payment */}
              {wallets.length > 0 && !editingBillId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตัดเงินจากกระเป๋า (เพื่อบันทึกเป็นค่าใช้จ่าย)</label>
                  <select
                    value={billWalletId}
                    onChange={(e) => setBillWalletId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- ไม่ต้องบันทึกลงกระเป๋าเงิน --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBillModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  บันทึกข้อมูลบิล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Vehicle Add/Edit Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-purple-400" />
                <span>{editingVehicleId ? "แก้ไขข้อมูลรถ" : "เพิ่มข้อมูลรถใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVehicleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อเรียกยานพาหนะ</label>
                <input
                  type="text"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  placeholder="เช่น รถยนต์ Mazda 2, รถมอเตอร์ไซค์"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ทะเบียนรถ (ถ้ามี)</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="เช่น 1กข 1234 กทม"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ถ่ายน้ำมันเครื่องทุกๆ (km)</label>
                  <input
                    type="number"
                    value={vehicleIntervalKm}
                    onChange={(e) => setVehicleIntervalKm(e.target.value)}
                    placeholder="3000"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">หรือทุกๆ (เดือน)</label>
                  <input
                    type="number"
                    value={vehicleIntervalMonths}
                    onChange={(e) => setVehicleIntervalMonths(e.target.value)}
                    placeholder="4"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่ถ่ายล่าสุด</label>
                  <input
                    type="date"
                    value={vehicleLastDate}
                    onChange={(e) => setVehicleLastDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ตอนถ่ายล่าสุด</label>
                  <input
                    type="number"
                    value={vehicleLastMileage}
                    onChange={(e) => setVehicleLastMileage(e.target.value)}
                    placeholder="เช่น 42000"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ปัจจุบัน (km)</label>
                <input
                  type="number"
                  value={vehicleCurrentMileage}
                  onChange={(e) => setVehicleCurrentMileage(e.target.value)}
                  placeholder="เช่น 44500"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ความจุถังน้ำมัน (ลิตร)</label>
                <input
                  type="number"
                  step="any"
                  value={vehicleTankCapacity}
                  onChange={(e) => setVehicleTankCapacity(e.target.value)}
                  placeholder="เช่น 45 (รถยนต์) หรือ 5.5 (รถมอเตอร์ไซค์)"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  บันทึกข้อมูลรถ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Quick Mileage Update Modal */}
      {showMileageUpdateModal && updatingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative">
            <h3 className="font-extrabold text-base text-white mb-2 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-indigo-400" />
              <span>อัปเดตเลขมิเตอร์รถ</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              กรอกเลขมิเตอร์กิโลเมตรล่าสุดของ <strong className="text-white">{updatingVehicle.vehicleName}</strong>
            </p>

            <form onSubmit={handleSaveQuickMileage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ปัจจุบัน (km)</label>
                <input
                  type="number"
                  value={newMileageInput}
                  onChange={(e) => setNewMileageInput(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-lg font-mono font-bold focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMileageUpdateModal(false)}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  บันทึกเลขมิเตอร์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Oil Change Log Modal */}
      {showOilChangeLogModal && loggingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <span>บันทึกถ่ายน้ำมันเครื่อง ({loggingVehicle.vehicleName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowOilChangeLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOilChangeLog} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่ถ่ายน้ำมันเครื่อง</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ตอนถ่าย (km)</label>
                  <input
                    type="number"
                    value={logMileage}
                    onChange={(e) => setLogMileage(e.target.value)}
                    placeholder="เช่น 45000"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ค่าใช้จ่าย (บาท)</label>
                  <input
                    type="number"
                    step="any"
                    value={logCost}
                    onChange={(e) => setLogCost(e.target.value)}
                    placeholder="เช่น 1200"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อศูนย์/ร้านบริการ</label>
                  <input
                    type="text"
                    value={logShop}
                    onChange={(e) => setLogShop(e.target.value)}
                    placeholder="เช่น B-Quik, ศูนย์บริการ"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  placeholder="เช่น เปลี่ยนกรองน้ำมันเครื่องด้วย"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Select Wallet Payment */}
              {wallets.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตัดเงินจากกระเป๋า (เพื่อบันทึกค่าใช้จ่าย)</label>
                  <select
                    value={logWalletId}
                    onChange={(e) => setLogWalletId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- ไม่ต้องบันทึกลงกระเป๋าเงิน --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowOilChangeLogModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  บันทึกการถ่ายน้ำมันเครื่อง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. AC Add/Edit Modal */}
      {showAcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-cyan-400" />
                <span>{editingAcId ? "แก้ไขข้อมูลเครื่องปรับอากาศ" : "เพิ่มเครื่องปรับอากาศใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAcModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAc} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อเครื่องปรับอากาศ</label>
                <input
                  type="text"
                  value={acName}
                  onChange={(e) => setAcName(e.target.value)}
                  placeholder="เช่น แอร์ห้องนอนใหญ่, แอร์ห้องนั่งเล่น"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตำแหน่งติดตั้ง</label>
                  <input
                    type="text"
                    value={acLocation}
                    onChange={(e) => setAcLocation(e.target.value)}
                    placeholder="เช่น ชั้น 2 ห้องนอน"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ยี่ห้อ / รุ่น</label>
                  <input
                    type="text"
                    value={acBrand}
                    onChange={(e) => setAcBrand(e.target.value)}
                    placeholder="เช่น Daikin, Mitsubishi"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">กำหนดรอบล้างแอร์ทุกๆ (เดือน)</label>
                <input
                  type="number"
                  value={acIntervalMonths}
                  onChange={(e) => setAcIntervalMonths(e.target.value)}
                  placeholder="6"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่ล้างครั้งล่าสุด</label>
                  <input
                    type="date"
                    value={acLastDate}
                    onChange={(e) => setAcLastDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ค่าบริการล้างล่าสุด (บาท)</label>
                  <input
                    type="number"
                    value={acLastCost}
                    onChange={(e) => setAcLastCost(e.target.value)}
                    placeholder="เช่น 600"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAcModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-teal-600/30"
                >
                  บันทึกข้อมูลแอร์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. AC Clean Log Modal */}
      {showAcCleanLogModal && loggingAc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-teal-400" />
                <span>บันทึกการล้างแอร์ ({loggingAc.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAcCleanLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAcCleanLog} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่ล้างแอร์</label>
                  <input
                    type="date"
                    value={acCleanDate}
                    onChange={(e) => setAcCleanDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ค่าบริการ (บาท)</label>
                  <input
                    type="number"
                    step="any"
                    value={acCleanCost}
                    onChange={(e) => setAcCleanCost(e.target.value)}
                    placeholder="เช่น 600"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อช่าง / ศูนย์บริการ</label>
                <input
                  type="text"
                  value={acCleanTech}
                  onChange={(e) => setAcCleanTech(e.target.value)}
                  placeholder="เช่น ช่างสมชาย, โฮมโปร"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={acCleanNote}
                  onChange={(e) => setAcCleanNote(e.target.value)}
                  placeholder="เช่น เติมน้ำยาแอร์เพิ่ม 20 ปอนด์"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Select Wallet Payment */}
              {wallets.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตัดเงินจากกระเป๋า (เพื่อบันทึกค่าใช้จ่าย)</label>
                  <select
                    value={acCleanWalletId}
                    onChange={(e) => setAcCleanWalletId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- ไม่ต้องบันทึกลงกระเป๋าเงิน --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAcCleanLogModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-teal-600/30"
                >
                  บันทึกการล้างแอร์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Fuel Log Modal */}
      {showFuelLogModal && fuelingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Fuel className="w-5 h-5 text-amber-400" />
                <span>{editingFuelLogId ? "แก้ไขประวัติเติมน้ำมัน" : "บันทึกเติมน้ำมัน"} ({fuelingVehicle.vehicleName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFuelLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFuelLog} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่เติมน้ำมัน</label>
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ ณ วันที่เติม (km)</label>
                  <input
                    type="number"
                    value={fuelMileage}
                    onChange={(e) => setFuelMileage(e.target.value)}
                    placeholder="เช่น 45000"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">จำนวนเงินค่าน้ำมัน (บาท)</label>
                  <input
                    type="number"
                    step="any"
                    value={fuelCost}
                    onChange={(e) => setFuelCost(e.target.value)}
                    placeholder="เช่น 1000"
                    required
                    className="w-full bg-slate-800 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-200 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">จำนวนลิตร (ถ้ามี)</label>
                  <input
                    type="number"
                    step="any"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    placeholder="เช่น 26.5"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ความจุถังน้ำมัน (ลิตร)</label>
                  <input
                    type="number"
                    step="any"
                    value={fuelTankCapacityInput}
                    onChange={(e) => setFuelTankCapacityInput(e.target.value)}
                    placeholder="45"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ปั๊มน้ำมัน / สถานี</label>
                  <input
                    type="text"
                    value={fuelStation}
                    onChange={(e) => setFuelStation(e.target.value)}
                    placeholder="เช่น PTT, Shell, บางจาก"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Calculated Preview Panel */}
              {(() => {
                const costVal = parseFloat(fuelCost) || 0;
                const litersVal = parseFloat(fuelLiters) || 0;
                const capVal = parseFloat(fuelTankCapacityInput) || 0;
                const pricePerLiter = litersVal > 0 && costVal > 0 ? (costVal / litersVal) : 0;
                const tankPercent = litersVal > 0 && capVal > 0 ? Math.min(100, (litersVal / capVal) * 100) : 0;

                if (costVal <= 0 && litersVal <= 0) return null;

                return (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-300 font-mono">
                      <span>ราคาเฉลี่ยต่อลิตร:</span>
                      <strong className="text-amber-300 font-bold text-sm">
                        {pricePerLiter > 0 ? `฿${pricePerLiter.toFixed(2)} / ลิตร` : "-"}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-slate-300 font-mono">
                      <span>เฉลี่ยเติมคิดเป็น:</span>
                      <strong className="text-emerald-300 font-bold text-sm">
                        {tankPercent > 0 ? `~${tankPercent.toFixed(1)}% จากเต็มถัง` : "-"}
                      </strong>
                    </div>

                    {/* Tank visual bar */}
                    {tankPercent > 0 && (
                      <div className="pt-1">
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all"
                            style={{ width: `${tankPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1 text-right font-mono">
                          ({litersVal} ลิตร จากถัง {capVal} ลิตร)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ประเภทน้ำมัน</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="แก๊สโซฮอล์ 95">แก๊สโซฮอล์ 95</option>
                    <option value="แก๊สโซฮอล์ 91">แก๊สโซฮอล์ 91</option>
                    <option value="E20">E20</option>
                    <option value="E85">E85</option>
                    <option value="เบนซิน 95">เบนซิน 95</option>
                    <option value="ดีเซล">ดีเซล</option>
                    <option value="ดีเซล B7">ดีเซล B7</option>
                    <option value="ดีเซลพรีเมียม">ดีเซลพรีเมียม</option>
                    <option value="ไฟฟ้า EV">ชาร์จไฟฟ้า EV</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fuelIsFull}
                      onChange={(e) => setFuelIsFull(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-white/20 focus:ring-amber-500"
                    />
                    <span>เติมเต็มถัง (Full Tank)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={fuelNote}
                  onChange={(e) => setFuelNote(e.target.value)}
                  placeholder="เช่น ล้างกระจกฟรี, ได้คูปองส่วนลด"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Select Wallet Payment */}
              {wallets.length > 0 && !editingFuelLogId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตัดเงินจากกระเป๋า (เพื่อบันทึกเป็นค่าใช้จ่าย)</label>
                  <select
                    value={fuelWalletId}
                    onChange={(e) => setFuelWalletId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- ไม่ต้องบันทึกลงกระเป๋าเงิน --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowFuelLogModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-600/30"
                >
                  {editingFuelLogId ? "แก้ไขประวัติเติมน้ำมัน" : "บันทึกค่าน้ำมัน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Maintenance Log Modal */}
      {showMaintenanceModal && maintainingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-purple-400" />
                <span>{editingMaintLogId ? "แก้ไขประวัติซ่อมบำรุง" : `บันทึกค่าซ่อมบำรุง (${maintainingVehicle.vehicleName})`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMaintenanceLog} className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">รายการซ่อม / อะไหล่ที่เปลี่ยน *</label>
                <input
                  type="text"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="เช่น เปลี่ยนยาง 4 เส้น, เปลี่ยนผ้าเบรก, ซ่อมแอร์"
                  required
                  className="w-full bg-slate-800 border border-purple-500/40 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">หมวดหมู่</label>
                  <select
                    value={maintCategory}
                    onChange={(e) => setMaintCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="ช่วงล่าง & เบรก">ช่วงล่าง & เบรก</option>
                    <option value="ยาง & ล้อ">ยาง & ล้อ</option>
                    <option value="เครื่องยนต์ & เกียร์">เครื่องยนต์ & เกียร์</option>
                    <option value="ระบบไฟ & แบตเตอรี่">ระบบไฟ & แบตเตอรี่</option>
                    <option value="แอร์ & ระบบความเย็น">แอร์ & ระบบความเย็น</option>
                    <option value="ตัวถัง & สี">ตัวถัง & สี</option>
                    <option value="ประกัน & ต่อภาษี">ประกัน & ต่อภาษี</option>
                    <option value="ทั่วไป">ทั่วไป / อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">ค่าใช้จ่ายรวม (บาท) *</label>
                  <input
                    type="number"
                    step="any"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    placeholder="เช่น 3500"
                    required
                    className="w-full bg-slate-800 border border-purple-500/40 rounded-xl px-3 py-2 text-purple-200 text-xs font-mono font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">วันที่รับบริการ</label>
                  <input
                    type="date"
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">เลขมิเตอร์ตอนซ่อม (km)</label>
                  <input
                    type="number"
                    value={maintMileage}
                    onChange={(e) => setMaintMileage(e.target.value)}
                    placeholder={maintainingVehicle.currentMileage.toString()}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ชื่ออู่ / ศูนย์บริการ</label>
                <input
                  type="text"
                  value={maintShop}
                  onChange={(e) => setMaintShop(e.target.value)}
                  placeholder="เช่น ศูนย์ B-Quik, อู่ช่างต้อม"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">รายละเอียด / หมายเหตุ</label>
                <input
                  type="text"
                  value={maintNote}
                  onChange={(e) => setMaintNote(e.target.value)}
                  placeholder="เช่น รับประกันอะไหล่ 6 เดือน"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Select Wallet Payment */}
              {wallets.length > 0 && !editingMaintLogId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ตัดเงินจากกระเป๋า (เพื่อบันทึกเป็นค่าใช้จ่าย)</label>
                  <select
                    value={maintWalletId}
                    onChange={(e) => setMaintWalletId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="">-- ไม่ต้องบันทึกลงกระเป๋าเงิน --</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  {editingMaintLogId ? "บันทึกการแก้ไข" : "บันทึกค่าซ่อมบำรุง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Viewer Modal for Vehicle */}
      {viewHistoryVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>ประวัติยานพาหนะ ({viewHistoryVehicle.vehicleName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewHistoryVehicle(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-1.5 mb-3 bg-slate-800/80 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setVehicleHistoryTab("fuel")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  vehicleHistoryTab === "fuel"
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Fuel className="w-3.5 h-3.5" />
                <span>น้ำมัน ({viewHistoryVehicle.fuelHistory?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setVehicleHistoryTab("oil")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  vehicleHistoryTab === "oil"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Droplet className="w-3.5 h-3.5" />
                <span>น้ำมันเครื่อง ({viewHistoryVehicle.history?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setVehicleHistoryTab("maint")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  vehicleHistoryTab === "maint"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>ซ่อมบำรุง ({viewHistoryVehicle.maintenanceHistory?.length || 0})</span>
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {vehicleHistoryTab === "fuel" ? (
                /* Fuel History View */
                (!viewHistoryVehicle.fuelHistory || viewHistoryVehicle.fuelHistory.length === 0) ? (
                  <div className="text-center py-8">
                    <Fuel className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">ยังไม่มีประวัติการเติมน้ำมัน</p>
                    <button
                      onClick={() => handleOpenFuelLogModal(viewHistoryVehicle)}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      + บันทึกเติมน้ำมันครั้งแรก
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Fuel Summary Stats */}
                    {(() => {
                      const history = viewHistoryVehicle.fuelHistory || [];
                      const totalCost = history.reduce((sum, item) => sum + (item.totalCost || 0), 0);
                      const totalLiters = history.reduce((sum, item) => sum + (item.liters || 0), 0);
                      const avgPrice = totalLiters > 0 && totalCost > 0 ? (totalCost / totalLiters) : 0;
                      const validKmls = history.map(item => item.kmPerLiter).filter((k): k is number => typeof k === "number" && k > 0);
                      const avgKml = validKmls.length > 0 ? (validKmls.reduce((a, b) => a + b, 0) / validKmls.length) : null;

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                            <span className="text-[10px] text-amber-300 block">ค่าน้ำมันรวม</span>
                            <strong className="text-xs font-mono font-bold text-white">฿{totalCost.toLocaleString()}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                            <span className="text-[10px] text-amber-300 block">ปริมาณรวม</span>
                            <strong className="text-xs font-mono font-bold text-white">{totalLiters > 0 ? `${totalLiters.toFixed(1)}L` : "-"}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                            <span className="text-[10px] text-amber-300 block">เฉลี่ย ฿/ลิตร</span>
                            <strong className="text-xs font-mono font-bold text-white">{avgPrice > 0 ? `฿${avgPrice.toFixed(2)}` : "-"}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center">
                            <span className="text-[10px] text-teal-300 block">เฉลี่ย KM/L</span>
                            <strong className="text-xs font-mono font-bold text-teal-200">{avgKml ? `${avgKml.toFixed(2)}` : "-"}</strong>
                          </div>
                        </div>
                      );
                    })()}

                    {computeFuelHistoryWithKml(viewHistoryVehicle.fuelHistory).map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1.5">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-bold text-white">{formatDateTh(log.date)}</span>
                          <span className="font-bold text-amber-300 font-mono text-sm">฿{log.totalCost.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 font-mono">
                            มิเตอร์: {log.mileage.toLocaleString()} km
                          </span>
                          {log.kmPerLiter ? (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-mono font-extrabold border border-teal-500/30">
                              ⚡ {log.kmPerLiter.toFixed(2)} KM/L
                            </span>
                          ) : null}
                          {log.pricePerLiter ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold">
                              ฿{log.pricePerLiter.toFixed(2)} / ลิตร
                            </span>
                          ) : null}
                          {log.liters ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                              {log.liters} ลิตร {log.fuelPercent ? `(~${log.fuelPercent.toFixed(1)}% ถัง)` : ""}
                            </span>
                          ) : null}
                          {log.gasStation ? (
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300">
                              ปั๊ม: {log.gasStation}
                            </span>
                          ) : null}
                          {log.fuelType ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">
                              {log.fuelType}
                            </span>
                          ) : null}
                          {log.isFullTank && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-bold">
                              เต็มถัง
                            </span>
                          )}
                        </div>

                        {log.note && (
                          <p className="text-[11px] text-slate-400 pt-1 border-t border-white/5">
                            หมายเหตุ: {log.note}
                          </p>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenFuelLogModal(viewHistoryVehicle, log)}
                            className="text-[10px] text-indigo-300 hover:text-indigo-200 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFuelLog(viewHistoryVehicle.id, log.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-white/5 hover:bg-rose-500/20 cursor-pointer"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )
              ) : vehicleHistoryTab === "oil" ? (
                /* Oil Change History View */
                (!viewHistoryVehicle.history || viewHistoryVehicle.history.length === 0) ? (
                  <p className="text-center text-xs text-slate-400 py-6">ยังไม่มีประวัติการถ่ายน้ำมันเครื่อง</p>
                ) : (
                  viewHistoryVehicle.history.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-bold text-white">{formatDateTh(log.date)}</span>
                        <span className="font-bold text-purple-300">{log.mileage.toLocaleString()} km</span>
                      </div>
                      {(log.cost || log.shopName || log.note) && (
                        <div className="mt-1 pt-1 border-t border-white/5 flex justify-between text-slate-400 text-[11px]">
                          <span>{log.shopName ? `ร้าน: ${log.shopName}` : log.note}</span>
                          {log.cost ? <strong className="text-emerald-300 font-mono">฿{log.cost.toLocaleString()}</strong> : null}
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : (
                /* Maintenance History View */
                (!viewHistoryVehicle.maintenanceHistory || viewHistoryVehicle.maintenanceHistory.length === 0) ? (
                  <div className="text-center py-8">
                    <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">ยังไม่มีประวัติการซ่อมบำรุง</p>
                    <button
                      onClick={() => handleOpenMaintenanceModal(viewHistoryVehicle)}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      + บันทึกการซ่อมบำรุง
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Maintenance Summary Header */}
                    {(() => {
                      const totalMaintCost = (viewHistoryVehicle.maintenanceHistory || []).reduce((sum, item) => sum + (item.cost || 0), 0);
                      return (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex justify-between items-center mb-2 text-xs">
                          <span className="text-purple-300 font-bold">รวมค่าซ่อมบำรุงทั้งหมด:</span>
                          <strong className="text-sm font-mono font-extrabold text-white">฿{totalMaintCost.toLocaleString()}</strong>
                        </div>
                      );
                    })()}

                    {viewHistoryVehicle.maintenanceHistory.map((maint) => (
                      <div key={maint.id} className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-white text-sm block">{maint.title}</span>
                            <span className="text-[10px] text-purple-300 font-bold bg-purple-500/20 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {maint.category || "ทั่วไป"}
                            </span>
                          </div>
                          <strong className="font-mono text-sm font-bold text-purple-300">฿{maint.cost.toLocaleString()}</strong>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-mono">
                          <span>📅 {formatDateTh(maint.date)}</span>
                          <span>• มิเตอร์: {maint.mileage.toLocaleString()} km</span>
                          {maint.shopName ? <span>• ร้าน: {maint.shopName}</span> : null}
                        </div>

                        {maint.note && (
                          <p className="text-[11px] text-slate-400 pt-1 border-t border-white/5">
                            หมายเหตุ: {maint.note}
                          </p>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenMaintenanceModal(viewHistoryVehicle, maint)}
                            className="text-[10px] text-indigo-300 hover:text-indigo-200 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMaintenanceLog(viewHistoryVehicle.id, maint.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-white/5 hover:bg-rose-500/20 cursor-pointer"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. History Viewer Modal for AC */}
      {viewHistoryAc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col my-auto p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 shrink-0">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <History className="w-5 h-5 text-teal-400" />
                <span>ประวัติการล้างแอร์ ({viewHistoryAc.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewHistoryAc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {(!viewHistoryAc.history || viewHistoryAc.history.length === 0) ? (
                <p className="text-center text-xs text-slate-400 py-6">ยังไม่มีประวัติการล้างแอร์</p>
              ) : (
                viewHistoryAc.history.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-bold text-white">{formatDateTh(log.date)}</span>
                      {log.cost ? <strong className="font-bold text-teal-300">฿{log.cost.toLocaleString()}</strong> : null}
                    </div>
                    {(log.technician || log.note) && (
                      <div className="mt-1 pt-1 border-t border-white/5 flex justify-between text-slate-400 text-[11px]">
                        <span>{log.technician ? `ช่าง: ${log.technician}` : ""}</span>
                        <span>{log.note || ""}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
