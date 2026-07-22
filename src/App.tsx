import { useState, useEffect, useMemo } from "react";
import { Transaction, Wallet, Debt, DebtPayment, MonthlyGoal, VehicleService, AcService, UtilityBill } from "./types";
import SlipUploader from "./components/SlipUploader";
import TransactionForm from "./components/TransactionForm";
import DashboardStats from "./components/DashboardStats";
import AISummaryCard from "./components/AISummaryCard";
import HistoryList from "./components/HistoryList";
import WalletManager from "./components/WalletManager";
import DebtManager from "./components/DebtManager";
import LoginScreen from "./components/LoginScreen";
import SettingsScreen from "./components/SettingsScreen";
import LineSummarySender from "./components/LineSummarySender";
import MonthlyReport from "./components/MonthlyReport";
import ServiceAndUtilityManager from "./components/ServiceAndUtilityManager";
import { 
  Sparkles, Coins, HelpCircle, ArrowUpRight, Plus, ScanLine, 
  History, PieChart, Landmark, ArrowRightLeft, Settings, LogOut, CheckCircle, Wallet as WalletIcon, ShieldAlert,
  Keyboard, Monitor, X, FileSpreadsheet, Cloud, Shield, Wrench, Zap
} from "lucide-react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

// Operation types for custom Firestore error handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanObjectForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanObjectForFirestore(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export default function App() {
  // Automatically seed and register the user's LINE Channel Access Token
  useEffect(() => {
    const defaultToken = "X23l2VtlYP4mmCOlBtUTg/42Cww6u0PRwHwHu8uGDPkOAeXIgBHxHtiiyBhiMrlJF+abYCsPnPmTJoyU4f0MuivZIrdNeXbg5tPrMNaHglDYxEtfEuNxKK9ZRzRFRCZyGKB8ADa/sPplE9RvF0EFdwdB04t89/1O/w1cDnyilFU=";
    const currentToken = localStorage.getItem("app_line_channel_access_token");
    if (currentToken !== defaultToken) {
      localStorage.setItem("app_line_channel_access_token", defaultToken);
    }
    // Silently notify the server to register/cache this token in line_config.json
    fetch("/api/send-line-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelAccessToken: defaultToken, message: "", sendType: "broadcast" })
    }).catch(e => console.log("Silent seed error:", e));
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const sessionLoggedIn = sessionStorage.getItem("is_logged_in") === "true";
    const rememberDevice = localStorage.getItem("remember_device") === "true";
    const rememberedUser = localStorage.getItem("remembered_user");
    return sessionLoggedIn || (rememberDevice && !!rememberedUser);
  });
  
  const [currentUser, setCurrentUser] = useState<string>(() => {
    const sessionUser = sessionStorage.getItem("current_user") || "";
    const rememberDevice = localStorage.getItem("remember_device") === "true";
    const rememberedUser = localStorage.getItem("remembered_user") || "";
    return sessionUser || (rememberDevice ? rememberedUser : "");
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("app_theme") as "dark" | "light") || "dark";
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem("app_accent_color") || "indigo";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(`theme-${theme}`);
    
    const accents = ["accent-indigo", "accent-emerald", "accent-teal", "accent-rose", "accent-violet", "accent-amber"];
    accents.forEach(cls => root.classList.remove(cls));
    root.classList.add(`accent-${accentColor}`);
  }, [theme, accentColor]);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [vehicles, setVehicles] = useState<VehicleService[]>([]);
  const [acServices, setAcServices] = useState<AcService[]>([]);
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("manual");
  const [currentPage, setCurrentPage] = useState<"dashboard" | "records" | "wallets" | "settings" | "debts" | "report" | "services">("dashboard");
  
  // Dynamically calculate balances of each wallet
  const walletBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    wallets.forEach((w) => {
      balances[w.id] = w.initialBalance;
    });

    transactions.forEach((tx) => {
      const amount = tx.amount;
      if (tx.type === "income") {
        if (balances[tx.walletId] !== undefined) {
          balances[tx.walletId] += amount;
        }
      } else if (tx.type === "expense") {
        if (balances[tx.walletId] !== undefined) {
          balances[tx.walletId] -= amount;
        }
      } else if (tx.type === "transfer") {
        if (tx.walletId && balances[tx.walletId] !== undefined) {
          balances[tx.walletId] -= amount;
        }
        if (tx.toWalletId && balances[tx.toWalletId] !== undefined) {
          balances[tx.toWalletId] += amount;
        }
      }
    });
    return balances;
  }, [wallets, transactions]);

  // Extract unique merchant and sender names from previous transactions for search autocompletion
  const expenseHistoryNames = useMemo(() => {
    const names = transactions
      .filter((tx) => tx.type === "expense")
      .map((tx) => tx.merchantName)
      .filter((name) => name && name.trim() !== "" && !name.startsWith("โอนเงินจาก "));
    return Array.from(new Set(names));
  }, [transactions]);

  const incomeHistoryNames = useMemo(() => {
    const names = transactions
      .filter((tx) => tx.type === "income")
      .map((tx) => tx.merchantName)
      .filter((name) => name && name.trim() !== "" && !name.startsWith("โอนเงินจาก "));
    return Array.from(new Set(names));
  }, [transactions]);
  
  // Scanned data ready for user review/confirmation
  const [pendingReviewData, setPendingReviewData] = useState<Partial<Transaction> | null>(null);
  
  // Edit mode target transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Connection status states
  const [firebaseStatus, setFirebaseStatus] = useState<{
    status: "connecting" | "connected" | "error";
    error: string | null;
  }>({ status: "connecting", error: null });
  const [showFirebaseErrorDetail, setShowFirebaseErrorDetail] = useState<boolean>(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);

  // Helper to sync batch of transactions to Firestore under user-isolated subcollection
  const syncTransactionsToFirestore = async (txs: Transaction[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const tx of txs) {
        await setDoc(doc(db, "users", userDocId, "transactions", tx.id), cleanObjectForFirestore(tx));
      }
    } catch (err) {
      console.error("Error syncing transactions to Firestore:", err);
    }
  };

  // Helper to sync wallets to Firestore under user-isolated subcollection
  const syncWalletsToFirestore = async (wts: Wallet[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const w of wts) {
        await setDoc(doc(db, "users", userDocId, "wallets", w.id), cleanObjectForFirestore(w));
      }
    } catch (err) {
      console.error("Error syncing wallets to Firestore:", err);
    }
  };

  const saveWallets = (newWallets: Wallet[]) => {
    setWallets(newWallets);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_wallets_${userDocId}`, JSON.stringify(newWallets));
    } else {
      localStorage.setItem("money_tracker_wallets", JSON.stringify(newWallets));
    }
  };

  // Helper to sync debts to Firestore
  const syncDebtsToFirestore = async (dts: Debt[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const d of dts) {
        await setDoc(doc(db, "users", userDocId, "debts", d.id), cleanObjectForFirestore(d));
      }
    } catch (err) {
      console.error("Error syncing debts to Firestore:", err);
    }
  };

  // Helper to sync debt payments to Firestore
  const syncDebtPaymentsToFirestore = async (payments: DebtPayment[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const p of payments) {
        await setDoc(doc(db, "users", userDocId, "debt_payments", p.id), cleanObjectForFirestore(p));
      }
    } catch (err) {
      console.error("Error syncing debt payments to Firestore:", err);
    }
  };

  // Helper to sync monthly goals to Firestore
  const syncMonthlyGoalsToFirestore = async (goals: MonthlyGoal[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const g of goals) {
        await setDoc(doc(db, "users", userDocId, "monthly_goals", g.id), cleanObjectForFirestore(g));
      }
    } catch (err) {
      console.error("Error syncing monthly goals to Firestore:", err);
    }
  };

  const handleAddOrUpdateMonthlyGoal = async (month: string, amount: number) => {
    const goalId = `goal-${month}`;
    const newGoal: MonthlyGoal = {
      id: goalId,
      month,
      amount,
      createdAt: new Date().toISOString()
    };
    
    const updatedGoals = [...monthlyGoals.filter(g => g.id !== goalId), newGoal];
    setMonthlyGoals(updatedGoals);
    
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_monthly_goals_${userDocId}`, JSON.stringify(updatedGoals));
      
      try {
        await setDoc(doc(db, "users", userDocId, "monthly_goals", goalId), cleanObjectForFirestore(newGoal));
      } catch (err) {
        console.error("Failed to save monthly goal to Firestore:", err);
      }
    } else {
      localStorage.setItem("money_tracker_monthly_goals", JSON.stringify(updatedGoals));
    }
  };

  const saveDebts = (newDebts: Debt[]) => {
    setDebts(newDebts);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_debts_${userDocId}`, JSON.stringify(newDebts));
    }
  };

  const saveDebtPayments = (newPayments: DebtPayment[]) => {
    setDebtPayments(newPayments);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_debt_payments_${userDocId}`, JSON.stringify(newPayments));
    }
  };

  const saveVehicles = async (newVehicles: VehicleService[]) => {
    const deletedVehicles = vehicles.filter(v => !newVehicles.some(nv => nv.id === v.id));
    setVehicles(newVehicles);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_vehicles_${userDocId}`, JSON.stringify(newVehicles));
      try {
        for (const v of newVehicles) {
          await setDoc(doc(db, "users", userDocId, "vehicles", v.id), cleanObjectForFirestore(v));
        }
        for (const dv of deletedVehicles) {
          await deleteDoc(doc(db, "users", userDocId, "vehicles", dv.id));
        }
      } catch (err) {
        console.error("Error saving vehicles to Firestore:", err);
      }
    } else {
      localStorage.setItem("money_tracker_vehicles", JSON.stringify(newVehicles));
    }
  };

  const saveAcServices = async (newAcServices: AcService[]) => {
    const deletedAc = acServices.filter(a => !newAcServices.some(na => na.id === a.id));
    setAcServices(newAcServices);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_ac_services_${userDocId}`, JSON.stringify(newAcServices));
      try {
        for (const a of newAcServices) {
          await setDoc(doc(db, "users", userDocId, "ac_services", a.id), cleanObjectForFirestore(a));
        }
        for (const da of deletedAc) {
          await deleteDoc(doc(db, "users", userDocId, "ac_services", da.id));
        }
      } catch (err) {
        console.error("Error saving AC services to Firestore:", err);
      }
    } else {
      localStorage.setItem("money_tracker_ac_services", JSON.stringify(newAcServices));
    }
  };

  const saveUtilityBills = async (newBills: UtilityBill[]) => {
    const deletedBills = utilityBills.filter(b => !newBills.some(nb => nb.id === b.id));
    setUtilityBills(newBills);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_utility_bills_${userDocId}`, JSON.stringify(newBills));
      try {
        for (const b of newBills) {
          await setDoc(doc(db, "users", userDocId, "utility_bills", b.id), cleanObjectForFirestore(b));
        }
        for (const dbill of deletedBills) {
          await deleteDoc(doc(db, "users", userDocId, "utility_bills", dbill.id));
        }
      } catch (err) {
        console.error("Error saving utility bills to Firestore:", err);
      }
    } else {
      localStorage.setItem("money_tracker_utility_bills", JSON.stringify(newBills));
    }
  };

  const createDefaultWallets = () => {
    const defaultWts: Wallet[] = [
      {
        id: "w-cash-" + Date.now(),
        name: "เงินสด",
        type: "cash",
        initialBalance: 0,
        icon: "💵",
        color: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border-indigo-400/20",
        createdAt: new Date().toISOString()
      },
      {
        id: "w-bank-" + (Date.now() + 1),
        name: "บัญชีธนาคาร",
        type: "bank",
        initialBalance: 0,
        icon: "🏦",
        color: "bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border-emerald-400/20",
        createdAt: new Date().toISOString()
      },
      {
        id: "w-saving-" + (Date.now() + 2),
        name: "กระปุกออมสิน",
        type: "saving",
        initialBalance: 0,
        icon: "🐷",
        color: "bg-gradient-to-br from-pink-500 via-rose-600 to-red-700 border-pink-400/20",
        createdAt: new Date().toISOString()
      }
    ];
    saveWallets(defaultWts);
    syncWalletsToFirestore(defaultWts);
  };

  // Listen for keyboard shortcuts (PC Desktop optimization)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in input or editable elements, ignore shortcuts
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      // Alt + Number, or simply 1-5 keys
      if (e.altKey) {
        if (e.key === "1") { e.preventDefault(); setCurrentPage("dashboard"); }
        else if (e.key === "2") { e.preventDefault(); setCurrentPage("records"); }
        else if (e.key === "3") { e.preventDefault(); setCurrentPage("wallets"); }
        else if (e.key === "4") { e.preventDefault(); setCurrentPage("debts"); }
        else if (e.key === "5") { e.preventDefault(); setCurrentPage("settings"); }
        else if (e.key === "?") { e.preventDefault(); setShowShortcutsHelp(prev => !prev); }
      } else {
        if (e.key === "1") { setCurrentPage("dashboard"); }
        else if (e.key === "2") { setCurrentPage("records"); }
        else if (e.key === "3") { setCurrentPage("wallets"); }
        else if (e.key === "4") { setCurrentPage("debts"); }
        else if (e.key === "5") { setCurrentPage("settings"); }
        else if (e.key === "?" || e.key === "h" || e.key === "H") { setShowShortcutsHelp(prev => !prev); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load transactions and wallets from Firestore with local storage fallback
  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn || !currentUser) return;
      
      const userDocId = currentUser.toLowerCase().trim();
      let walletLoadSuccess = false;
      let transactionLoadSuccess = false;
      let walletsData: Wallet[] = [];

      const sortWalletsList = (list: Wallet[]) => {
        return [...list].sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? a.sortOrder : 9999;
          const orderB = b.sortOrder !== undefined ? b.sortOrder : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return b.createdAt.localeCompare(a.createdAt);
        });
      };

      // 1. Load Wallets first so transactions can link correctly
      try {
        const walletsColRef = collection(db, "users", userDocId, "wallets");
        const walletsSnapshot = await getDocs(walletsColRef);
        
        walletsSnapshot.forEach((doc) => {
          walletsData.push(doc.data() as Wallet);
        });
        walletLoadSuccess = true;
      } catch (err) {
        console.error("Failed to load wallets from Firestore:", err);
        walletLoadSuccess = false;
      }

      if (walletLoadSuccess) {
        if (walletsData.length > 0) {
          const sorted = sortWalletsList(walletsData);
          setWallets(sorted);
          localStorage.setItem(`money_tracker_wallets_${userDocId}`, JSON.stringify(sorted));
        } else {
          const savedWallets = localStorage.getItem(`money_tracker_wallets_${userDocId}`);
          if (savedWallets) {
            try {
              const parsed = JSON.parse(savedWallets);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const sorted = sortWalletsList(parsed);
                setWallets(sorted);
                syncWalletsToFirestore(sorted);
              } else {
                createDefaultWallets();
              }
            } catch (e) {
              createDefaultWallets();
            }
          } else {
            createDefaultWallets();
          }
        }
      } else {
        // Fallback to local storage for this specific user
        const savedWallets = localStorage.getItem(`money_tracker_wallets_${userDocId}`);
        if (savedWallets) {
          try {
            const sorted = sortWalletsList(JSON.parse(savedWallets));
            setWallets(sorted);
          } catch (e) {
            createDefaultWallets();
          }
        } else {
          createDefaultWallets();
        }
      }

      // 2. Load Transactions
      let txs: Transaction[] = [];
      try {
        const colRef = collection(db, "users", userDocId, "transactions");
        const snapshot = await getDocs(colRef);
        
        snapshot.forEach((doc) => {
          txs.push(doc.data() as Transaction);
        });
        transactionLoadSuccess = true;
      } catch (error) {
        console.error("Failed to load transactions from Firestore, falling back to localStorage:", error);
        transactionLoadSuccess = false;
      }

      // 3. Load Debts
      let debtsList: Debt[] = [];
      let debtLoadSuccess = false;
      try {
        const debtsColRef = collection(db, "users", userDocId, "debts");
        const debtsSnapshot = await getDocs(debtsColRef);
        debtsSnapshot.forEach((doc) => {
          debtsList.push(doc.data() as Debt);
        });
        debtLoadSuccess = true;
      } catch (err) {
        console.error("Failed to load debts from Firestore:", err);
        debtLoadSuccess = false;
      }

      if (debtLoadSuccess) {
        setDebts(debtsList);
        localStorage.setItem(`money_tracker_debts_${userDocId}`, JSON.stringify(debtsList));
      } else {
        const savedDebts = localStorage.getItem(`money_tracker_debts_${userDocId}`);
        if (savedDebts) {
          try {
            setDebts(JSON.parse(savedDebts));
          } catch (e) {
            setDebts([]);
          }
        }
      }

      // 4. Load Debt Payments
      let paymentsList: DebtPayment[] = [];
      let paymentLoadSuccess = false;
      try {
        const paymentsColRef = collection(db, "users", userDocId, "debt_payments");
        const paymentsSnapshot = await getDocs(paymentsColRef);
        paymentsSnapshot.forEach((doc) => {
          paymentsList.push(doc.data() as DebtPayment);
        });
        paymentLoadSuccess = true;
      } catch (err) {
        console.error("Failed to load debt payments from Firestore:", err);
        paymentLoadSuccess = false;
      }

      if (paymentLoadSuccess) {
        setDebtPayments(paymentsList);
        localStorage.setItem(`money_tracker_debt_payments_${userDocId}`, JSON.stringify(paymentsList));
      } else {
        const savedPayments = localStorage.getItem(`money_tracker_debt_payments_${userDocId}`);
        if (savedPayments) {
          try {
            setDebtPayments(JSON.parse(savedPayments));
          } catch (e) {
            setDebtPayments([]);
          }
        }
      }

      // 5. Load Monthly Goals
      let monthlyGoalsList: MonthlyGoal[] = [];
      let monthlyGoalLoadSuccess = false;
      try {
        const monthlyGoalsColRef = collection(db, "users", userDocId, "monthly_goals");
        const monthlyGoalsSnapshot = await getDocs(monthlyGoalsColRef);
        monthlyGoalsSnapshot.forEach((doc) => {
          monthlyGoalsList.push(doc.data() as MonthlyGoal);
        });
        monthlyGoalLoadSuccess = true;
      } catch (err) {
        console.error("Failed to load monthly goals from Firestore:", err);
        monthlyGoalLoadSuccess = false;
      }

      if (monthlyGoalLoadSuccess) {
        setMonthlyGoals(monthlyGoalsList);
        localStorage.setItem(`money_tracker_monthly_goals_${userDocId}`, JSON.stringify(monthlyGoalsList));
      } else {
        const savedMonthlyGoals = localStorage.getItem(`money_tracker_monthly_goals_${userDocId}`);
        if (savedMonthlyGoals) {
          try {
            setMonthlyGoals(JSON.parse(savedMonthlyGoals));
          } catch (e) {
            setMonthlyGoals([]);
          }
        }
      }

      // 6. Load Vehicles
      try {
        const vehColRef = collection(db, "users", userDocId, "vehicles");
        const vehSnapshot = await getDocs(vehColRef);
        const vehList: VehicleService[] = [];
        vehSnapshot.forEach((doc) => {
          vehList.push(doc.data() as VehicleService);
        });
        setVehicles(vehList);
        localStorage.setItem(`money_tracker_vehicles_${userDocId}`, JSON.stringify(vehList));
      } catch (err) {
        const saved = localStorage.getItem(`money_tracker_vehicles_${userDocId}`);
        if (saved) {
          try { setVehicles(JSON.parse(saved)); } catch (e) { setVehicles([]); }
        }
      }

      // 7. Load AC Services
      try {
        const acColRef = collection(db, "users", userDocId, "ac_services");
        const acSnapshot = await getDocs(acColRef);
        const acList: AcService[] = [];
        acSnapshot.forEach((doc) => {
          acList.push(doc.data() as AcService);
        });
        setAcServices(acList);
        localStorage.setItem(`money_tracker_ac_services_${userDocId}`, JSON.stringify(acList));
      } catch (err) {
        const saved = localStorage.getItem(`money_tracker_ac_services_${userDocId}`);
        if (saved) {
          try { setAcServices(JSON.parse(saved)); } catch (e) { setAcServices([]); }
        }
      }

      // 8. Load Utility Bills
      try {
        const billColRef = collection(db, "users", userDocId, "utility_bills");
        const billSnapshot = await getDocs(billColRef);
        const billList: UtilityBill[] = [];
        billSnapshot.forEach((doc) => {
          billList.push(doc.data() as UtilityBill);
        });
        setUtilityBills(billList);
        localStorage.setItem(`money_tracker_utility_bills_${userDocId}`, JSON.stringify(billList));
      } catch (err) {
        const saved = localStorage.getItem(`money_tracker_utility_bills_${userDocId}`);
        if (saved) {
          try { setUtilityBills(JSON.parse(saved)); } catch (e) { setUtilityBills([]); }
        }
      }

      // Set global Firestore status based on loading success
      if (walletLoadSuccess && transactionLoadSuccess) {
        setFirebaseStatus({ status: "connected", error: null });
      } else {
        const errorsList: string[] = [];
        if (!walletLoadSuccess) errorsList.push("ไม่สามารถดึงข้อมูลกระเป๋าตังจาก Firestore ได้");
        if (!transactionLoadSuccess) errorsList.push("ไม่สามารถดึงข้อมูลธุรกรรมจาก Firestore ได้");
        setFirebaseStatus({ 
          status: "error", 
          error: errorsList.join(" และ ") + ". ระบบเปิดใช้งานหมวดออฟไลน์ (Offline Mode) อัตโนมัติ" 
        });
      }

      if (transactionLoadSuccess) {
        txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTransactions(txs);
        localStorage.setItem(`money_tracker_transactions_${userDocId}`, JSON.stringify(txs));
        return;
      }

      const saved = localStorage.getItem(`money_tracker_transactions_${userDocId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTransactions(parsed);
            syncTransactionsToFirestore(parsed);
            return;
          }
        } catch (e) {
          console.error("Failed to parse saved transactions");
        }
      }

      // Use real data only: set an empty list if no transactions exist. No mock fallbacks!
      setTransactions([]);
      localStorage.setItem(`money_tracker_transactions_${userDocId}`, JSON.stringify([]));
    }

    loadData();
  }, [isLoggedIn, currentUser]);

  // Initialize selectedMonth with the latest transaction month, or current month
  useEffect(() => {
    if (transactions.length > 0) {
      const months = (Array.from(
        new Set(transactions.map((tx) => tx.date.substring(0, 7)))
      ) as string[]).sort((a, b) => b.localeCompare(a)); // Newest first

      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0]);
      }
    } else {
      const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
      setSelectedMonth(currentMonthStr);
    }
  }, [transactions, selectedMonth]);

  // Save to localStorage and state
  const saveTransactions = (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
    if (currentUser) {
      const userDocId = currentUser.toLowerCase().trim();
      localStorage.setItem(`money_tracker_transactions_${userDocId}`, JSON.stringify(newTransactions));
    } else {
      localStorage.setItem("money_tracker_transactions", JSON.stringify(newTransactions));
    }
  };

  // Create a list of available months from transactions
  const availableMonths = (Array.from(
    new Set(transactions.map((tx) => tx.date.substring(0, 7)))
  ) as string[]).sort((a, b) => b.localeCompare(a));

  // If the currently selected month is not in availableMonths (e.g. all deleted), add it
  if (selectedMonth && !availableMonths.includes(selectedMonth)) {
    availableMonths.unshift(selectedMonth);
    availableMonths.sort((a, b) => b.localeCompare(a));
  }

  // Filter transactions for the selected month
  const monthlyTransactions = transactions.filter(
    (tx) => tx.date.substring(0, 7) === selectedMonth
  );

  // Find excluded wallet IDs
  const excludedWalletIds = new Set(
    wallets.filter((w) => w.excludeFromTotal).map((w) => w.id)
  );

  // Brought forward balance calculations with excludeFromTotal support
  const startingBalanceSum = wallets.reduce((sum, w) => {
    if (w.excludeFromTotal) return sum;
    return sum + w.initialBalance;
  }, 0);

  const previousTransactions = transactions.filter((tx) => tx.date.substring(0, 7) < selectedMonth);
  
  const previousIncomes = previousTransactions.reduce((sum, tx) => {
    if (tx.type === "income") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      // Transfer from excluded to main = income to main
      if (isSrcExcluded && !isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  const previousExpenses = previousTransactions.reduce((sum, tx) => {
    if (tx.type === "expense") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      // Transfer from main to excluded = expense to main
      if (!isSrcExcluded && isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  const broughtForward = startingBalanceSum + previousIncomes - previousExpenses;

  // Calculations for current selected month (with excludeFromTotal support)
  const totalIncome = monthlyTransactions.reduce((sum, tx) => {
    if (tx.type === "income") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      // Transfer from excluded to main = income to main
      if (isSrcExcluded && !isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  const totalExpense = monthlyTransactions.reduce((sum, tx) => {
    if (tx.type === "expense") {
      const isExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      if (!isExcluded) return sum + tx.amount;
    } else if (tx.type === "transfer") {
      const isSrcExcluded = tx.walletId ? excludedWalletIds.has(tx.walletId) : false;
      const isDstExcluded = tx.toWalletId ? excludedWalletIds.has(tx.toWalletId) : false;
      // Transfer from main to excluded = expense to main
      if (!isSrcExcluded && isDstExcluded) return sum + tx.amount;
    }
    return sum;
  }, 0);

  // Add new transaction
  const handleAddTransaction = async (data: Omit<Transaction, "id" | "createdAt">) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    const newTx: Transaction = {
      ...data,
      id: "tx-" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newTx, ...transactions];
    saveTransactions(updated);

    try {
      await setDoc(doc(db, "users", userDocId, "transactions", newTx.id), cleanObjectForFirestore(newTx));
    } catch (err) {
      console.error("Error saving transaction to Firestore:", err);
    }

    // Auto-repay/adjust debt if linked
    if (newTx.debtId) {
      const targetDebt = debts.find((d) => d.id === newTx.debtId);
      if (targetDebt) {
        const paidAmount = newTx.amount;
        const newRemaining = Math.max(0, targetDebt.remainingAmount - paidAmount);
        const isPaid = newRemaining <= 0;
        const updatedDebt: Debt = {
          ...targetDebt,
          remainingAmount: newRemaining,
          status: isPaid ? "paid" : "active",
        };

        const updatedDebts = debts.map((d) => (d.id === targetDebt.id ? updatedDebt : d));
        saveDebts(updatedDebts);
        try {
          await setDoc(doc(db, "users", userDocId, "debts", targetDebt.id), cleanObjectForFirestore(updatedDebt));
        } catch (err) {
          console.error("Error updating debt status from transaction:", err);
        }

        // Create DebtPayment record for full ledger sync
        const payment: DebtPayment = {
          id: "pay-tx-" + Date.now(),
          debtId: newTx.debtId,
          amount: paidAmount,
          walletId: newTx.walletId || "",
          date: newTx.date,
          note: newTx.note || `ชำระหนี้ผ่านรายการบันทึก: ${targetDebt.creditorDebtorName}`,
          createdAt: new Date().toISOString(),
        };

        const updatedPayments = [payment, ...debtPayments];
        saveDebtPayments(updatedPayments);
        try {
          await setDoc(doc(db, "users", userDocId, "debt_payments", payment.id), cleanObjectForFirestore(payment));
        } catch (err) {
          console.error("Error saving debt payment from transaction:", err);
        }
      }
    }
    
    // If transaction added belongs to a different month, switch to that month
    const addedMonth = data.date.substring(0, 7);
    if (addedMonth !== selectedMonth) {
      setSelectedMonth(addedMonth);
    }

    // Reset pending states and focus list/history
    setPendingReviewData(null);
  };

  // Update existing transaction
  const handleUpdateTransaction = async (data: Omit<Transaction, "id" | "createdAt">) => {
    if (!editingTransaction || !currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    const updatedTx: Transaction = {
      ...editingTransaction,
      ...data,
    };

    const updated = transactions.map((tx) => {
      if (tx.id === editingTransaction.id) {
        return updatedTx;
      }
      return tx;
    });

    saveTransactions(updated);

    try {
      await setDoc(doc(db, "users", userDocId, "transactions", editingTransaction.id), cleanObjectForFirestore(updatedTx));
    } catch (err) {
      console.error("Error updating transaction in Firestore:", err);
    }

    // Debt adjustment on transaction update
    if (updatedTx.debtId || editingTransaction.debtId) {
      const oldDebtId = editingTransaction.debtId;
      const newDebtId = updatedTx.debtId;
      const oldAmount = editingTransaction.amount;
      const newAmount = updatedTx.amount;

      // Case 1: Unlinked debt or changed debt entirely
      if (oldDebtId !== newDebtId) {
        // Revert old debt if there was one
        if (oldDebtId) {
          const oldDebt = debts.find(d => d.id === oldDebtId);
          if (oldDebt) {
            const revertedRemaining = oldDebt.remainingAmount + oldAmount;
            const updatedOldDebt: Debt = {
              ...oldDebt,
              remainingAmount: revertedRemaining,
              status: revertedRemaining > 0 ? "active" : "paid",
            };
            const updatedDebtsList = debts.map(d => d.id === oldDebtId ? updatedOldDebt : d);
            saveDebts(updatedDebtsList);
            try {
              await setDoc(doc(db, "users", userDocId, "debts", oldDebtId), cleanObjectForFirestore(updatedOldDebt));
            } catch (err) {
              console.error(err);
            }
            // Delete old payment if any
            const paymentToDelete = debtPayments.find(p => p.debtId === oldDebtId && p.amount === oldAmount);
            if (paymentToDelete) {
              const updatedPaymentsList = debtPayments.filter(p => p.id !== paymentToDelete.id);
              saveDebtPayments(updatedPaymentsList);
              try {
                await deleteDoc(doc(db, "users", userDocId, "debt_payments", paymentToDelete.id));
              } catch (e) {}
            }
          }
        }

        // Apply new debt if there is one
        if (newDebtId) {
          const newDebt = debts.find(d => d.id === newDebtId);
          if (newDebt) {
            const newRemaining = Math.max(0, newDebt.remainingAmount - newAmount);
            const updatedNewDebt: Debt = {
              ...newDebt,
              remainingAmount: newRemaining,
              status: newRemaining <= 0 ? "paid" : "active",
            };
            const updatedDebtsList = debts.map(d => d.id === newDebtId ? updatedNewDebt : d);
            saveDebts(updatedDebtsList);
            try {
              await setDoc(doc(db, "users", userDocId, "debts", newDebtId), cleanObjectForFirestore(updatedNewDebt));
            } catch (err) {}

            // Create new payment record
            const payment: DebtPayment = {
              id: "pay-tx-" + Date.now(),
              debtId: newDebtId,
              amount: newAmount,
              walletId: updatedTx.walletId || "",
              date: updatedTx.date,
              note: updatedTx.note || `ชำระหนี้ผ่านรายการแก้ไข: ${newDebt.creditorDebtorName}`,
              createdAt: new Date().toISOString(),
            };
            const updatedPaymentsList = [payment, ...debtPayments];
            saveDebtPayments(updatedPaymentsList);
            try {
              await setDoc(doc(db, "users", userDocId, "debt_payments", payment.id), cleanObjectForFirestore(payment));
            } catch (e) {}
          }
        }
      } else if (newDebtId && oldAmount !== newAmount) {
        // Case 2: Same debt, but amount changed
        const targetDebt = debts.find(d => d.id === newDebtId);
        if (targetDebt) {
          const difference = newAmount - oldAmount;
          const newRemaining = Math.max(0, targetDebt.remainingAmount - difference);
          const updatedDebt: Debt = {
            ...targetDebt,
            remainingAmount: newRemaining,
            status: newRemaining <= 0 ? "paid" : "active",
          };
          const updatedDebtsList = debts.map(d => d.id === newDebtId ? updatedDebt : d);
          saveDebts(updatedDebtsList);
          try {
            await setDoc(doc(db, "users", userDocId, "debts", newDebtId), cleanObjectForFirestore(updatedDebt));
          } catch (err) {}

          // Update corresponding payment if exists
          const paymentToUpdate = debtPayments.find(p => p.debtId === newDebtId && p.amount === oldAmount);
          if (paymentToUpdate) {
            const updatedPayment: DebtPayment = {
              ...paymentToUpdate,
              amount: newAmount,
              walletId: updatedTx.walletId || "",
              date: updatedTx.date,
            };
            const updatedPaymentsList = debtPayments.map(p => p.id === paymentToUpdate.id ? updatedPayment : p);
            saveDebtPayments(updatedPaymentsList);
            try {
              await setDoc(doc(db, "users", userDocId, "debt_payments", paymentToUpdate.id), cleanObjectForFirestore(updatedPayment));
            } catch (e) {}
          }
        }
      }
    }

    setEditingTransaction(null);
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    // Revert debt if transaction was linked to a debt
    const txToDelete = transactions.find((tx) => tx.id === id);
    if (txToDelete && txToDelete.debtId) {
      const targetDebt = debts.find((d) => d.id === txToDelete.debtId);
      if (targetDebt) {
        const revertedRemaining = targetDebt.remainingAmount + txToDelete.amount;
        const updatedDebt: Debt = {
          ...targetDebt,
          remainingAmount: revertedRemaining,
          status: revertedRemaining > 0 ? "active" : "paid",
        };
        const updatedDebts = debts.map((d) => (d.id === targetDebt.id ? updatedDebt : d));
        saveDebts(updatedDebts);
        try {
          await setDoc(doc(db, "users", userDocId, "debts", targetDebt.id), cleanObjectForFirestore(updatedDebt));
        } catch (err) {
          console.error("Error reverting debt on transaction deletion:", err);
        }

        // Delete the corresponding payment
        const paymentToDelete = debtPayments.find(p => p.debtId === txToDelete.debtId && p.amount === txToDelete.amount);
        if (paymentToDelete) {
          const updatedPayments = debtPayments.filter(p => p.id !== paymentToDelete.id);
          saveDebtPayments(updatedPayments);
          try {
            await deleteDoc(doc(db, "users", userDocId, "debt_payments", paymentToDelete.id));
          } catch (e) {}
        }
      }
    }

    const updated = transactions.filter((tx) => tx.id !== id);
    saveTransactions(updated);

    try {
      await deleteDoc(doc(db, "users", userDocId, "transactions", id));
    } catch (err) {
      console.error("Error deleting transaction from Firestore:", err);
    }
  };

  // Wallet CRUD Actions
  const handleAddWallet = async (data: Omit<Wallet, "id" | "createdAt">) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    
    let isDefaultVal = data.isDefault;
    if (wallets.length === 0) {
      isDefaultVal = true;
    }

    const newW: Wallet = {
      ...data,
      isDefault: isDefaultVal,
      sortOrder: data.sortOrder !== undefined ? data.sortOrder : wallets.length,
      id: "w-" + Date.now(),
      createdAt: new Date().toISOString(),
    };

    let updated = [newW, ...wallets];
    if (newW.isDefault) {
      updated = updated.map((w) => w.id === newW.id ? w : { ...w, isDefault: false });
    }

    saveWallets(updated);

    try {
      if (newW.isDefault) {
        for (const w of updated) {
          await setDoc(doc(db, "users", userDocId, "wallets", w.id), cleanObjectForFirestore(w));
        }
      } else {
        await setDoc(doc(db, "users", userDocId, "wallets", newW.id), cleanObjectForFirestore(newW));
      }
    } catch (err) {
      console.error("Error saving wallet to Firestore:", err);
    }
  };

  const handleUpdateWallet = async (id: string, data: Omit<Wallet, "id" | "createdAt">) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    const current = wallets.find(w => w.id === id);
    if (!current) return;
    
    const updatedW: Wallet = {
      ...current,
      ...data,
    };

    let updated = wallets.map((w) => (w.id === id ? updatedW : w));
    if (updatedW.isDefault) {
      updated = updated.map((w) => w.id === id ? w : { ...w, isDefault: false });
    }

    saveWallets(updated);

    try {
      if (updatedW.isDefault) {
        for (const w of updated) {
          await setDoc(doc(db, "users", userDocId, "wallets", w.id), cleanObjectForFirestore(w));
        }
      } else {
        await setDoc(doc(db, "users", userDocId, "wallets", id), cleanObjectForFirestore(updatedW));
      }
    } catch (err) {
      console.error("Error updating wallet in Firestore:", err);
    }
  };

  const handleReorderWallets = async (newWallets: Wallet[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    
    const reordered = newWallets.map((w, index) => ({
      ...w,
      sortOrder: index,
    }));

    saveWallets(reordered);

    try {
      for (const w of reordered) {
        await setDoc(doc(db, "users", userDocId, "wallets", w.id), cleanObjectForFirestore(w));
      }
    } catch (err) {
      console.error("Error reordering wallets in Firestore:", err);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    const updated = wallets.filter((w) => w.id !== id);
    saveWallets(updated);

    try {
      await deleteDoc(doc(db, "users", userDocId, "wallets", id));
    } catch (err) {
      console.error("Error deleting wallet from Firestore:", err);
    }
  };

  // Debt Actions
  const handleAddDebt = async (debt: Debt, initialWalletId?: string) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    
    const updatedDebts = [debt, ...debts];
    saveDebts(updatedDebts);
    try {
      await setDoc(doc(db, "users", userDocId, "debts", debt.id), cleanObjectForFirestore(debt));
    } catch (err) {
      console.error("Error saving debt to Firestore:", err);
    }

    if (initialWalletId) {
      const isBorrowed = debt.type === "borrowed";
      const newTx: Transaction = {
        id: "tx-debt-" + Date.now(),
        type: isBorrowed ? "income" : "expense",
        amount: debt.amount,
        category: isBorrowed ? "หนี้สิน (กู้ยืมมา)" : "หนี้สิน (ให้กู้ยืม)",
        merchantName: isBorrowed ? `กู้ยืมเงินจาก ${debt.creditorDebtorName}` : `ให้คุณ ${debt.creditorDebtorName} กู้ยืมเงิน`,
        date: debt.createdAt.split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        note: debt.description || `รายการหนี้อัตโนมัติ: ${debt.creditorDebtorName}`,
        walletId: initialWalletId,
        createdAt: new Date().toISOString(),
      };
      
      const updatedTxList = [newTx, ...transactions];
      saveTransactions(updatedTxList);
      try {
        await setDoc(doc(db, "users", userDocId, "transactions", newTx.id), cleanObjectForFirestore(newTx));
      } catch (err) {
        console.error("Error saving debt transaction to Firestore:", err);
      }
    }
  };

  const handleAddDebtPayment = async (payment: DebtPayment, paidAmount: number) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    const updatedPayments = [payment, ...debtPayments];
    saveDebtPayments(updatedPayments);
    try {
      await setDoc(doc(db, "users", userDocId, "debt_payments", payment.id), cleanObjectForFirestore(payment));
    } catch (err) {
      console.error("Error saving debt payment to Firestore:", err);
    }

    const targetDebt = debts.find((d) => d.id === payment.debtId);
    if (targetDebt) {
      const newRemaining = Math.max(0, targetDebt.remainingAmount - paidAmount);
      const isPaid = newRemaining <= 0;
      const updatedDebt: Debt = {
        ...targetDebt,
        remainingAmount: newRemaining,
        status: isPaid ? "paid" : "active",
      };

      const updatedDebts = debts.map((d) => (d.id === payment.debtId ? updatedDebt : d));
      saveDebts(updatedDebts);
      try {
        await setDoc(doc(db, "users", userDocId, "debts", payment.debtId), cleanObjectForFirestore(updatedDebt));
      } catch (err) {
        console.error("Error updating debt status to Firestore:", err);
      }

      const isBorrowed = targetDebt.type === "borrowed";
      const newTx: Transaction = {
        id: "tx-pay-" + Date.now(),
        type: isBorrowed ? "expense" : "income",
        amount: paidAmount,
        category: isBorrowed ? "หนี้สิน (ชำระคืน)" : "หนี้สิน (รับชำระคืน)",
        merchantName: isBorrowed ? `ชำระหนี้คืนแก่ ${targetDebt.creditorDebtorName}` : `รับชำระหนี้คืนจาก ${targetDebt.creditorDebtorName}`,
        date: payment.date,
        time: new Date().toTimeString().slice(0, 5),
        note: payment.note || `ชำระหนี้รหัส: ${targetDebt.creditorDebtorName}`,
        walletId: payment.walletId,
        createdAt: new Date().toISOString(),
      };

      const updatedTxList = [newTx, ...transactions];
      saveTransactions(updatedTxList);
      try {
        await setDoc(doc(db, "users", userDocId, "transactions", newTx.id), cleanObjectForFirestore(newTx));
      } catch (err) {
        console.error("Error saving debt payment transaction to Firestore:", err);
      }
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    const updatedDebts = debts.filter((d) => d.id !== debtId);
    saveDebts(updatedDebts);
    try {
      await deleteDoc(doc(db, "users", userDocId, "debts", debtId));
    } catch (err) {
      console.error("Error deleting debt from Firestore:", err);
    }

    const paymentsToDelete = debtPayments.filter((p) => p.debtId === debtId);
    const updatedPayments = debtPayments.filter((p) => p.debtId !== debtId);
    saveDebtPayments(updatedPayments);
    try {
      for (const p of paymentsToDelete) {
        await deleteDoc(doc(db, "users", userDocId, "debt_payments", p.id));
      }
    } catch (err) {
      console.error("Error deleting debt payments from Firestore:", err);
    }
  };

  // Trigger when a slip is parsed by AI
  const handleSlipParsed = (parsedData: any, previewUrl: string) => {
    const defaultWalletId = wallets.length > 0 ? wallets[0].id : undefined;

    setPendingReviewData({
      type: parsedData.transactionType || "expense",
      amount: parsedData.amount || 0,
      category: parsedData.category || "อื่นๆ",
      merchantName: parsedData.merchantName || "",
      date: parsedData.date || new Date().toISOString().split("T")[0],
      time: parsedData.time || "",
      note: parsedData.note || "",
      imageUrl: previewUrl,
      walletId: defaultWalletId,
    });
    // Open manual entry form
    setActiveTab("manual");
  };

  const handleEditTrigger = (tx: Transaction) => {
    setEditingTransaction(tx);
    setCurrentPage("records");
    setActiveTab("manual");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Backup & Security integrations
  const handleResetAllData = async () => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    // Clear state & storage
    setTransactions([]);
    setWallets([]);
    setDebts([]);
    setDebtPayments([]);
    localStorage.removeItem(`money_tracker_transactions_${userDocId}`);
    localStorage.removeItem(`money_tracker_wallets_${userDocId}`);
    localStorage.removeItem(`money_tracker_debts_${userDocId}`);
    localStorage.removeItem(`money_tracker_debt_payments_${userDocId}`);
    
    // Clear firestore
    try {
      const txDocs = await getDocs(collection(db, "users", userDocId, "transactions"));
      for (const d of txDocs.docs) {
        await deleteDoc(doc(db, "users", userDocId, "transactions", d.id));
      }
      const walletDocs = await getDocs(collection(db, "users", userDocId, "wallets"));
      for (const d of walletDocs.docs) {
        await deleteDoc(doc(db, "users", userDocId, "wallets", d.id));
      }
      const debtDocs = await getDocs(collection(db, "users", userDocId, "debts"));
      for (const d of debtDocs.docs) {
        await deleteDoc(doc(db, "users", userDocId, "debts", d.id));
      }
      const paymentDocs = await getDocs(collection(db, "users", userDocId, "debt_payments"));
      for (const d of paymentDocs.docs) {
        await deleteDoc(doc(db, "users", userDocId, "debt_payments", d.id));
      }
    } catch (err) {
      console.error("Error clearing Firestore data:", err);
    }

    createDefaultWallets();
  };

  const handleImportBackup = async (data: { wallets: Wallet[]; transactions: Transaction[] }) => {
    saveWallets(data.wallets);
    saveTransactions(data.transactions);
    
    // Sync back to firestore
    try {
      await syncWalletsToFirestore(data.wallets);
      await syncTransactionsToFirestore(data.transactions);
    } catch (err) {
      console.error("Error syncing imported data to Firestore:", err);
    }
  };

  const handleLoginSuccess = (username: string, rememberDevice?: boolean) => {
    setCurrentUser(username);
    sessionStorage.setItem("current_user", username);
    setIsLoggedIn(true);
    sessionStorage.setItem("is_logged_in", "true");
    if (rememberDevice) {
      localStorage.setItem("remember_device", "true");
      localStorage.setItem("remembered_user", username);
    } else {
      localStorage.removeItem("remember_device");
      localStorage.removeItem("remembered_user");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser("");
    sessionStorage.removeItem("is_logged_in");
    sessionStorage.removeItem("current_user");
    localStorage.removeItem("remember_device");
    localStorage.removeItem("remembered_user");
    setTransactions([]);
    setWallets([]);
    setMonthlyGoals([]);
  };

  // If locked/not logged in, render the login gate
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} />;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden pb-24 md:pb-12">
      {/* Visual Mesh Gradients */}
      <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-15%] w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Fixed Premium Header & Navigation Hub */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-b border-white/5 pt-[env(safe-area-inset-top)]">
        {/* Premium Header */}
        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2">
            <div className="p-0.5 bg-white/5 border border-white/10 rounded-lg shadow-lg">
              <img src="/favicon.svg" alt="up ToMe Logo" className="w-7 h-7 object-contain rounded-md" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black text-white text-base tracking-tight">up ToMe</span>
          </div>

          {/* Primary Navigation Hub (Desktop & Tablet) - Compact in Header Center */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-white/5 border border-white/5 p-1 rounded-xl max-w-[55vw] lg:max-w-none overflow-x-auto no-scrollbar shrink">
            <button
              onClick={() => setCurrentPage("dashboard")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "dashboard"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>แดชบอร์ด</span>
            </button>
            <button
              onClick={() => {
                setCurrentPage("records");
                setActiveTab("manual");
              }}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "records"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกเอง</span>
            </button>
            <button
              onClick={() => setCurrentPage("report")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "report"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>รายงาน</span>
            </button>
            <button
              onClick={() => setCurrentPage("services")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "services"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>น้ำไฟ & บำรุง</span>
            </button>
            <button
              onClick={() => setCurrentPage("wallets")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "wallets"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <WalletIcon className="w-3.5 h-3.5" />
              <span>กระเป๋าเงิน</span>
            </button>
            <button
              onClick={() => setCurrentPage("debts")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "debts"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>หนี้สิน</span>
            </button>
            <button
              onClick={() => setCurrentPage("settings")}
              className={`py-1 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer ${
                currentPage === "settings"
                  ? "bg-indigo-600 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>ตั้งค่า</span>
            </button>
          </nav>

          {/* Right Section: Compact Status Icons & Logout */}
          <div className="flex items-center gap-2">
            {firebaseStatus.status === "connected" ? (
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-help transition-all hover:bg-emerald-500/20"
                title="คลาวด์ซิงก์สำเร็จ (เชื่อมต่อระบบปลอดภัย)"
              >
                <Cloud className="w-4 h-4 animate-pulse" />
              </div>
            ) : firebaseStatus.status === "connecting" ? (
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 cursor-help transition-all hover:bg-indigo-500/20"
                title="กำลังเชื่อมต่อคลาวด์..."
              >
                <Cloud className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <button 
                onClick={() => setShowFirebaseErrorDetail(true)}
                title={firebaseStatus.error || "ออฟไลน์โหมด (คลิกเพื่อดูรายละเอียด)"}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 cursor-pointer transition-all"
              >
                <Cloud className="w-4 h-4 animate-bounce" />
              </button>
            )}

            <div 
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-help transition-all hover:bg-emerald-500/20"
              title="ปลอดภัยสูง (เข้ารหัสข้อมูลปลายทาง)"
            >
              <Shield className="w-4 h-4" />
            </div>

            <button
              onClick={handleLogout}
              title="ออกจากระบบเพื่อความปลอดภัย"
              className="p-2 bg-white/5 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/20 rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar (App-like Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#090d16]/95 backdrop-blur-lg border-t border-white/10 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2.5">
        <div className="grid grid-cols-7 h-12 max-w-md mx-auto px-0.5">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "dashboard" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <PieChart className={`w-4 h-4 ${currentPage === "dashboard" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">แดชบอร์ด</span>
          </button>
          <button
            onClick={() => {
              setCurrentPage("records");
              setActiveTab("manual");
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "records" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Plus className={`w-4 h-4 ${currentPage === "records" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">บันทึก</span>
          </button>
          <button
            onClick={() => setCurrentPage("services")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "services" ? "text-amber-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Wrench className={`w-4 h-4 ${currentPage === "services" ? "scale-110 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">น้ำไฟ/รถ</span>
          </button>
          <button
            onClick={() => setCurrentPage("report")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "report" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${currentPage === "report" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">รายงาน</span>
          </button>
          <button
            onClick={() => setCurrentPage("wallets")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "wallets" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <WalletIcon className={`w-4 h-4 ${currentPage === "wallets" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">กระเป๋า</span>
          </button>
          <button
            onClick={() => setCurrentPage("debts")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "debts" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Landmark className={`w-4 h-4 ${currentPage === "debts" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">หนี้สิน</span>
          </button>
          <button
            onClick={() => setCurrentPage("settings")}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              currentPage === "settings" ? "text-indigo-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Settings className={`w-4 h-4 ${currentPage === "settings" ? "scale-110 text-indigo-400 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}`} />
            <span className="text-[9px] leading-none">ตั้งค่า</span>
          </button>
        </div>
      </nav>

      {/* Main Dynamic Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[calc(4.5rem+env(safe-area-inset-top))] md:pt-24 pb-8 relative z-10">
        
        {/* VIEW 1: Overview Dashboard */}
        {currentPage === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in items-start">
            {/* Left Column: Stats Cards (spans 2/3 width on PC) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Top overview statistics */}
              <DashboardStats
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                availableMonths={availableMonths}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                broughtForward={broughtForward}
                transactions={monthlyTransactions}
                allTransactions={transactions}
                wallets={wallets}
                monthlyGoals={monthlyGoals}
                onSaveMonthlyGoal={handleAddOrUpdateMonthlyGoal}
                theme={theme}
              />
            </div>

            {/* Right Column: AI Analysis and LINE Notify (spans 1/3 width on PC) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Smart AI Financial Analysis */}
              <AISummaryCard transactions={monthlyTransactions} selectedMonth={selectedMonth} />

              {/* Send Daily summary to LINE Notify */}
              <LineSummarySender transactions={transactions} wallets={wallets} currentUser={currentUser} debts={debts} />
            </div>
          </div>
        )}

        {/* VIEW 2: Records, AI Scanning & Ledger list */}
        {currentPage === "records" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            {/* Left entry desk: manual/automatic inputs (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-white">📝 บันทึกรายการหรือการโอนเงิน</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">เลือกบันทึกด้วยการแสกนสลิปผ่าน AI หรือป้อนข้อมูลด้วยตัวคุณเอง</p>
                </div>

                <div className="bg-[#121826] p-1.5 rounded-2xl flex border border-white/5 gap-1 text-[11px] font-bold">
                  <button
                    onClick={() => {
                      setActiveTab("scan");
                      setPendingReviewData(null);
                      setEditingTransaction(null);
                    }}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === "scan" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    สแกนสลิปด้วย AI
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("manual");
                      setPendingReviewData(null);
                      setEditingTransaction(null);
                    }}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === "manual" && !editingTransaction && !pendingReviewData
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    บันทึกข้อมูลเอง
                  </button>
                </div>

                {activeTab === "scan" ? (
                  <div className="space-y-4">
                    <SlipUploader onParsed={handleSlipParsed} theme={theme} />
                    
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-[11px] text-slate-400 space-y-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                        คำแนะนำสำหรับคุณ:
                      </span>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>รองรับภาพถ่ายหรือสกรีนช็อตของสลิปโอนเงินธนาคารไทยทุกสถาบัน</li>
                        <li>สแกนใบเสร็จค้าปลีกเพื่อลงบัญชีค่าน้ำมัน, เซเว่น หรือร้านอาหารได้</li>
                        <li>ระบบจะพิจารณาการจ่ายเงินออกเป็น <span className="text-rose-400">รายจ่าย</span> และรับเงินเข้าเป็น <span className="text-emerald-400">รายรับ</span> พร้อมวิเคราะห์วันที่และจำนวนเงินทันที</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <TransactionForm
                    initialData={pendingReviewData || editingTransaction}
                    isEditMode={!!editingTransaction}
                    onSave={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
                    onCancel={() => {
                      setPendingReviewData(null);
                      setEditingTransaction(null);
                      setActiveTab("manual");
                    }}
                    wallets={wallets}
                    walletBalances={walletBalances}
                    debts={debts}
                    expenseHistoryNames={expenseHistoryNames}
                    incomeHistoryNames={incomeHistoryNames}
                  />
                )}
              </div>
            </div>

            {/* Right Ledger display desk: Full Transactions list with filters (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">🗓️ รายการเดินบัญชีประจำเดือน</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">ค้นหา กรอง และจัดการแก้ไขข้อมูลธุรกรรมต่าง ๆ ในเดือนที่เลือก</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-1.5 border border-white/10 rounded-xl bg-[#121826] text-white text-xs font-semibold focus:outline-hidden"
                    >
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <HistoryList
                  transactions={monthlyTransactions}
                  onDelete={handleDeleteTransaction}
                  onEdit={handleEditTrigger}
                  wallets={wallets}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Wallet Management Panel */}
        {currentPage === "wallets" && (
          <div className="animate-fade-in">
            <WalletManager
              wallets={wallets}
              transactions={transactions}
              onAddWallet={handleAddWallet}
              onUpdateWallet={handleUpdateWallet}
              onDeleteWallet={handleDeleteWallet}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={handleEditTrigger}
              onDeleteTransaction={handleDeleteTransaction}
              onReorderWallets={handleReorderWallets}
              theme={theme}
            />
          </div>
        )}

        {/* VIEW 4: Debt & Loan Management Panel */}
        {currentPage === "debts" && (
          <div className="animate-fade-in">
            <DebtManager
              wallets={wallets}
              walletBalances={walletBalances}
              debts={debts}
              debtPayments={debtPayments}
              onAddDebt={handleAddDebt}
              onAddDebtPayment={handleAddDebtPayment}
              onDeleteDebt={handleDeleteDebt}
            />
          </div>
        )}

        {/* VIEW 5: Core System Settings */}
        {currentPage === "settings" && (
          <div className="animate-fade-in">
            <SettingsScreen
              currentUser={currentUser}
              wallets={wallets}
              transactions={transactions}
              onResetAllData={handleResetAllData}
              onLogout={handleLogout}
              onImportBackup={handleImportBackup}
              theme={theme}
              setTheme={setTheme}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
            />
          </div>
        )}

        {/* VIEW 6: Monthly Statement & Financial Report */}
        {currentPage === "report" && (
          <div className="animate-fade-in">
            <MonthlyReport
              transactions={transactions}
              wallets={wallets}
              debts={debts}
              debtPayments={debtPayments}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              availableMonths={availableMonths}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* VIEW 7: Utility Bills & Maintenance Manager */}
        {currentPage === "services" && (
          <div className="animate-fade-in">
            <ServiceAndUtilityManager
              wallets={wallets}
              vehicles={vehicles}
              acServices={acServices}
              utilityBills={utilityBills}
              onSaveVehicles={saveVehicles}
              onSaveAcServices={saveAcServices}
              onSaveUtilityBills={saveUtilityBills}
              onAddTransaction={handleAddTransaction}
              theme={theme}
            />
          </div>
        )}
      </main>
      
      {/* Footer credits */}
      <footer className="bg-[#090d16] border-t border-white/5 mt-24 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            ระบบบันทึกรายรับรายจ่าย อัจฉริยะ (AI-Powered Budgeting Ledger)
          </p>
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
            ขับเคลื่อนด้วยโมเดลวิเคราะห์ข้อมูล Gemini 3.5 เพื่อคำแนะนำด้านความมั่นคงและการวางแผนภาษีการเงินได้อย่างแม่นยำ
          </p>
        </div>
      </footer>

      {showFirebaseErrorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
            <div className="shrink-0">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                สถานะการเชื่อมต่อคลาวด์ (Firestore)
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 mb-4 pr-1 scrollbar-thin">
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                แอปพลิเคชันกำลังทำงานใน <strong className="text-amber-400">โหมดออฟไลน์</strong> ข้อมูลของคุณจะบันทึกและจัดการภายในอุปกรณ์นี้อย่างปลอดภัยผ่าน LocalStorage เมื่อเชื่อมต่อคลาวด์ได้แล้ว ระบบจะซิงก์โดยอัตโนมัติ
              </p>
              {firebaseStatus.error && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-2 text-[11px] font-mono text-amber-300 break-words max-h-32 overflow-y-auto">
                  {firebaseStatus.error}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 text-xs shrink-0">
              <button
                onClick={() => {
                  setFirebaseStatus({ status: "connecting", error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg transition-all cursor-pointer"
              >
                เชื่อมต่อใหม่
              </button>
              <button
                onClick={() => setShowFirebaseErrorDetail(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 font-bold rounded-lg text-slate-300 transition-all cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131926] border border-white/10 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-white/5">
              <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white">คีย์ลัดสำหรับควบคุมบน PC</h3>
                <p className="text-xs text-slate-400">สลับหน้าเมนูและสั่งงานได้อย่างรวดเร็วผ่านแป้นพิมพ์</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">หน้าแดชบอร์ดสรุปผล</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">Alt</kbd> + <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">1</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">1</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">หน้าบันทึก &amp; สแกนสลิป</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">Alt</kbd> + <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">2</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">2</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">หน้าจัดการกระเป๋าเงิน</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">Alt</kbd> + <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">3</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">3</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">หน้าหนี้สินและกู้ยืม</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">Alt</kbd> + <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">4</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">4</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">หน้าตั้งค่าระบบ</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">Alt</kbd> + <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">5</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">5</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5">
                <span className="text-slate-300">เปิด/ปิด คู่มือคีย์ลัดนี้</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400 font-extrabold">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">?</kbd> หรือ <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">H</kbd>
                </span>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-center text-slate-500 leading-normal">
              * คีย์ลัดตัวเลขเดี่ยวจะทำงานเมื่อคุณไม่ได้กำลังพิมพ์กรอกข้อมูลเพื่อป้องกันการพิมพ์ชนกัน
            </div>
            
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
