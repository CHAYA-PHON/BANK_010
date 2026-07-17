import { useState, useEffect } from "react";
import { Transaction, Wallet } from "./types";
import SlipUploader from "./components/SlipUploader";
import TransactionForm from "./components/TransactionForm";
import DashboardStats from "./components/DashboardStats";
import CategoryBreakdown from "./components/CategoryBreakdown";
import MonthlyTrendChart from "./components/MonthlyTrendChart";
import AISummaryCard from "./components/AISummaryCard";
import HistoryList from "./components/HistoryList";
import WalletManager from "./components/WalletManager";
import LoginScreen from "./components/LoginScreen";
import SettingsScreen from "./components/SettingsScreen";
import { 
  Sparkles, Coins, HelpCircle, ArrowUpRight, Plus, ScanLine, 
  History, PieChart, Landmark, ArrowRightLeft, Settings, LogOut, CheckCircle, Wallet as WalletIcon, ShieldAlert 
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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("is_logged_in") === "true";
  });
  
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return sessionStorage.getItem("current_user") || "";
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [currentPage, setCurrentPage] = useState<"dashboard" | "records" | "wallets" | "settings">("dashboard");
  
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

  // Helper to sync batch of transactions to Firestore under user-isolated subcollection
  const syncTransactionsToFirestore = async (txs: Transaction[]) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
    try {
      for (const tx of txs) {
        await setDoc(doc(db, "users", userDocId, "transactions", tx.id), tx);
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
        await setDoc(doc(db, "users", userDocId, "wallets", w.id), w);
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
      }
    ];
    saveWallets(defaultWts);
    syncWalletsToFirestore(defaultWts);
  };

  // Load transactions and wallets from Firestore with local storage fallback
  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn || !currentUser) return;
      
      const userDocId = currentUser.toLowerCase().trim();
      let walletLoadSuccess = false;
      let transactionLoadSuccess = false;
      let walletsData: Wallet[] = [];

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
          walletsData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setWallets(walletsData);
          localStorage.setItem(`money_tracker_wallets_${userDocId}`, JSON.stringify(walletsData));
        } else {
          const savedWallets = localStorage.getItem(`money_tracker_wallets_${userDocId}`);
          if (savedWallets) {
            try {
              const parsed = JSON.parse(savedWallets);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setWallets(parsed);
                syncWalletsToFirestore(parsed);
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
            setWallets(JSON.parse(savedWallets));
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

  // Brought forward balance calculations
  const startingBalanceSum = wallets.reduce((sum, w) => sum + w.initialBalance, 0);
  const previousTransactions = transactions.filter((tx) => tx.date.substring(0, 7) < selectedMonth);
  const previousIncomes = previousTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const previousExpenses = previousTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const broughtForward = startingBalanceSum + previousIncomes - previousExpenses;

  // Calculations for current selected month
  const totalIncome = monthlyTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = monthlyTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

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
      await setDoc(doc(db, "users", userDocId, "transactions", newTx.id), newTx);
    } catch (err) {
      console.error("Error saving transaction to Firestore:", err);
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
      await setDoc(doc(db, "users", userDocId, "transactions", editingTransaction.id), updatedTx);
    } catch (err) {
      console.error("Error updating transaction in Firestore:", err);
    }

    setEditingTransaction(null);
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();
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
    const newW: Wallet = {
      ...data,
      id: "w-" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newW, ...wallets];
    saveWallets(updated);

    try {
      await setDoc(doc(db, "users", userDocId, "wallets", newW.id), newW);
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
    const updated = wallets.map((w) => (w.id === id ? updatedW : w));
    saveWallets(updated);

    try {
      await setDoc(doc(db, "users", userDocId, "wallets", id), updatedW);
    } catch (err) {
      console.error("Error updating wallet in Firestore:", err);
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
    setActiveTab("manual");
  };

  // Backup & Security integrations
  const handleResetAllData = async () => {
    if (!currentUser) return;
    const userDocId = currentUser.toLowerCase().trim();

    // Clear state & storage
    setTransactions([]);
    setWallets([]);
    localStorage.removeItem(`money_tracker_transactions_${userDocId}`);
    localStorage.removeItem(`money_tracker_wallets_${userDocId}`);
    
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

  const handleLoginSuccess = (username: string) => {
    setCurrentUser(username);
    sessionStorage.setItem("current_user", username);
    setIsLoggedIn(true);
    sessionStorage.setItem("is_logged_in", "true");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser("");
    sessionStorage.removeItem("is_logged_in");
    sessionStorage.removeItem("current_user");
    setTransactions([]);
    setWallets([]);
  };

  // If locked/not logged in, render the login gate
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-white font-sans selection:bg-indigo-500/30 relative overflow-x-hidden pb-12">
      {/* Visual Mesh Gradients */}
      <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-15%] w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500/10 to-indigo-500/10 border border-white/10 text-emerald-400 rounded-xl shadow-lg">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                FinanceAI บันทึกบัญชีอัจฉริยะ
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
                Secure Personal Finance & AI Slip Scanning
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {firebaseStatus.status === "connected" ? (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span>คลาวด์ซิงก์สำเร็จ</span>
              </div>
            ) : firebaseStatus.status === "connecting" ? (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-spin" />
                <span>กำลังเชื่อมต่อ...</span>
              </div>
            ) : (
              <button 
                onClick={() => setShowFirebaseErrorDetail(true)}
                title={firebaseStatus.error || "คลิกเพื่อดูรายละเอียดข้อผิดพลาด"}
                className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-full px-3 py-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                <span>ออฟไลน์โหมด (แตะดูข้อผิดพลาด)</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span>ปลอดภัยสูง</span>
            </div>
            <button
              onClick={handleLogout}
              title="ออกจากระบบเพื่อความปลอดภัย"
              className="p-2.5 bg-white/5 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/20 rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Primary Navigation Hub */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-1.5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-1.5 max-w-2xl mx-auto">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              currentPage === "dashboard"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <PieChart className="w-4 h-4" />
            1. แดชบอร์ดภาพรวม
          </button>
          <button
            onClick={() => setCurrentPage("records")}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              currentPage === "records"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ScanLine className="w-4 h-4" />
            2. บันทึกและโอนออก
          </button>
          <button
            onClick={() => setCurrentPage("wallets")}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              currentPage === "wallets"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <WalletIcon className="w-4 h-4" />
            3. จัดการกระเป๋าเงิน
          </button>
          <button
            onClick={() => setCurrentPage("settings")}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              currentPage === "settings"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="w-4 h-4" />
            4. ตั้งค่าระบบ
          </button>
        </div>
      </nav>

      {/* Main Dynamic Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* VIEW 1: Overview Dashboard */}
        {currentPage === "dashboard" && (
          <div className="space-y-6 animate-fade-in">
            {/* Top overview statistics */}
            <DashboardStats
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              availableMonths={availableMonths}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              broughtForward={broughtForward}
            />

            {/* Smart AI Financial Analysis */}
            <AISummaryCard transactions={monthlyTransactions} selectedMonth={selectedMonth} />

            {/* Visual analytics plots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MonthlyTrendChart transactions={transactions} selectedMonth={selectedMonth} />
              <CategoryBreakdown transactions={monthlyTransactions} />
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
                    <SlipUploader onParsed={handleSlipParsed} />
                    
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
                      setActiveTab("scan");
                    }}
                    wallets={wallets}
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
            />
          </div>
        )}

        {/* VIEW 4: Core System Settings */}
        {currentPage === "settings" && (
          <div className="animate-fade-in">
            <SettingsScreen
              currentUser={currentUser}
              wallets={wallets}
              transactions={transactions}
              onResetAllData={handleResetAllData}
              onLogout={handleLogout}
              onImportBackup={handleImportBackup}
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
    </div>
  );
}
