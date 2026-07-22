import React, { useState, useMemo } from "react";
import { 
  UtilityBill, VehicleService, AcService, Wallet, Transaction, VehicleLog, AcLog 
} from "../types";
import { 
  Zap, Droplet, Car, Snowflake, Gauge, Calendar, Plus, Trash2, Edit3, 
  CheckCircle2, AlertTriangle, Clock, History, BarChart3, TrendingUp, TrendingDown,
  Wrench, ChevronRight, Calculator, FileText, Check, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, Layers
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
}

export default function ServiceAndUtilityManager({
  wallets,
  vehicles,
  acServices,
  utilityBills,
  onSaveVehicles,
  onSaveAcServices,
  onSaveUtilityBills,
  onAddTransaction
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

  const calcBaseCost = parseFloat(baseCost) || 0;
  const calcFtCost = parseFloat(ftCost) || 0;
  const calcServiceFee = parseFloat(serviceFee) || 0;
  const calcVatPercent = parseFloat(vatPercent) || 0;

  const calcSubtotal = calcBaseCost + calcFtCost + calcServiceFee;
  const calcVatAmount = Math.round((calcSubtotal * (calcVatPercent / 100)) * 100) / 100;
  const computedTotal = Math.round((calcSubtotal + calcVatAmount) * 100) / 100;

  const finalTotalAmount = manualTotal !== "" ? (parseFloat(manualTotal) || 0) : computedTotal;
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
  const [vehicleNote, setVehicleNote] = useState<string>("");

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
      note: vehicleNote,
      history: editingVehicleId ? (vehicles.find(v => v.id === editingVehicleId)?.history || []) : [
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
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Wrench className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                สาธารณูปโภค & บำรุงรักษา
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              บันทึกค่าน้ำ-ค่าไฟ อัตราต่อหน่วย ระบบเตือนถ่ายน้ำมันเครื่องรถ และกำหนดรอบล้างแอร์
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("utilities")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "utilities"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>ค่าน้ำ / ค่าไฟ</span>
              {utilityBills.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 text-white font-mono">
                  {utilityBills.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("vehicles")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "vehicles"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Car className="w-4 h-4 text-purple-400" />
              <span>ถ่ายน้ำมันเครื่องรถ</span>
              {vehicles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 text-white font-mono">
                  {vehicles.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("ac")}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "ac"
                  ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Snowflake className="w-4 h-4 text-cyan-400" />
              <span>รอบล้างแอร์</span>
              {acServices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 text-white font-mono">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                บันทึกบิลค่าน้ำและค่าไฟฟ้า
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                คำนวณยูนิต อัตราต่อหน่วย ค่า FT ค่าบริการ ภาษี 7% พร้อมดึงเลขมิเตอร์เดือนก่อนมาให้อัตโนมัติ
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenBillModal("electricity")}
                className="py-2 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Zap className="w-4 h-4 fill-amber-400/30 text-amber-400" />
                <span>+ บันทึกบิลค่าไฟ</span>
              </button>
              <button
                onClick={() => handleOpenBillModal("water")}
                className="py-2 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Droplet className="w-4 h-4 fill-cyan-400/30 text-cyan-400" />
                <span>+ บันทึกบิลค่าน้ำ</span>
              </button>
            </div>
          </div>

          {/* Yearly Trend Chart & Summary */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-white text-base">ภาพรวมการใช้น้ำ-ไฟ รายปี</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">เลือกปี:</span>
                <select
                  value={selectedUtilityYear}
                  onChange={(e) => setSelectedUtilityYear(parseInt(e.target.value))}
                  className="bg-slate-800 border border-white/20 text-white text-xs rounded-lg px-2.5 py-1 font-mono font-bold focus:outline-none focus:border-indigo-500"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>พ.ศ. {y + 543} ({y})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Cards for the selected year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900/80 p-4 rounded-xl border border-indigo-500/20">
                <span className="text-xs text-slate-400 block font-medium">รวมค่าน้ำ-ไฟ ทั้งปี ({selectedUtilityYear + 543})</span>
                <span className="text-2xl font-black text-white mt-1 block font-mono">
                  ฿{monthlyMatrix.totalYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-indigo-300/80 mt-1 block">
                  เฉลี่ยประมาณ ฿{monthlyMatrix.avgMonthly.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / เดือน
                </span>
              </div>

              <div className="bg-gradient-to-br from-amber-950/50 to-slate-900/80 p-4 rounded-xl border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-medium flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> ค่าไฟรวมทั้งปี
                  </span>
                </div>
                <span className="text-xl font-black text-amber-200 mt-1 block font-mono">
                  ฿{monthlyMatrix.totalElecYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-amber-300/70 mt-1 block">
                  {yearlyBills.filter(b => b.type === "electricity").reduce((sum, b) => sum + b.unitsUsed, 0).toLocaleString()} หน่วย
                </span>
              </div>

              <div className="bg-gradient-to-br from-cyan-950/50 to-slate-900/80 p-4 rounded-xl border border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cyan-300 font-medium flex items-center gap-1">
                    <Droplet className="w-3.5 h-3.5 text-cyan-400" /> ค่าน้ำรวมทั้งปี
                  </span>
                </div>
                <span className="text-xl font-black text-cyan-200 mt-1 block font-mono">
                  ฿{monthlyMatrix.totalWaterYear.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-cyan-300/70 mt-1 block">
                  {yearlyBills.filter(b => b.type === "water").reduce((sum, b) => sum + b.unitsUsed, 0).toLocaleString()} หน่วย
                </span>
              </div>
            </div>

            {/* Monthly Bar Chart */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-semibold block mb-2">กราฟเปรียบเทียบแต่ละเดือน (ม.ค. - ธ.ค.)</span>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 items-end h-40 bg-black/30 p-3 rounded-xl border border-white/5">
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

                      <div className="w-full max-w-[28px] bg-slate-800 rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:scale-105" style={{ height: `${heightPercent}%` }}>
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
                      <span className="text-[10px] text-slate-400 mt-1.5 font-medium">{m.monthName}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-2">
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
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
            <h4 className="font-bold text-white text-base mb-4 flex items-center justify-between">
              <span>ประวัติบิลค่าน้ำและค่าไฟที่บันทึกไว้</span>
              <span className="text-xs text-slate-400 font-normal">ทั้งหมด {sortedUtilityBills.length} บิล</span>
            </h4>

            {sortedUtilityBills.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-black/20">
                <Zap className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">ยังไม่มีประวัติการบันทึกบิลค่าน้ำ/ค่าไฟ</p>
                <p className="text-xs text-slate-500 mt-1">คลิกปุ่ม "+ บันทึกบิลค่าไฟ" หรือ "+ บันทึกบิลค่าน้ำ" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedUtilityBills.map((bill) => {
                  const isElec = bill.type === "electricity";
                  const comp = getBillPreviousMonthComparison(bill);

                  return (
                    <div 
                      key={bill.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        isElec 
                          ? "bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border-amber-500/20 hover:border-amber-500/40" 
                          : "bg-gradient-to-r from-cyan-950/20 via-slate-900 to-slate-900 border-cyan-500/20 hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Title & Date */}
                        <div className="flex items-start gap-3">
                          <span className={`p-2.5 rounded-xl border shrink-0 ${
                            isElec ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          }`}>
                            {isElec ? <Zap className="w-5 h-5" /> : <Droplet className="w-5 h-5" />}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-base text-white">
                                {isElec ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} ประจำเดือน {formatMonthTh(bill.billingMonth)}
                              </span>
                              {comp && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                  comp.diffAmount > 0 
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30" 
                                    : comp.diffAmount < 0 
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                                    : "bg-slate-800 text-slate-300 border-slate-700"
                                }`}>
                                  {comp.diffAmount > 0 ? (
                                    <>
                                      <ArrowUpRight className="w-3 h-3 text-rose-400" />
                                      <span>+{comp.diffAmount.toFixed(1)} ฿ (+{comp.diffPercent.toFixed(1)}%) จากเดือนก่อน</span>
                                    </>
                                  ) : comp.diffAmount < 0 ? (
                                    <>
                                      <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                                      <span>{comp.diffAmount.toFixed(1)} ฿ ({comp.diffPercent.toFixed(1)}%) จากเดือนก่อน</span>
                                    </>
                                  ) : (
                                    <span>เท่ากับเดือนก่อน</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                              <span>มิเตอร์: <strong className="text-white">{bill.startMeter.toLocaleString()}</strong> ➔ <strong className="text-white">{bill.endMeter.toLocaleString()}</strong></span>
                              <span className="text-slate-600">|</span>
                              <span>ใช้งาน: <strong className="text-sky-300">{bill.unitsUsed.toLocaleString()} หน่วย</strong></span>
                              <span className="text-slate-600">|</span>
                              <span>อัตรา: <strong className="text-emerald-300">{bill.ratePerUnit.toFixed(2)} ฿/หน่วย</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                          <div className="text-right">
                            <span className="text-xs text-slate-400 block font-medium">รวมทั้งสิ้น</span>
                            <span className="text-xl font-black text-white font-mono">
                              ฿{bill.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenBillModal(bill.type, bill)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                              title="แก้ไขบิล"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBill(bill.id)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                              title="ลบบิล"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Cost Breakdown Pills */}
                      <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 font-mono">
                        <div className="bg-black/30 p-1.5 px-2.5 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">ค่าไฟ/ค่าน้ำฐาน:</span>
                          <span className="font-bold text-white">฿{bill.baseCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-black/30 p-1.5 px-2.5 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">ค่า FT:</span>
                          <span className="font-bold text-amber-300">฿{bill.ftCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-black/30 p-1.5 px-2.5 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">ค่าบริการ:</span>
                          <span className="font-bold text-sky-300">฿{bill.serviceFee.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-black/30 p-1.5 px-2.5 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">VAT ({bill.vatPercent}%):</span>
                          <span className="font-bold text-purple-300">฿{bill.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-purple-400" />
                ระบบบันทึกเลขมิเตอร์รถ & ถ่ายน้ำมันเครื่อง
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
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

          {/* Vehicle Cards Grid */}
          {vehicles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-slate-900/40">
              <Car className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-300">ยังไม่มีข้อมูลยานพาหนะ</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
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

                return (
                  <div 
                    key={v.id} 
                    className={`bg-slate-900/90 border rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden transition-all shadow-xl ${
                      isOverdue 
                        ? "border-rose-500/50 shadow-rose-950/20" 
                        : isSoon 
                        ? "border-amber-500/50 shadow-amber-950/20" 
                        : "border-white/10"
                    }`}
                  >
                    {/* Top Status Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Car className="w-6 h-6" />
                        </span>
                        <div>
                          <h4 className="font-black text-lg text-white">{v.vehicleName}</h4>
                          {v.plateNumber && (
                            <span className="text-xs text-purple-300/80 font-mono font-medium block">
                              ทะเบียน: {v.plateNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isOverdue ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>ถึงเวลาถ่ายน้ำมันเครื่อง!</span>
                        </span>
                      ) : isSoon ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>ใกล้ถึงรอบกำหนด</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ระยะปกติ</span>
                        </span>
                      )}
                    </div>

                    {/* Mileage Box & Quick Update */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/10 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">เลขมิเตอร์ปัจจุบัน</span>
                          <span className="text-2xl font-black text-white font-mono tracking-tight">
                            {v.currentMileage.toLocaleString()} <span className="text-xs font-sans text-slate-400">km</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenMileageUpdate(v)}
                          className="py-1.5 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span>อัปเดตเลขมิเตอร์</span>
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-mono">
                          <span>ใช้ไปแล้ว {usedKm.toLocaleString()} / {v.intervalKm.toLocaleString()} km</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverdue ? "bg-rose-500" : isSoon ? "bg-amber-500" : "bg-gradient-to-r from-purple-500 to-indigo-500"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rules & Targets Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
                        <span className="text-slate-400 block text-[10px]">เป้าหมายถ่ายน้ำมันเครื่องครั้งถัดไป:</span>
                        <span className="font-bold text-purple-300 font-mono text-sm block mt-0.5">
                          {targetMileage.toLocaleString()} km
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          {remainingKm <= 0 ? (
                            <strong className="text-rose-400">เกินกำหนดไป {Math.abs(remainingKm).toLocaleString()} km</strong>
                          ) : (
                            <span>เหลืออีก <strong className="text-white">{remainingKm.toLocaleString()} km</strong></span>
                          )}
                        </span>
                      </div>

                      <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
                        <span className="text-slate-400 block text-[10px]">กำหนดวันที่ถ่ายถัดไป:</span>
                        <span className="font-bold text-indigo-300 font-mono text-xs block mt-0.5">
                          {formatDateTh(targetDateStr)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          {remainingDays <= 0 ? (
                            <strong className="text-rose-400">เลยกำหนดไป {Math.abs(remainingDays)} วัน</strong>
                          ) : (
                            <span>เหลืออีก <strong className="text-white">{remainingDays} วัน</strong></span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Service Info Summary */}
                    <div className="text-[11px] text-slate-400 bg-black/20 p-2.5 rounded-xl border border-white/5 mb-4 flex justify-between items-center">
                      <div>
                        <span>ถ่ายล่าสุด: <strong className="text-white">{formatDateTh(v.lastServiceDate)}</strong> ({v.lastServiceMileage.toLocaleString()} km)</span>
                        {v.lastServiceCost ? <span className="ml-2 font-mono text-emerald-300">฿{v.lastServiceCost.toLocaleString()}</span> : null}
                      </div>
                      <span className="text-purple-300/80 font-mono text-[10px]">รอบ: ทุก {v.intervalKm.toLocaleString()} km / {v.intervalMonths} เดือน</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewHistoryVehicle(v)}
                          className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-400" />
                          <span>ประวัติ</span>
                        </button>
                        <button
                          onClick={() => handleOpenVehicleModal(v)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="แก้ไขข้อมูลรถ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                          title="ลบรถ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenOilChangeLog(v)}
                        className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>บันทึกการถ่ายน้ำมันเครื่อง</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                {billType === "electricity" ? <Zap className="w-5 h-5 text-amber-400" /> : <Droplet className="w-5 h-5 text-cyan-400" />}
                <span>{editingBillId ? "แก้ไขบิล" : "บันทึกบิลใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBillModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
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
                <span className="text-xs font-bold text-slate-300 block">รายละเอียดค่าใช้จ่ายในบิล</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่าไฟ/ค่าน้ำฐาน (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={baseCost}
                      onChange={(e) => setBaseCost(e.target.value)}
                      placeholder="2175.01"
                      required
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่า FT (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={ftCost}
                      onChange={(e) => setFtCost(e.target.value)}
                      placeholder="88.13"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ค่าบริการ (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={serviceFee}
                      onChange={(e) => setServiceFee(e.target.value)}
                      placeholder="24.62"
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
                    <label className="block text-[11px] text-slate-400 mb-1">ยอดรวมเงิน (แก้ไขได้)</label>
                    <input
                      type="number"
                      step="any"
                      value={manualTotal}
                      onChange={(e) => setManualTotal(e.target.value)}
                      placeholder={`อัตโนมัติ: ${computedTotal}`}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-purple-400" />
                <span>{editingVehicleId ? "แก้ไขข้อมูลรถ" : "เพิ่มข้อมูลรถใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVehicleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <span>บันทึกถ่ายน้ำมันเครื่อง ({loggingVehicle.vehicleName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowOilChangeLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOilChangeLog} className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-cyan-400" />
                <span>{editingAcId ? "แก้ไขข้อมูลเครื่องปรับอากาศ" : "เพิ่มเครื่องปรับอากาศใหม่"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAcModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAc} className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-teal-400" />
                <span>บันทึกการล้างแอร์ ({loggingAc.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAcCleanLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAcCleanLog} className="space-y-4">
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

      {/* 7. History Viewer Modal for Vehicle */}
      {viewHistoryVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>ประวัติถ่ายน้ำมันเครื่อง ({viewHistoryVehicle.vehicleName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewHistoryVehicle(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(!viewHistoryVehicle.history || viewHistoryVehicle.history.length === 0) ? (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. History Viewer Modal for AC */}
      {viewHistoryAc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <History className="w-5 h-5 text-teal-400" />
                <span>ประวัติการล้างแอร์ ({viewHistoryAc.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewHistoryAc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
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
