import { useState, useMemo } from "react";
import { Transaction, Wallet, Debt, DebtPayment, CATEGORIES } from "../types";
import { 
  Printer, Download, FileText, Image as ImageIcon, Calendar, 
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Wallet as WalletIcon, 
  TrendingUp, Landmark, FileCheck, RefreshCw, Eye, EyeOff
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface MonthlyReportProps {
  transactions: Transaction[];
  wallets: Wallet[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  availableMonths: string[];
}

export default function MonthlyReport({
  transactions,
  wallets,
  debts,
  debtPayments,
  selectedMonth,
  onMonthChange,
  availableMonths,
}: MonthlyReportProps) {
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<"none" | "pdf" | "image">("none");

  // Get Thai month name
  const thaiMonthName = useMemo(() => {
    if (!selectedMonth) return "";
    const [year, month] = selectedMonth.split("-");
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const thaiYear = parseInt(year) + 543;
    return `${months[parseInt(month) - 1]} พ.ศ. ${thaiYear}`;
  }, [selectedMonth]);

  // Calculations for brought forward and running ledger
  const {
    broughtForward,
    dayRows,
    totalIncome,
    totalExpense,
    netRemaining,
    monthlyTransactionsList
  } = useMemo(() => {
    if (!selectedMonth) {
      return {
        broughtForward: 0,
        dayRows: [],
        totalIncome: 0,
        totalExpense: 0,
        netRemaining: 0,
        monthlyTransactionsList: []
      };
    }

    const year = parseInt(selectedMonth.split("-")[0]);
    const month = parseInt(selectedMonth.split("-")[1]);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Sum initial balances of all wallets
    const walletsInitialSum = wallets.reduce((sum, w) => sum + w.initialBalance, 0);

    // Filter transactions before the selected month
    const previousTransactions = transactions.filter((tx) => tx.date < `${selectedMonth}-01`);
    const previousIncome = previousTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const previousExpense = previousTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Brought forward = Wallets starting sum + previous income - previous expense
    const bForward = walletsInitialSum + previousIncome - previousExpense;

    // Build day-by-day rows
    const rows = [];
    let cumulativeBalance = bForward;
    let tIncome = 0;
    let tExpense = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDateStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
      const dayTxs = transactions.filter((tx) => tx.date === dayDateStr);

      const inc = dayTxs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
      const exp = dayTxs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);

      tIncome += inc;
      tExpense += exp;
      cumulativeBalance = cumulativeBalance + inc - exp;

      rows.push({
        day: d,
        dateString: dayDateStr,
        income: inc,
        expense: exp,
        runningBalance: cumulativeBalance,
        transactionsCount: dayTxs.length,
      });
    }

    // List of transactions in this month
    const monthTxs = transactions
      .filter((tx) => tx.date.substring(0, 7) === selectedMonth)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));

    return {
      broughtForward: bForward,
      dayRows: rows,
      totalIncome: tIncome,
      totalExpense: tExpense,
      netRemaining: cumulativeBalance,
      monthlyTransactionsList: monthTxs
    };
  }, [transactions, wallets, selectedMonth]);

  // Debt Calculations for this month (Borrowed/Liabilities)
  const debtSummary = useMemo(() => {
    if (!selectedMonth) {
      return { originalBorrowed: 0, newBorrowed: 0, paidBorrowed: 0, remainingBorrowed: 0 };
    }

    // 1. Debt balance before this month (Outstanding Borrowed Debt before selected month)
    const previousBorrowedDebts = debts.filter(
      (d) => d.type === "borrowed" && d.createdAt.substring(0, 7) < selectedMonth
    );
    const originalBorrowed = previousBorrowedDebts.reduce((sum, d) => {
      const paymentsBefore = debtPayments
        .filter((p) => p.debtId === d.id && p.date < `${selectedMonth}-01`)
        .reduce((pSum, p) => pSum + p.amount, 0);
      return sum + Math.max(0, d.amount - paymentsBefore);
    }, 0);

    // 2. New Borrowing during this month
    const newBorrowed = debts
      .filter((d) => d.type === "borrowed" && d.createdAt.substring(0, 7) === selectedMonth)
      .reduce((sum, d) => sum + d.amount, 0);

    // 3. Paid Back during this month
    const paidBorrowed = debtPayments
      .filter((p) => {
        const d = debts.find((debt) => debt.id === p.debtId);
        return d && d.type === "borrowed" && p.date.substring(0, 7) === selectedMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    // 4. Remaining borrowed debt at end of month
    const remainingBorrowed = originalBorrowed + newBorrowed - paidBorrowed;

    return {
      originalBorrowed,
      newBorrowed,
      paidBorrowed,
      remainingBorrowed,
    };
  }, [debts, debtPayments, selectedMonth]);

  // Debt Calculations for this month (Lent/Assets)
  const lentSummary = useMemo(() => {
    if (!selectedMonth) {
      return { originalLent: 0, newLent: 0, receivedLent: 0, remainingLent: 0 };
    }

    // 1. Outstanding Lent before selected month
    const previousLentDebts = debts.filter(
      (d) => d.type === "lent" && d.createdAt.substring(0, 7) < selectedMonth
    );
    const originalLent = previousLentDebts.reduce((sum, d) => {
      const paymentsBefore = debtPayments
        .filter((p) => p.debtId === d.id && p.date < `${selectedMonth}-01`)
        .reduce((pSum, p) => pSum + p.amount, 0);
      return sum + Math.max(0, d.amount - paymentsBefore);
    }, 0);

    // 2. New Lending during this month
    const newLent = debts
      .filter((d) => d.type === "lent" && d.createdAt.substring(0, 7) === selectedMonth)
      .reduce((sum, d) => sum + d.amount, 0);

    // 3. Received Back during this month
    const receivedLent = debtPayments
      .filter((p) => {
        const d = debts.find((debt) => debt.id === p.debtId);
        return d && d.type === "lent" && p.date.substring(0, 7) === selectedMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    // 4. Remaining outstanding lent at end of month
    const remainingLent = originalLent + newLent - receivedLent;

    return {
      originalLent,
      newLent,
      receivedLent,
      remainingLent,
    };
  }, [debts, debtPayments, selectedMonth]);

  // Filter rows based on active toggle
  const displayedDayRows = useMemo(() => {
    if (showOnlyActiveDays) {
      return dayRows.filter(row => row.transactionsCount > 0);
    }
    return dayRows;
  }, [dayRows, showOnlyActiveDays]);

  const handlePrint = () => {
    window.print();
  };

  // Helper to temporarily sanitize oklch and oklab colors in stylesheets so html2canvas doesn't crash
  const executeWithSanitizedStyles = async (callback: () => Promise<void>) => {
    const originalStyles: { element: HTMLStyleElement; text: string }[] = [];
    const modifiedLinks: { element: HTMLLinkElement; disabled: boolean }[] = [];
    const temporaryStyleTags: HTMLStyleElement[] = [];

    try {
      // 1. Process all inline <style> elements
      document.querySelectorAll("style").forEach((styleEl) => {
        const text = styleEl.textContent || "";
        if (text.includes("oklch") || text.includes("oklab")) {
          originalStyles.push({ element: styleEl, text });
          const sanitized = text
            .replace(/oklch\([^)]+\)/g, "rgb(120, 120, 120)")
            .replace(/oklab\([^)]+\)/g, "rgb(120, 120, 120)");
          styleEl.textContent = sanitized;
        }
      });

      // 2. Process all external <link rel="stylesheet"> elements
      const links = Array.from(document.querySelectorAll("link[rel='stylesheet']")) as HTMLLinkElement[];
      for (const link of links) {
        try {
          const response = await fetch(link.href);
          if (response.ok) {
            const cssText = await response.text();
            if (cssText.includes("oklch") || cssText.includes("oklab")) {
              modifiedLinks.push({ element: link, disabled: link.disabled });
              link.disabled = true;

              const sanitizedText = cssText
                .replace(/oklch\([^)]+\)/g, "rgb(120, 120, 120)")
                .replace(/oklab\([^)]+\)/g, "rgb(120, 120, 120)");
              
              const tempStyle = document.createElement("style");
              tempStyle.textContent = sanitizedText;
              document.head.appendChild(tempStyle);
              temporaryStyleTags.push(tempStyle);
            }
          }
        } catch (e) {
          console.warn("Could not fetch or sanitize external stylesheet:", link.href, e);
        }
      }

      await callback();

    } finally {
      // Restore all original styles
      originalStyles.forEach(({ element, text }) => {
        element.textContent = text;
      });

      // Restore original links and remove temporary style tags
      modifiedLinks.forEach(({ element, disabled }) => {
        element.disabled = disabled;
      });
      
      temporaryStyleTags.forEach((tag) => {
        if (tag.parentNode) {
          tag.parentNode.removeChild(tag);
        }
      });
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("monthly-report-content");
    if (!element) return;
    
    setIsGenerating("pdf");
    try {
      // Temporarily inject capture styles
      element.classList.add("print-capture-mode");
      
      await executeWithSanitizedStyles(async () => {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        
        element.classList.remove("print-capture-mode");
        
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210; // A4 size
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        pdf.save(`รายงานทางการเงิน_ประจำเดือน_${selectedMonth}.pdf`);
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("ไม่สามารถสร้าง PDF ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      element.classList.remove("print-capture-mode");
      setIsGenerating("none");
    }
  };

  const handleDownloadImage = async () => {
    const element = document.getElementById("monthly-report-content");
    if (!element) return;
    
    setIsGenerating("image");
    try {
      element.classList.add("print-capture-mode");
      
      await executeWithSanitizedStyles(async () => {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        
        element.classList.remove("print-capture-mode");
        
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `รายงานทางการเงิน_${selectedMonth}.png`;
        link.href = imgData;
        link.click();
      });
    } catch (error) {
      console.error("Image generation failed:", error);
      alert("ไม่สามารถบันทึกภาพได้");
    } finally {
      element.classList.remove("print-capture-mode");
      setIsGenerating("none");
    }
  };

  return (
    <div className="space-y-6">
      {/* Printable page styling injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: #0f172a !important;
          }
          header, nav, footer, .no-print {
            display: none !important;
          }
          .print-container {
            background: white !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Force standard visible colors on print */
          .text-white { color: #0f172a !important; }
          .text-slate-400, .text-slate-300, .text-slate-200 { color: #334155 !important; }
          .bg-[#090d16], .bg-white/5, .bg-[#121826], .bg-slate-900/40 {
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
          }
          .border-white/10, .border-white/5 {
            border-color: #94a3b8 !important;
          }
          .text-emerald-400 { color: #047857 !important; font-weight: bold !important; }
          .text-rose-400 { color: #be123c !important; font-weight: bold !important; }
          .text-indigo-400 { color: #4338ca !important; font-weight: bold !important; }
          .bg-emerald-500/10, .bg-rose-500/10, .bg-indigo-500/10 {
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
          }
        }

        /* Capture mode for html2canvas to look like a premium bank statement */
        .print-capture-mode {
          background: #ffffff !important;
          color: #0f172a !important;
          padding: 32px !important;
          border-radius: 0px !important;
        }
        .print-capture-mode * {
          text-shadow: none !important;
          box-shadow: none !important;
        }
        .print-capture-mode .text-white {
          color: #0f172a !important;
        }
        .print-capture-mode .text-slate-400, 
        .print-capture-mode .text-slate-300, 
        .print-capture-mode .text-slate-200 {
          color: #334155 !important;
        }
        .print-capture-mode .bg-[#090d16],
        .print-capture-mode .bg-white\\/5,
        .print-capture-mode .bg-\\[\\#121826\\],
        .print-capture-mode .bg-slate-900\\/40,
        .print-capture-mode .bg-white\\/10 {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .print-capture-mode .border-white\\/10, 
        .print-capture-mode .border-white\\/5 {
          border-color: #e2e8f0 !important;
        }
        .print-capture-mode .text-emerald-400 { color: #047857 !important; }
        .print-capture-mode .text-rose-400 { color: #be123c !important; }
        .print-capture-mode .text-indigo-400 { color: #4338ca !important; }
        .print-capture-mode .bg-emerald-500\\/10 { background-color: #ecfdf5 !important; border-color: #a7f3d0 !important; }
        .print-capture-mode .bg-rose-500\\/10 { background-color: #fff1f2 !important; border-color: #fecdd3 !important; }
        .print-capture-mode .bg-indigo-500\\/10 { background-color: #e0e7ff !important; border-color: #c7d2fe !important; }
        .print-capture-mode .report-header-panel {
          background-color: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
        }
      ` }} />

      {/* Control panel & Month selector */}
      <div className="no-print bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-2xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm">🗓️ เครื่องมือออกรายงานและสรุปบัญชี</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">เลือกเดือน ตรวจสอบรายรับรายจ่ายแบบละเอียด และส่งออกเป็น PDF/รูปภาพ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Month Selector Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-white/10 rounded-xl bg-[#121826] text-white text-xs font-bold focus:outline-hidden cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                รายงานเดือน {m}
              </option>
            ))}
          </select>

          {/* Conciseness Toggle */}
          <button
            onClick={() => setShowOnlyActiveDays(!showOnlyActiveDays)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            title={showOnlyActiveDays ? "แสดงทุกวันในเดือน" : "แสดงเฉพาะวันที่มีรายการธุรกรรม"}
          >
            {showOnlyActiveDays ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                แสดงทุกวัน
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                ซ่อนวันที่เป็น 0
              </>
            )}
          </button>

          {/* PDF export button */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating !== "none"}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
          >
            {isGenerating === "pdf" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {isGenerating === "pdf" ? "กำลังบันทึก..." : "ดาวน์โหลด PDF"}
          </button>

          {/* Image export button */}
          <button
            onClick={handleDownloadImage}
            disabled={isGenerating !== "none"}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
          >
            {isGenerating === "image" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            {isGenerating === "image" ? "กำลังบันทึก..." : "ดาวน์โหลดเป็นรูปภาพ"}
          </button>

          {/* Native printer button */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* Main Report Document Container */}
      <div 
        id="monthly-report-content" 
        className="print-container bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
      >
        {/* Document Header Panel */}
        <div className="report-header-panel border border-white/5 bg-[#121826]/70 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              📊 รายงานการเคลื่อนไหวทางบัญชี
            </h1>
            <p className="text-xs text-indigo-300 font-bold tracking-wider uppercase">
              Financial Statement of {thaiMonthName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              ออกรายงานเมื่อ: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} น.
            </p>
          </div>
          
          <div className="text-left md:text-right md:border-l border-white/10 md:pl-6 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">เจ้าของบัญชี</span>
            <span className="text-sm font-extrabold text-white bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 block inline-block text-center">
              👤 {localStorage.getItem("current_user") || "ผู้ใช้งาน"}
            </span>
          </div>
        </div>

        {/* Top summary balance blocks */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ยอดยกมา (Brought Forward)</span>
            <span className="text-base md:text-lg font-black text-white block">
              ฿{broughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              รายรับรวมประจำเดือน (Income)
            </span>
            <span className="text-base md:text-lg font-black text-emerald-400 block">
              +฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
              รายจ่ายรวมประจำเดือน (Expense)
            </span>
            <span className="text-base md:text-lg font-black text-rose-400 block">
              -฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">คงเหลือสะสม (Net Remaining)</span>
            <span className="text-base md:text-lg font-black text-indigo-400 block">
              ฿{netRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Chronological running-balance daily table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              บัญชีแสดงการเคลื่อนไหวรายวัน (Daily Statement Ledger)
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              แสดง {displayedDayRows.length} รายการเคลื่อนไหว
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#121826] border-b border-white/5 text-slate-400 font-bold">
                  <th className="py-2.5 px-4 font-bold text-slate-400">วันที่</th>
                  <th className="py-2.5 px-4 font-bold text-emerald-400 text-right">รายรับ (Income)</th>
                  <th className="py-2.5 px-4 font-bold text-rose-400 text-right">รายจ่าย (Expense)</th>
                  <th className="py-2.5 px-4 font-bold text-indigo-300 text-right">คงเหลือสะสม (Balance)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedDayRows.map((row) => (
                  <tr 
                    key={row.day} 
                    className={`hover:bg-white/5 transition-colors ${row.transactionsCount > 0 ? "bg-white/[0.02]" : "opacity-60"}`}
                  >
                    <td className="py-2 px-4 font-semibold text-slate-200">
                      วันที่ {row.day} <span className="text-[10px] text-slate-400 font-medium ml-1">({row.transactionsCount} รายการ)</span>
                    </td>
                    <td className="py-2 px-4 text-right text-emerald-400 font-medium">
                      {row.income > 0 ? `+฿${row.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "฿0.00"}
                    </td>
                    <td className="py-2 px-4 text-right text-rose-400 font-medium">
                      {row.expense > 0 ? `-฿${row.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "฿0.00"}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-200 font-bold font-mono">
                      ฿{row.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Debt summaries block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Liabilities Section */}
          <div className="border border-rose-500/10 bg-rose-500/5 p-5 rounded-2xl space-y-3.5">
            <h3 className="text-xs font-black text-rose-300 uppercase tracking-widest flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-rose-400" />
              สรุปหนี้สินของเรา (Borrowed / Liabilities)
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">หนี้สินเดิมสะสม</span>
                <span className="text-sm font-extrabold text-white block">
                  ฿{debtSummary.originalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">กู้ยืมใหม่เพิ่ม</span>
                <span className="text-sm font-extrabold text-rose-400 block">
                  +฿{debtSummary.newBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">จ่ายชำระคืนแล้ว</span>
                <span className="text-sm font-extrabold text-emerald-400 block">
                  -฿{debtSummary.paidBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-rose-500/20 rounded-xl space-y-1 bg-rose-950/20">
                <span className="text-[10px] text-rose-300 block font-bold">ค้างชำระสุทธิ</span>
                <span className="text-sm font-black text-rose-400 block font-mono">
                  ฿{debtSummary.remainingBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Lending Section */}
          <div className="border border-emerald-500/10 bg-emerald-500/5 p-5 rounded-2xl space-y-3.5">
            <h3 className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              สรุปเงินกู้ยืมให้ผู้อื่น (Lent / Debt Assets)
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">เงินที่ให้ยืมเดิมสะสม</span>
                <span className="text-sm font-extrabold text-white block">
                  ฿{lentSummary.originalLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">ให้ยืมใหม่เพิ่ม</span>
                <span className="text-sm font-extrabold text-indigo-400 block">
                  +฿{lentSummary.newLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-white/5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">ได้รับคืนแล้ว</span>
                <span className="text-sm font-extrabold text-emerald-400 block">
                  -฿{lentSummary.receivedLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-[#090d16]/30 border border-emerald-500/20 rounded-xl space-y-1 bg-emerald-950/20">
                <span className="text-[10px] text-emerald-300 block font-bold">ยอดที่เขายังค้างจ่าย</span>
                <span className="text-sm font-black text-emerald-400 block font-mono">
                  ฿{lentSummary.remainingLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Transactions List for Month (Separated clearly by Type and Colors) */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-white uppercase tracking-wider">
            📋 บันทึกรายการแบบละเอียดแยกตามรายรับ-รายจ่าย-โอนเงิน
          </h3>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#121826] border-b border-white/5 text-slate-400 font-bold">
                  <th className="py-2.5 px-4">วันเวลาทำรายการ</th>
                  <th className="py-2.5 px-4">หมวดหมู่</th>
                  <th className="py-2.5 px-4">รายละเอียดผู้โอน/ผู้รับเงิน/ร้านค้า</th>
                  <th className="py-2.5 px-4">กระเป๋าเงิน</th>
                  <th className="py-2.5 px-4 text-right">ประเภท</th>
                  <th className="py-2.5 px-4 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {monthlyTransactionsList.length > 0 ? (
                  monthlyTransactionsList.map((tx) => {
                    const foundWallet = wallets.find(w => w.id === tx.walletId);
                    const toWallet = wallets.find(w => w.id === tx.toWalletId);
                    
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-300">
                          {tx.date} {tx.time ? `(${tx.time} น.)` : ""}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-slate-300">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {tx.merchantName || "-"}
                          {tx.note && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">📝 {tx.note}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {foundWallet ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{foundWallet.icon}</span>
                              <span>{foundWallet.name}</span>
                            </span>
                          ) : "-"}
                          {tx.type === "transfer" && toWallet && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md ml-1.5">
                              <ArrowRightLeft className="w-3 h-3" /> {toWallet.name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold uppercase">
                          {tx.type === "income" && <span className="text-emerald-400">รายรับ 💰</span>}
                          {tx.type === "expense" && <span className="text-rose-400">รายจ่าย 💸</span>}
                          {tx.type === "transfer" && <span className="text-indigo-400">โอนเงิน 🔄</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-200">
                          {tx.type === "income" && <span className="text-emerald-400 font-extrabold">+฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                          {tx.type === "expense" && <span className="text-rose-400 font-extrabold">-฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                          {tx.type === "transfer" && <span className="text-indigo-400">฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                      ไม่มีรายการเคลื่อนไหวทางบัญชีในเดือนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
