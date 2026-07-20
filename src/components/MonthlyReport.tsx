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
  currentUser?: string;
}

export default function MonthlyReport({
  transactions,
  wallets,
  debts,
  debtPayments,
  selectedMonth,
  onMonthChange,
  availableMonths,
  currentUser,
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

  // Compress consecutive empty days into ellipsis rows to match the statement design
  const renderedRows = useMemo(() => {
    if (showOnlyActiveDays) {
      return dayRows.filter(row => row.transactionsCount > 0).map(row => ({ type: "row" as const, data: row }));
    }

    const daysInMonth = dayRows.length;
    const isDayVisible = (d: number) => {
      // First 5 days are always visible
      if (d <= 5) return true;
      // Last 2 days are always visible
      if (d >= daysInMonth - 1) return true;
      // Days with transactions are always visible
      const row = dayRows.find(r => r.day === d);
      if (row && row.transactionsCount > 0) return true;
      return false;
    };

    const rendered: Array<{ type: "row" | "ellipsis"; data?: typeof dayRows[0] }> = [];
    let inEllipsis = false;

    for (let d = 1; d <= daysInMonth; d++) {
      const row = dayRows.find(r => r.day === d);
      if (!row) continue;

      if (isDayVisible(d)) {
        inEllipsis = false;
        rendered.push({ type: "row", data: row });
      } else {
        if (!inEllipsis) {
          rendered.push({ type: "ellipsis" });
          rendered.push({ type: "ellipsis" });
          rendered.push({ type: "ellipsis" });
          inEllipsis = true;
        }
      }
    }

    return rendered;
  }, [dayRows, showOnlyActiveDays]);

  const handlePrint = () => {
    window.print();
  };

  // 1. Color conversion formulas (OKLAB -> RGB & OKLCH -> RGB)
  const oklabToRgb = (L: number, a: number, b: number, alpha = 1) => {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l_lin = l_ * l_ * l_;
    const m_lin = m_ * m_ * m_;
    const s_lin = s_ * s_ * s_;

    let r_val = +4.0767416621 * l_lin - 3.3077115913 * m_lin + 0.2309699292 * s_lin;
    let g_val = -1.2684380046 * l_lin + 2.6097574011 * m_lin - 0.3413193965 * s_lin;
    let b_val = -0.0041960863 * l_lin - 0.7034186147 * m_lin + 1.7076210013 * s_lin;

    const gamma = (c: number) => {
      if (c <= 0.0031308) {
        return 12.92 * c;
      } else {
        return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      }
    };

    const R = Math.max(0, Math.min(255, Math.round(gamma(r_val) * 255)));
    const G = Math.max(0, Math.min(255, Math.round(gamma(g_val) * 255)));
    const B = Math.max(0, Math.min(255, Math.round(gamma(b_val) * 255)));

    return alpha === 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${alpha})`;
  };

  const oklchToRgb = (L: number, C: number, H: number, alpha = 1) => {
    const h_rad = (H * Math.PI) / 180;
    const a = C * Math.cos(h_rad);
    const b = C * Math.sin(h_rad);
    return oklabToRgb(L, a, b, alpha);
  };

  const parseVal = (str: string, range = 1): number => {
    if (!str) return 0;
    str = str.trim();
    if (str.endsWith("%")) {
      return (parseFloat(str) / 100) * range;
    }
    return parseFloat(str);
  };

  const sanitizeCssText = (cssText: string): string => {
    if (typeof cssText !== "string") return cssText;
    let result = cssText;

    // Fast regex replace for oklch(...)
    result = result.replace(/oklch\(([^)]+)\)/g, (match, argsStr) => {
      try {
        const cleaned = argsStr.replace(/,/g, " ").replace(/\//g, " ").replace(/\s+/g, " ").trim();
        const parts = cleaned.split(" ");
        if (parts.length >= 3) {
          const L = parseVal(parts[0], 1);
          const C = parseVal(parts[1], 1);
          const H = parseVal(parts[2], 360);
          const alpha = parts[3] ? parseVal(parts[3], 1) : 1;
          
          if (!isNaN(L) && !isNaN(C) && !isNaN(H)) {
            return oklchToRgb(L, C, H, alpha);
          }
        }
      } catch (e) {
        // ignore
      }
      return "rgb(120, 120, 120)";
    });

    // Fast regex replace for oklab(...)
    result = result.replace(/oklab\(([^)]+)\)/g, (match, argsStr) => {
      try {
        const cleaned = argsStr.replace(/,/g, " ").replace(/\//g, " ").replace(/\s+/g, " ").trim();
        const parts = cleaned.split(" ");
        if (parts.length >= 3) {
          const L = parseVal(parts[0], 1);
          const a = parseVal(parts[1], 1);
          const b = parseVal(parts[2], 1);
          const alpha = parts[3] ? parseVal(parts[3], 1) : 1;
          
          if (!isNaN(L) && !isNaN(a) && !isNaN(b)) {
            return oklabToRgb(L, a, b, alpha);
          }
        }
      } catch (e) {
        // ignore
      }
      return "rgb(120, 120, 120)";
    });

    return result;
  };

  const sanitizeValue = (val: string): string => {
    if (typeof val !== "string") return val;
    if (!val.includes("oklch") && !val.includes("oklab")) return val;
    return sanitizeCssText(val);
  };

  const patchComputedStyleObject = (origStyle: CSSStyleDeclaration) => {
    return new Proxy(origStyle, {
      get(target, prop) {
        // Use target as receiver to avoid "Illegal invocation" on native getter properties
        const value = Reflect.get(target, prop, target);
        if (typeof value === "function") {
          if (prop === "getPropertyValue") {
            return function (propertyName: string) {
              return sanitizeValue(target.getPropertyValue(propertyName));
            };
          }
          return value.bind(target);
        }
        if (typeof prop === "string" && !isNaN(Number(prop))) {
          return value;
        }
        if (typeof value === "string") {
          return sanitizeValue(value);
        }
        return value;
      }
    });
  };

  // Helper to temporarily sanitize oklch and oklab colors in stylesheets so html2canvas doesn't crash
  const executeWithSanitizedStyles = async (callback: () => Promise<void>) => {
    const disabledSheets: { sheet: CSSStyleSheet; originalDisabled: boolean }[] = [];
    const temporaryStyleTags: HTMLStyleElement[] = [];
    const originalInlineStyles = new Map<HTMLElement, string>();

    // Patch getComputedStyle to sanitize on the fly!
    const originalGetComputedStyle = window.getComputedStyle;

    // Override parent window's getComputedStyle
    window.getComputedStyle = function (el, pseudoEl) {
      const style = originalGetComputedStyle.call(window, el, pseudoEl);
      return patchComputedStyleObject(style);
    };

    try {
      // 1. Process all document styleSheets (including CSSOM-only injected ones)
      const sheets = Array.from(document.styleSheets) as CSSStyleSheet[];
      for (const sheet of sheets) {
        try {
          let cssText = "";
          if (sheet.cssRules) {
            cssText = Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("\n");
          }
          
          if (cssText.includes("oklch") || cssText.includes("oklab")) {
            disabledSheets.push({ sheet, originalDisabled: sheet.disabled });
            sheet.disabled = true;

            const sanitizedText = sanitizeCssText(cssText);
            const tempStyle = document.createElement("style");
            tempStyle.textContent = sanitizedText;
            document.head.appendChild(tempStyle);
            temporaryStyleTags.push(tempStyle);
          }
        } catch (e) {
          // Fallback if CORS prevents rules inspection - fetch external href
          if (sheet.href) {
            try {
              const response = await fetch(sheet.href);
              if (response.ok) {
                const cssText = await response.text();
                if (cssText.includes("oklch") || cssText.includes("oklab")) {
                  disabledSheets.push({ sheet, originalDisabled: sheet.disabled });
                  sheet.disabled = true;

                  const sanitizedText = sanitizeCssText(cssText);
                  const tempStyle = document.createElement("style");
                  tempStyle.textContent = sanitizedText;
                  document.head.appendChild(tempStyle);
                  temporaryStyleTags.push(tempStyle);
                }
              }
            } catch (fetchErr) {
              console.warn("Could not fetch style rules:", sheet.href, fetchErr);
            }
          }
        }
      }

      // 2. Sanitize all inline style attributes of the report content and descendant elements
      const reportContentEl = document.getElementById("monthly-report-content");
      if (reportContentEl) {
        const elements = [reportContentEl, ...Array.from(reportContentEl.querySelectorAll("*"))] as HTMLElement[];
        elements.forEach((el) => {
          if (el.getAttribute) {
            const styleAttr = el.getAttribute("style");
            if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
              originalInlineStyles.set(el, styleAttr);
              el.setAttribute("style", sanitizeCssText(styleAttr));
            }
          }
        });
      }

      await callback();

    } finally {
      // Restore standard getters and functions
      window.getComputedStyle = originalGetComputedStyle;

      // Restore all original styles
      disabledSheets.forEach(({ sheet, originalDisabled }) => {
        sheet.disabled = originalDisabled;
      });

      temporaryStyleTags.forEach((tag) => {
        if (tag.parentNode) {
          tag.parentNode.removeChild(tag);
        }
      });

      originalInlineStyles.forEach((styleAttr, el) => {
        el.setAttribute("style", styleAttr);
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
          onclone: (clonedDoc) => {
            // Sanitize cloned document inline styles for safety
            const els = clonedDoc.querySelectorAll("*");
            els.forEach((el) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.getAttribute) {
                const styleAttr = htmlEl.getAttribute("style");
                if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
                  htmlEl.setAttribute("style", sanitizeCssText(styleAttr));
                }
              }
            });
            // Patch cloned window computed styles
            const win = clonedDoc.defaultView;
            if (win) {
              const originalGetStyle = win.getComputedStyle;
              win.getComputedStyle = function (e, p) {
                const style = originalGetStyle.call(win, e, p);
                return patchComputedStyleObject(style);
              };
            }
          }
        });
        
        element.classList.remove("print-capture-mode");
        
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const pdf = new jsPDF("p", "mm", "a4");
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasRatio = canvasHeight / canvasWidth;
        
        if (canvasRatio <= 1.4142) {
          // Case 1: Content fits within A4 page aspect ratio perfectly.
          // Center it vertically.
          const imgWidth = 210;
          const imgHeight = 210 * canvasRatio;
          const topMargin = (297 - imgHeight) / 2;
          pdf.addImage(imgData, "JPEG", 0, topMargin, imgWidth, imgHeight);
        } else if (canvasRatio <= 1.75) {
          // Case 2: Content is slightly taller than A4, but fits within 1.75x ratio.
          // Scale it down slightly so the entire document fits perfectly on exactly one A4 page with zero cut-offs.
          const imgHeight = 293; // 297 minus tiny padding
          const imgWidth = imgHeight / canvasRatio;
          const leftMargin = (210 - imgWidth) / 2;
          pdf.addImage(imgData, "JPEG", leftMargin, 2, imgWidth, imgHeight);
        } else {
          // Case 3: Content is very tall (multi-page).
          // Fallback to standard multi-page rendering.
          const imgWidth = 210;
          const pageHeight = 297;
          const imgHeight = 210 * canvasRatio;
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

  return (
    <div className="space-y-6">
      {/* Printable page styling injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          html, body, #root, [class*="min-h-screen"], main, .print-container {
            display: block !important;
            background: white !important;
            color: #0f172a !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            float: none !important;
            position: relative !important;
          }
          header, nav, footer, .no-print {
            display: none !important;
          }
          
          /* CRITICAL: Bypass overflow wrappers to let tables repeat thead natively */
          .table-print-wrapper {
            display: contents !important;
            overflow: visible !important;
          }
          
          table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          
          thead {
            display: table-header-group !important;
          }
          
          tbody {
            display: table-row-group !important;
          }
          
          tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          th, td {
            display: table-cell !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
          /* Prevent page breaks inside cards, tables, panels */
          h1, h2, h3, h4, h5, h6 {
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .report-header-panel {
            background-color: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
          
          thead tr {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-bottom: 2px solid #cbd5e1 !important;
          }
          thead th {
            color: #0f172a !important;
            font-weight: 800 !important;
          }
          
          /* Fixed logo styling for native print */
          .report-logo-wrapper {
            display: block !important;
            width: 64px !important;
            height: 64px !important;
            min-width: 64px !important;
            min-height: 64px !important;
            max-width: 64px !important;
            max-height: 64px !important;
          }
          .report-logo-wrapper svg {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
          }
        }

        /* Capture mode for html2canvas to look like a premium bank statement and fit A4 beautifully */
        .print-capture-mode {
          background: #ffffff !important;
          color: #0f172a !important;
          padding: 24px 32px !important;
          border-radius: 0px !important;
          width: 800px !important;
          max-width: 800px !important;
          box-sizing: border-box !important;
        }
        .print-capture-mode * {
          text-shadow: none !important;
          box-shadow: none !important;
        }
        .print-capture-mode .report-header-panel {
          padding-bottom: 12px !important;
          margin-bottom: 12px !important;
          border-bottom-width: 1.5px !important;
          border-bottom-color: #e2e8f0 !important;
        }
        .print-capture-mode table th,
        .print-capture-mode table td {
          padding: 6px 10px !important;
          font-size: 11px !important;
        }
        .print-capture-mode .space-y-6 > * + * {
          margin-top: 12px !important;
        }
        .print-capture-mode .p-4 {
          padding: 10px 14px !important;
        }
        .print-capture-mode .p-6,
        .print-capture-mode .md\\:p-8 {
          padding: 16px !important;
        }
        .print-capture-mode .gap-6 {
          gap: 12px !important;
        }
        .print-capture-mode .gap-4 {
          gap: 10px !important;
        }
        .print-capture-mode .report-logo-wrapper {
          display: block !important;
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          min-height: 48px !important;
          max-width: 48px !important;
          max-height: 48px !important;
        }
        .print-capture-mode .report-logo-wrapper svg {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        .print-capture-mode h1 {
          font-size: 18px !important;
        }
        .print-capture-mode .text-xl,
        .print-capture-mode .md\\:text-2xl {
          font-size: 16px !important;
        }
        .print-capture-mode .text-base,
        .print-capture-mode .md\\:text-xl {
          font-size: 14px !important;
        }
        .print-capture-mode .text-sm,
        .print-capture-mode .md\\:text-base {
          font-size: 12px !important;
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
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        .print-capture-mode h1, 
        .print-capture-mode h2, 
        .print-capture-mode h3 {
          break-after: avoid-page !important;
          page-break-after: avoid !important;
        }
        .print-capture-mode tr,
        .print-capture-mode .break-inside-avoid {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
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
        className="print-container bg-white border border-slate-200 rounded-[32px] p-6 md:p-8 shadow-2xl space-y-6 max-w-4xl mx-auto text-slate-800 transition-all duration-300"
      >
        {/* Document Header Panel */}
        <div className="report-header-panel border-b-2 border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* UpToMe Logo (Inlined to prevent html2canvas external SVG load failure) */}
            <div className="report-logo-wrapper w-16 h-16 md:w-20 md:h-20 shrink-0 select-none rounded-[16px] md:rounded-[22px] overflow-hidden shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full">
                <defs>
                  <linearGradient id="repBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fd2d72" />
                    <stop offset="50%" stopColor="#ff6b2b" />
                    <stop offset="100%" stopColor="#ff9f00" />
                  </linearGradient>
                  <linearGradient id="repGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="repCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <filter id="repShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.3" />
                  </filter>
                  <clipPath id="repIconClip">
                    <rect width="512" height="512" rx="112" />
                  </clipPath>
                </defs>
                <g clipPath="url(#repIconClip)">
                  <rect width="512" height="512" fill="url(#repBgGrad)" />
                  <g filter="url(#repShadow)" transform="translate(-4, 0)">
                    <path d="M 120 100 L 120 210 C 120 275, 240 275, 240 210 L 240 100 L 265 100 L 220 40 L 175 100 L 200 100 L 200 210 C 200 235, 160 235, 160 210 L 160 100 Z" fill="#ffffff" />
                    <rect x="262" y="110" width="40" height="150" rx="10" fill="#ffffff" />
                    <circle cx="335" cy="170" r="62" fill="#ffffff" />
                    <circle cx="335" cy="170" r="32" fill="url(#repBgGrad)" />
                    <text x="335" y="181" fontFamily="'Space Grotesk', 'Outfit', 'Inter', system-ui, sans-serif" fontWeight="900" fontSize="34" fill="#ffffff" textAnchor="middle">฿</text>
                  </g>
                  <g filter="url(#repShadow)">
                    <text x="256" y="345" fontFamily="'Space Grotesk', 'Outfit', 'Inter', system-ui, sans-serif" fontWeight="800" fontSize="74" fill="#ffffff" textAnchor="middle" letterSpacing="1">ToMe</text>
                  </g>
                  <g transform="translate(165, 395) rotate(-12)">
                    <path d="M -35 -60 L -30 -65 L -25 -60 L -20 -65 L -15 -60 L -10 -65 L -5 -60 L 0 -65 L 5 -60 L 10 -65 L 15 -60 L 20 -65 L 25 -60 L 30 -65 L 35 -60 L 35 60 L -35 60 Z" fill="#ffffff" />
                    <line x1="-22" y1="-35" x2="15" y2="-35" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                    <line x1="-22" y1="-20" x2="22" y2="-20" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                    <line x1="-22" y1="-5" x2="5" y2="-5" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                  </g>
                  <g transform="translate(295, 410) rotate(8)">
                    <rect x="-60" y="-45" width="120" height="80" rx="10" fill="url(#repCardGrad)" stroke="#ffffff" strokeWidth="3" />
                    <rect x="-60" y="-22" width="120" height="15" fill="#d97706" opacity="0.7" />
                    <circle cx="45" cy="12" r="30" fill="url(#repGoldGrad)" stroke="#ffffff" strokeWidth="3" />
                    <text x="45" y="21" fontFamily="'Space Grotesk', 'Outfit', 'Inter', system-ui, sans-serif" fontWeight="900" fontSize="24" fill="#ffffff" textAnchor="middle">฿</text>
                  </g>
                  <path d="M -10 420 Q 256 465 522 420 L 522 522 L -10 522 Z" fill="#ffffff" />
                  <path d="M 10 432 Q 256 475 502 432" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 6" opacity="0.6" />
                  <circle cx="415" cy="448" r="16" fill="url(#repGoldGrad)" stroke="#ffffff" strokeWidth="3" />
                  <circle cx="415" cy="448" r="6" fill="#ffffff" />
                </g>
              </svg>
            </div>
            
            <div className="space-y-0.5">
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                รายงานการเคลื่อนไหว ประจำเดือน <span className="text-[#ff5a36]">{selectedMonth.split('-')[1]}-{selectedMonth.split('-')[0]}</span>
              </h1>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium">
                ออกรายงานเมื่อ: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} น.
              </p>
            </div>
          </div>
          
          <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">เจ้าของบัญชี</span>
            <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 inline-flex items-center gap-1.5">
              👤 {currentUser || sessionStorage.getItem("current_user") || localStorage.getItem("current_user") || "ผู้ใช้งาน"}
            </span>
          </div>
        </div>

        {/* ยอดยกมา full-width banner */}
        <div className="bg-[#fff7f5] border border-[#ffe4de] p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <span className="text-sm md:text-base font-black text-slate-700">ยอดยกมา</span>
          <span className="text-base md:text-xl font-black text-[#ff5a36] font-mono">
            {broughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Chronological running-balance daily table */}
        <div className="space-y-2">
          <div className="table-print-wrapper overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#ff007a] to-[#ff5a36] text-white font-extrabold">
                  <th className="py-3 px-3 md:py-4 md:px-4 text-center font-extrabold w-[12%]">วันที่</th>
                  <th className="py-3 px-3 md:py-4 md:px-4 font-extrabold w-[43%]">รายการ</th>
                  <th className="py-3 px-3 md:py-4 md:px-4 text-right font-extrabold w-[15%]">รายรับ</th>
                  <th className="py-3 px-3 md:py-4 md:px-4 text-right font-extrabold w-[15%]">รายจ่าย</th>
                  <th className="py-3 px-3 md:py-4 md:px-4 text-right font-extrabold w-[15%]">คงเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {renderedRows.map((item, index) => {
                  if (item.type === "ellipsis") {
                    return (
                      <tr key={`ellipsis-${index}`} className="bg-white hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 font-extrabold font-mono">:</td>
                        <td className="py-2 px-3 text-center text-slate-400 font-extrabold font-mono">:</td>
                        <td className="py-2 px-3 text-right text-slate-400 font-extrabold font-mono">:</td>
                        <td className="py-2 px-3 text-right text-slate-400 font-extrabold font-mono">:</td>
                        <td className="py-2 px-3 text-right text-slate-400 font-extrabold font-mono">:</td>
                      </tr>
                    );
                  }

                  const row = item.data!;
                  const isEven = index % 2 === 1;
                  const dayDateStr = `${selectedMonth}-${String(row.day).padStart(2, "0")}`;
                  const dayTxs = transactions.filter((tx) => tx.date === dayDateStr);
                  const transactionLabel = dayTxs.length > 0
                    ? dayTxs.map(tx => tx.category || tx.note || "รายการเคลื่อนไหว").join(", ")
                    : "-";

                  return (
                    <tr 
                      key={`row-${row.day}`} 
                      className={`${isEven ? "bg-[#fcfdfe]" : "bg-white"} hover:bg-slate-50/50 transition-colors`}
                    >
                      <td className="py-2.5 px-3 md:py-3 md:px-4 text-center font-bold text-slate-700">
                        {row.day}
                      </td>
                      <td className="py-2.5 px-3 md:py-3 md:px-4 text-slate-600 font-semibold truncate max-w-[240px]">
                        {transactionLabel}
                      </td>
                      <td className={`py-2.5 px-3 md:py-3 md:px-4 text-right font-bold ${row.income > 0 ? "text-[#00c853]" : "text-slate-400"}`}>
                        {row.income > 0 ? row.income.toFixed(2) : "0.00"}
                      </td>
                      <td className={`py-2.5 px-3 md:py-3 md:px-4 text-right font-bold ${row.expense > 0 ? "text-[#ff2d55]" : "text-slate-400"}`}>
                        {row.expense > 0 ? row.expense.toFixed(2) : "0.00"}
                      </td>
                      <td className="py-2.5 px-3 md:py-3 md:px-4 text-right font-black text-slate-800 font-mono">
                        {row.runningBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* สรุป Panel */}
        <div className="bg-[#fffcfb] border border-[#ffe4de] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs break-inside-avoid">
          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
            <div className="w-12 h-12 bg-[#ff007a]/10 border border-[#ff007a]/20 text-[#ff007a] rounded-xl flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
            </div>
            <span className="text-xl font-black text-slate-800">สรุป</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-8 justify-end text-center sm:text-right">
            <div className="border-r border-slate-100 pr-1 sm:pr-8 last:border-0">
              <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">รายรับ</span>
              <span className="text-sm md:text-xl font-black text-[#00c853] block mt-0.5">
                {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="border-r border-slate-100 pr-1 sm:pr-8 last:border-0">
              <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">รายจ่าย</span>
              <span className="text-sm md:text-xl font-black text-[#ff2d55] block mt-0.5">
                {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pr-1 sm:pr-2">
              <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">คงเหลือ</span>
              <span className="text-sm md:text-xl font-black text-[#ff5a36] block mt-0.5">
                {netRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Debt summaries blocks */}
        <div className="space-y-4 break-inside-avoid">
          {/* Liabilities Panel (หนี้สิน) */}
          <div className="bg-[#fff7f5] border border-[#ffe4de] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
              <div className="w-12 h-12 bg-[#ff5a36]/10 border border-[#ff5a36]/20 text-[#ff5a36] rounded-xl flex items-center justify-center shadow-xs">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2-.9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
              </div>
              <span className="text-xl font-black text-[#ff2d55]">หนี้สิน</span>
            </div>
            
            <div className="grid grid-cols-4 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-6 justify-end text-center sm:text-right">
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">เดิม</span>
                <span className="text-xs md:text-base font-black text-[#d97706] block mt-0.5">
                  {debtSummary.originalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">กู้ยืมใหม่</span>
                <span className="text-xs md:text-base font-black text-[#d97706] block mt-0.5">
                  {debtSummary.newBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">จ่ายแล้ว</span>
                <span className="text-xs md:text-base font-black text-[#d97706] block mt-0.5">
                  {debtSummary.paidBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pr-1 sm:pr-2">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">ค้างชำระ</span>
                <span className="text-xs md:text-base font-black text-[#d97706] block mt-0.5 font-mono">
                  {debtSummary.remainingBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Lent Panel (เงินให้กู้ยืม) */}
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
              <div className="w-12 h-12 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] rounded-xl flex items-center justify-center shadow-xs">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <span className="text-xl font-black text-[#047857]">เงินให้กู้ยืม</span>
            </div>
            
            <div className="grid grid-cols-4 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-6 justify-end text-center sm:text-right">
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">เดิม</span>
                <span className="text-xs md:text-base font-black text-[#059669] block mt-0.5">
                  {lentSummary.originalLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">ให้ยืมใหม่</span>
                <span className="text-xs md:text-base font-black text-[#059669] block mt-0.5">
                  {lentSummary.newLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-1 sm:pr-6 last:border-0">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">ได้รับคืน</span>
                <span className="text-xs md:text-base font-black text-[#059669] block mt-0.5">
                  {lentSummary.receivedLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pr-1 sm:pr-2">
                <span className="text-[10px] md:text-xs text-slate-400 font-bold block uppercase tracking-wider">ค้างรับ</span>
                <span className="text-xs md:text-base font-black text-[#059669] block mt-0.5 font-mono">
                  {lentSummary.remainingLent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Transactions List for Month (Separated clearly by Type and Colors) */}
        {(() => {
          const incomesList = monthlyTransactionsList.filter(tx => tx.type === "income");
          const expensesList = monthlyTransactionsList.filter(tx => tx.type === "expense");
          const transfersList = monthlyTransactionsList.filter(tx => tx.type === "transfer");

          return (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                📋 บันทึกรายการแบบละเอียดแยกตามรายรับ-รายจ่าย-โอนเงิน
              </h3>

              {/* 1. Incomes Table */}
              <div className="space-y-2 break-inside-avoid">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-black text-[#00c853] bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-1 rounded-md uppercase tracking-wider">
                    รายรับ 💰
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">({incomesList.length} รายการ)</span>
                </div>
                <div className="table-print-wrapper overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-4">วันเวลา</th>
                        <th className="py-2.5 px-4">หมวดหมู่</th>
                        <th className="py-2.5 px-4">รายละเอียดผู้โอน/บันทึก</th>
                        <th className="py-2.5 px-4">เข้ากระเป๋าเงิน</th>
                        <th className="py-2.5 px-4 text-right">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                      {incomesList.length > 0 ? (
                        incomesList.map((tx) => {
                          const foundWallet = wallets.find(w => w.id === tx.walletId);
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                {tx.date} {tx.time ? `(${tx.time} น.)` : ""}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#ecfdf5] text-[#047857]">
                                  {tx.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-800 font-semibold">
                                {tx.merchantName || "-"}
                                {tx.note && <span className="block text-[10px] text-slate-500 font-normal mt-0.5">📝 {tx.note}</span>}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                                {foundWallet ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{foundWallet.icon}</span>
                                    <span>{foundWallet.name}</span>
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="py-2.5 px-4 text-right font-black font-mono text-[#00c853] whitespace-nowrap">
                                +฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                            ไม่มีรายการรายรับในเดือนนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Expenses Table */}
              <div className="space-y-2 break-inside-avoid">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-black text-[#ff2d55] bg-[#fff1f2] border border-[#fecdd3] px-2.5 py-1 rounded-md uppercase tracking-wider">
                    รายจ่าย 💸
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">({expensesList.length} รายการ)</span>
                </div>
                <div className="table-print-wrapper overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-4">วันเวลา</th>
                        <th className="py-2.5 px-4">หมวดหมู่</th>
                        <th className="py-2.5 px-4">ร้านค้า/บันทึก</th>
                        <th className="py-2.5 px-4">หักจากกระเป๋าเงิน</th>
                        <th className="py-2.5 px-4 text-right">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                      {expensesList.length > 0 ? (
                        expensesList.map((tx) => {
                          const foundWallet = wallets.find(w => w.id === tx.walletId);
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                {tx.date} {tx.time ? `(${tx.time} น.)` : ""}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#fff1f2] text-[#be123c]">
                                  {tx.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-800 font-semibold">
                                {tx.merchantName || "-"}
                                {tx.note && <span className="block text-[10px] text-slate-500 font-normal mt-0.5">📝 {tx.note}</span>}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                                {foundWallet ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{foundWallet.icon}</span>
                                    <span>{foundWallet.name}</span>
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="py-2.5 px-4 text-right font-black font-mono text-[#ff2d55] whitespace-nowrap">
                                -฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                            ไม่มีรายการรายจ่ายในเดือนนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Transfers Table */}
              <div className="space-y-2 break-inside-avoid">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-black text-indigo-600 bg-[#e0e7ff] border border-[#c7d2fe] px-2.5 py-1 rounded-md uppercase tracking-wider">
                    โอนเงิน 🔄
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">({transfersList.length} รายการ)</span>
                </div>
                <div className="table-print-wrapper overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-4">วันเวลา</th>
                        <th className="py-2.5 px-4">รายละเอียด/บันทึก</th>
                        <th className="py-2.5 px-4">จากกระเป๋าเงิน</th>
                        <th className="py-2.5 px-4">ไปยังกระเป๋าเงิน</th>
                        <th className="py-2.5 px-4 text-right">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                      {transfersList.length > 0 ? (
                        transfersList.map((tx) => {
                          const fromWallet = wallets.find(w => w.id === tx.walletId);
                          const toWallet = wallets.find(w => w.id === tx.toWalletId);
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                {tx.date} {tx.time ? `(${tx.time} น.)` : ""}
                              </td>
                              <td className="py-2.5 px-4 text-slate-800 font-semibold">
                                {tx.merchantName || "-"}
                                {tx.note && <span className="block text-[10px] text-slate-500 font-normal mt-0.5">📝 {tx.note}</span>}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                                {fromWallet ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{fromWallet.icon}</span>
                                    <span>{fromWallet.name}</span>
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                                {toWallet ? (
                                  <span className="inline-flex items-center gap-1.5 text-indigo-600">
                                    <span>{toWallet.icon}</span>
                                    <span>{toWallet.name}</span>
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="py-2.5 px-4 text-right font-black font-mono text-indigo-600 whitespace-nowrap">
                                ฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                            ไม่มีรายการโอนเงินในเดือนนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}



        {/* Colored Bottom Footer Bar */}
        <div className="bg-gradient-to-r from-[#ff007a] to-[#ff5a36] text-white py-3.5 px-6 -mx-6 -mb-6 md:-mx-8 md:-mb-8 rounded-b-3xl flex items-center justify-between text-[10px] md:text-xs font-bold shadow-md select-none break-inside-avoid">
          <span>
            รายงาน ณ วันที่ {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
          </span>
          <span className="flex items-center gap-1 font-black tracking-widest uppercase text-white/90">
            UP ToMe <span className="text-amber-300">🪙</span>
          </span>
        </div>
      </div>
    </div>
  );
}
