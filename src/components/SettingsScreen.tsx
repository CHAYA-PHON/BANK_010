import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, KeyRound, Download, Upload, Trash2, LogOut, Check, Save, Sparkles, AlertTriangle, Globe, Link,
  Bell, Send, User, Users, RefreshCw, Clock, MessageSquare, Copy, Palette, Moon, Sun
} from "lucide-react";
import { Wallet, Transaction } from "../types";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface SettingsScreenProps {
  currentUser: string;
  wallets: Wallet[];
  transactions: Transaction[];
  onResetAllData: () => void;
  onLogout: () => void;
  onImportBackup: (data: { wallets: Wallet[]; transactions: Transaction[] }) => void;
  theme?: "dark" | "light";
  setTheme?: (t: "dark" | "light") => void;
  accentColor?: string;
  setAccentColor?: (c: string) => void;
}

export default function SettingsScreen({
  currentUser,
  wallets,
  transactions,
  onResetAllData,
  onLogout,
  onImportBackup,
  theme = "dark",
  setTheme = () => {},
  accentColor = "indigo",
  setAccentColor = () => {},
}: SettingsScreenProps) {
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPinMode, setIsPinMode] = useState(true);
  
  const [pinStatus, setPinStatus] = useState({ success: "", error: "" });
  const [passwordStatus, setPasswordStatus] = useState({ success: "", error: "" });
  const [exportStatus, setExportStatus] = useState("");

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [personalApiKey, setPersonalApiKey] = useState("");
  const [apiStatus, setApiStatus] = useState("");

  const lineUseMessagingApi = true; // LINE Notify is dead
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [lineSendType, setLineSendType] = useState<"push" | "broadcast">("broadcast");
  const [lineStatus, setLineStatus] = useState({ success: "", error: "" });
  const [isTestingLine, setIsTestingLine] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app_api_base_url") || "";
    setApiBaseUrl(saved);
    const savedKey = localStorage.getItem("app_personal_gemini_api_key") || "";
    setPersonalApiKey(savedKey);

    const savedChannelToken = localStorage.getItem("app_line_channel_access_token") || "";
    setLineChannelAccessToken(savedChannelToken);
    const savedUserId = localStorage.getItem("app_line_user_id") || "";
    setLineUserId(savedUserId);
    const savedSendType = (localStorage.getItem("app_line_send_type") as "push" | "broadcast") || "broadcast";
    setLineSendType(savedSendType);

    async function loadFirestoreLineConfig() {
      if (currentUser) {
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.lineChannelAccessToken) {
              setLineChannelAccessToken(data.lineChannelAccessToken);
              localStorage.setItem("app_line_channel_access_token", data.lineChannelAccessToken);
            }
            if (data.lineUserId) {
              setLineUserId(data.lineUserId);
              localStorage.setItem("app_line_user_id", data.lineUserId);
            }
            if (data.lineSendType) {
              setLineSendType(data.lineSendType);
              localStorage.setItem("app_line_send_type", data.lineSendType);
            }
          }
        } catch (err) {
          console.error("Error loading LINE config from Firestore:", err);
        }
      }
    }
    loadFirestoreLineConfig();
  }, [currentUser]);

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_api_base_url", apiBaseUrl.trim());
    localStorage.setItem("app_personal_gemini_api_key", personalApiKey.trim());
    setApiStatus("บันทึกการตั้งค่าเชื่อมต่อเรียบร้อยแล้ว!");
    setTimeout(() => setApiStatus(""), 3000);
  };

  const handleSaveLineSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_line_use_messaging_api", "true");
    localStorage.setItem("app_line_channel_access_token", lineChannelAccessToken.trim());
    localStorage.setItem("app_line_user_id", lineUserId.trim());
    localStorage.setItem("app_line_send_type", lineSendType);

    // Silently register the token on the server
    import("../lib/api").then(({ getApiUrl }) => {
      fetch(getApiUrl("/api/send-line-message"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelAccessToken: lineChannelAccessToken.trim(), message: "", sendType: "broadcast" })
      }).catch(e => console.log("Silent seed error:", e));
    }).catch(e => console.log("Import error:", e));

    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
        await setDoc(userDocRef, {
          lineChannelAccessToken: lineChannelAccessToken.trim(),
          lineUserId: lineUserId.trim(),
          lineSendType: lineSendType,
          lineAutoSummaryEnabled: true,
        }, { merge: true });
      } catch (err) {
        console.error("Error saving LINE settings to Firestore:", err);
      }
    }

    setLineStatus({ success: "บันทึกข้อมูลตั้งค่า LINE Bot (Messaging API) สำเร็จเรียบร้อย!", error: "" });
    setTimeout(() => setLineStatus({ success: "", error: "" }), 4000);
  };

  const handleTestLineNotify = async () => {
    setLineStatus({ success: "", error: "" });
    setIsTestingLine(true);
    
    try {
      if (!lineChannelAccessToken.trim()) {
        setLineStatus({ success: "", error: "กรุณาระบุ Channel Access Token ก่อนทดสอบ" });
        setIsTestingLine(false);
        return;
      }
      if (lineSendType === "push" && !lineUserId.trim()) {
        setLineStatus({ success: "", error: "กรุณาระบุ User ID สำหรับการส่งแบบเฉพาะเจาะจง (Push)" });
        setIsTestingLine(false);
        return;
      }

      const { sendLineMessage } = await import("../lib/api");
      await sendLineMessage(
        lineChannelAccessToken.trim(),
        lineUserId.trim(),
        "\n🤖 ทดสอบระบบแจ้งเตือน FinanceAI (Messaging API)\nเชื่อมต่อกับ LINE Bot เรียบร้อยแล้ว! 🎉",
        lineSendType
      );
      setLineStatus({ success: `ส่งข้อความทดสอบแบบ ${lineSendType === "broadcast" ? "ส่งทุกคน" : "ระบุผู้รับ"} สำเร็จแล้ว!`, error: "" });
    } catch (err: any) {
      setLineStatus({ success: "", error: err.message || "ส่งล้มเหลว กรุณาตรวจสอบความถูกต้องของการตั้งค่า" });
    } finally {
      setIsTestingLine(false);
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus({ success: "", error: "" });

    if (newPin.length < 5 || newPin.length > 6 || isNaN(Number(newPin))) {
      setPinStatus({ success: "", error: "รหัส PIN ต้องเป็นตัวเลข 5-6 หลัก" });
      return;
    }

    if (newPin !== newPinConfirm) {
      setPinStatus({ success: "", error: "รหัส PIN ยืนยันไม่ตรงกัน" });
      return;
    }

    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
        await setDoc(userDocRef, { pin: newPin }, { merge: true });
      }
      localStorage.setItem("app_security_pin", newPin);
      setPinStatus({ success: "เปลี่ยนรหัส PIN สำเร็จแล้ว!", error: "" });
      setNewPin("");
      setNewPinConfirm("");
    } catch (err) {
      console.error("Error updating PIN in Firestore:", err);
      setPinStatus({ success: "", error: "ไม่สามารถเปลี่ยนรหัส PIN บนคลาวด์ได้ กรุณาลองใหม่อีกครั้ง" });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ success: "", error: "" });

    if (newPassword.length < 6) {
      setPasswordStatus({ success: "", error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }

    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.toLowerCase().trim());
        await setDoc(userDocRef, { password: newPassword }, { merge: true });
      }
      localStorage.setItem("app_security_password", newPassword);
      setPasswordStatus({ success: "เปลี่ยนรหัสผ่านสําเร็จแล้ว!", error: "" });
      setNewPassword("");
    } catch (err) {
      console.error("Error updating password in Firestore:", err);
      setPasswordStatus({ success: "", error: "ไม่สามารถเปลี่ยนรหัสผ่านบนคลาวด์ได้ กรุณาลองใหม่อีกครั้ง" });
    }
  };

  const handleExportJSON = () => {
    try {
      const backupData = {
        wallets,
        transactions,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute(
        "download",
        `FinanceAI_Backup_${new Date().toISOString().split("T")[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setExportStatus("ส่งออกข้อมูล JSON สำเร็จ!");
      setTimeout(() => setExportStatus(""), 3000);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const handleExportCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Thai encoding in Excel
      csvContent += "วันที่,เวลา,ประเภท,จำนวนเงิน,หมวดหมู่,ชื่อร้านค้า/รายละเอียด,กระเป๋าเงิน,บันทึก\n";

      transactions.forEach((tx) => {
        const walletName = wallets.find((w) => w.id === tx.walletId)?.name || "ทั่วไป";
        const row = [
          tx.date,
          tx.time || "",
          tx.type === "income" ? "รายรับ" : tx.type === "expense" ? "รายจ่าย" : "โอนเงิน",
          tx.amount,
          tx.category,
          `"${tx.merchantName.replace(/"/g, '""')}"`,
          `"${walletName.replace(/"/g, '""')}"`,
          `"${(tx.note || "").replace(/"/g, '""')}"`,
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", encodedUri);
      downloadAnchor.setAttribute(
        "download",
        `FinanceAI_Transactions_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setExportStatus("ส่งออกรายงาน CSV สำเร็จ!");
      setTimeout(() => setExportStatus(""), 3000);
    } catch (err) {
      console.error("CSV Export error:", err);
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.wallets) && Array.isArray(parsed.transactions)) {
          if (confirm("คุณต้องการเขียนทับข้อมูลปัจจุบันด้วยข้อมูลจากไฟล์สำรองใช่หรือไม่?")) {
            onImportBackup({
              wallets: parsed.wallets,
              transactions: parsed.transactions,
            });
            alert("นำเข้าข้อมูลสำรองเรียบร้อยแล้ว!");
          }
        } else {
          alert("รูปแบบไฟล์สำรองไม่ถูกต้อง");
        }
      } catch (err) {
        alert("ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ .json สำรองที่ถูกต้อง");
      }
    };
    fileReader.readAsText(file);
  };

  const confirmReset = () => {
    if (
      confirm(
        "⚠️ คำเตือน: คุณต้องการลบข้อมูลทั้งหมดในแอพและเริ่มบันทึกใหม่ตั้งแต่ต้นใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้!"
      )
    ) {
      onResetAllData();
      alert("ล้างข้อมูลทั้งหมดเสร็จเรียบร้อยแล้ว");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-center pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            ⚙️ ระบบตั้งค่า (Settings & Security)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            จัดการระบบความปลอดภัย สำรองข้อมูล และควบคุมบัญชีของคุณ
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          ล็อคหน้าจอ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Security Settings Section */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            แก้ไขระบบปลดล็อคและรหัสความปลอดภัย
          </h3>

          <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold">
            <button
              onClick={() => setIsPinMode(true)}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${isPinMode ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              แก้ไข PIN (5-6 หลัก)
            </button>
            <button
              onClick={() => setIsPinMode(false)}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${!isPinMode ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              แก้ไขรหัสผ่าน
            </button>
          </div>

          {isPinMode ? (
            <form onSubmit={handlePinChange} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">PIN ใหม่ (5-6 หลัก)</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="เลข 5-6 หลัก"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">ยืนยัน PIN อีกครั้ง</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPinConfirm}
                    onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ""))}
                    placeholder="เลข 5-6 หลัก"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {pinStatus.error && <p className="text-[10px] font-bold text-rose-400">{pinStatus.error}</p>}
              {pinStatus.success && <p className="text-[10px] font-bold text-emerald-400">{pinStatus.success}</p>}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                บันทึก PIN ใหม่
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
                  required
                />
              </div>

              {passwordStatus.error && <p className="text-[10px] font-bold text-rose-400">{passwordStatus.error}</p>}
              {passwordStatus.success && <p className="text-[10px] font-bold text-emerald-400">{passwordStatus.success}</p>}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                บันทึกรหัสผ่านใหม่
              </button>
            </form>
          )}
        </div>

        {/* Data Management & Backup */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
            <Download className="w-4 h-4 text-emerald-400" />
            สำรองข้อมูลและรายงานการเงิน
          </h3>

          <div className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              คุณสามารถส่งออกประวัติการเงินของคุณทั้งหมดเพื่อเก็บสำรองไว้ หรือนำกลับเข้ามาใช้งานเมื่อเปลี่ยนอุปกรณ์
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportJSON}
                className="py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                สำรองไฟล์ (.json)
              </button>
              <button
                onClick={handleExportCSV}
                className="py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                รายงานเอ็กเซล (.csv)
              </button>
            </div>

            <div className="pt-2">
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-2">นำเข้าไฟล์สำรองข้อมูล (.json)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackupFile}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-full py-2 bg-indigo-500/10 border border-dashed border-indigo-500/20 text-indigo-300 rounded-xl text-center text-xs font-bold hover:bg-indigo-500/15 transition-all">
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" />
                  เลือกไฟล์สำรองข้อมูลเพื่อนำเข้า
                </div>
              </div>
            </div>

            {exportStatus && (
              <p className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 p-2 rounded-xl animate-fade-in">
                {exportStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Theme & Styling Customization Section */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
          <Palette className="w-4 h-4 text-emerald-400" />
          ระบบตั้งค่าธีมและสีแอป (Theme & Style Customization)
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          เลือกรูปแบบ UI และโทนสีหลักที่คุณต้องการสำหรับแอปพลิเคชันของคุณ เพื่อประสบการณ์การบันทึกบัญชีที่ถูกใจที่สุด
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Theme Selector (Dark/Light) */}
          <div className="space-y-3">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              รูปแบบสีหน้าจอ (Interface Mode)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTheme("dark");
                  localStorage.setItem("app_theme", "dark");
                }}
                className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  theme === "dark"
                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5"
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
                }`}
              >
                <div className="p-1.5 bg-black/40 rounded-lg text-indigo-400">
                  <Moon className="w-4 h-4" />
                </div>
                <span>ธีมมืด (Dark Mode)</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setTheme("light");
                  localStorage.setItem("app_theme", "light");
                }}
                className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  theme === "light"
                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 shadow-md shadow-indigo-500/5"
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
                }`}
              >
                <div className="p-1.5 bg-white rounded-lg text-amber-500 shadow-sm">
                  <Sun className="w-4 h-4" />
                </div>
                <span>ธีมสว่าง (Light Mode)</span>
              </button>
            </div>
          </div>

          {/* Accent Color Selection */}
          <div className="space-y-3">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              โทนสีหลักของแอป (App Accent Color)
            </span>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "indigo", name: "คราม (Indigo)", color: "bg-indigo-500" },
                { id: "emerald", name: "มรกต (Emerald)", color: "bg-emerald-500" },
                { id: "teal", name: "ฟ้าอมเขียว (Teal)", color: "bg-teal-500" },
                { id: "rose", name: "ชมพูกุหลาบ (Rose)", color: "bg-rose-500" },
                { id: "violet", name: "ม่วง (Violet)", color: "bg-violet-500" },
                { id: "amber", name: "ทองคำ (Amber)", color: "bg-amber-500" },
              ].map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => {
                    setAccentColor(accent.id);
                    localStorage.setItem("app_accent_color", accent.id);
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-[10px] font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    accentColor === accent.id
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${accent.color} ring-2 ring-white/10`} />
                  <span>{accent.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Backend API Connection Setting */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          ตั้งค่าการวิเคราะห์ AI (AI & Connection Settings)
        </h3>
        
        <p className="text-xs text-slate-300 leading-relaxed">
          เพิ่มความยืดหยุ่นในการใช้งาน AI ทั้งบนเซิร์ฟเวอร์และการทำงานโดยตรงในบราวเซอร์ของคุณเอง
        </p>
        
        <form onSubmit={handleSaveApiUrl} className="space-y-4">
          {/* Personal Gemini API Key option for client side fallback */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-indigo-400" />
              Gemini API Key ส่วนตัว (Personal API Key)
            </label>
            <input
              type="password"
              value={personalApiKey}
              onChange={(e) => setPersonalApiKey(e.target.value)}
              placeholder="AIzaSy... (เว้นว่างไว้หากต้องการใช้เซิร์ฟเวอร์เริ่มต้น)"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              💡 **สำหรับโฮสต์ภายนอก (เช่น Vercel):** การใส่ API Key ส่วนตัวนี้จะช่วยให้คุณสามารถใช้ฟีเจอร์ **สแกนสลิป** และ **ที่ปรึกษา AI วิเคราะห์รายจ่าย** ได้โดยตรงจากเบราว์เซอร์ของคุณ โดยไม่ผ่านเซิร์ฟเวอร์หลังบ้าน ปลอดภัยสูง (ข้อมูลจะเก็บไว้แค่ในเครื่องของคุณ)
            </p>
          </div>

          <div className="border-t border-white/5 pt-3">
            <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1">
              <Link className="w-3 h-3 text-indigo-400" />
              ลิงก์เซิร์ฟเวอร์หลังบ้าน API (Backend Base URL)
            </label>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://ais-pre-...run.app (หรือเว้นว่างไว้เพื่อใช้โฮสต์ปัจจุบัน)"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              *ตัวอย่างลิงก์หลังบ้านของคุณ: <span className="text-indigo-400 font-mono select-all">https://ais-pre-vzwnta4t5vklyptliik43g-446396597239.asia-east1.run.app</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              บันทึกการตั้งค่าระบบ AI
            </button>
          </div>

          {apiStatus && (
            <p className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 p-2.5 rounded-xl animate-fade-in text-center">
              {apiStatus}
            </p>
          )}
        </form>
      </div>

      {/* LINE Notification Setting Section */}
      <div id="line-notify-settings" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Bell className="w-5 h-5 text-emerald-400 animate-bounce" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ตั้งค่าสรุปค่าใช้จ่ายทาง LINE Bot (Messaging API)
            </h3>
            <p className="text-[11px] text-slate-400">ส่งรายงานสรุปรายรับ-รายจ่ายรายวันเข้า LINE แชทส่วนตัวหรือกลุ่มผ่านบอทส่วนตัว</p>
          </div>
        </div>

        <form onSubmit={handleSaveLineSettings} className="space-y-4">
          <div className="space-y-4 text-xs">
            {/* Channel Access Token Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <Link className="w-3 h-3 text-emerald-400" />
                Channel Access Token (Long-Lived)
              </label>
              <input
                type="password"
                value={lineChannelAccessToken}
                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                placeholder="กรอก Channel Access Token ของบอท LINE"
                className="w-full px-3 py-2.5 bg-[#090d16] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-hidden text-sm"
              />
            </div>

            {/* Send Type Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold uppercase">
                รูปแบบผู้รับปลายทาง (Send Type)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLineSendType("broadcast")}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                    lineSendType === "broadcast" 
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300" 
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  ส่งทุกคนที่เป็นเพื่อน (Broadcast)
                </button>
                <button
                  type="button"
                  onClick={() => setLineSendType("push")}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                    lineSendType === "push" 
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300" 
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  ส่งเฉพาะคน / กลุ่มแชท (Push Message)
                </button>
              </div>
            </div>

            {/* Specific Target User/Group ID */}
            {lineSendType === "push" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-400" />
                  รหัสผู้รับปลายทาง (User ID หรือ Group ID)
                </label>
                <input
                  type="text"
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  placeholder="เช่น Ue1234567890abcdef..."
                  className="w-full px-3 py-2.5 bg-[#090d16] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-hidden text-sm"
                />
              </div>
            )}



            {/* Help guidelines */}
            <div className="text-[10px] text-slate-500 leading-relaxed space-y-1.5 bg-white/5 p-3 rounded-xl border border-white/5">
              <p className="font-semibold text-slate-400">💡 วิธีการเปิดการแจ้งเตือน LINE Bot (Messaging API) สำเร็จรูป:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                <li>ไปที่เว็บบราวเซอร์เปิด <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-semibold">LINE Developers Console</a> และล็อคอิน</li>
                <li>สร้าง Provider จากนั้นสร้าง Channel ใหม่ เลือกหัวข้อเป็น **Messaging API**</li>
                <li>ไปที่แท็บ **Messaging API** และสแกนคิวอาร์โค้ดบอทเป็นเพื่อนกับคุณ</li>
                <li>เลื่อนลงด้านล่างสุดของหน้าจอแท็บนั้น กดออกตั๋ว (Issue) **Channel Access Token** คัดลอกมาวางในหน้าจอนี้ได้ทันที</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleTestLineNotify}
              disabled={isTestingLine}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10 shadow-md ${
                isTestingLine 
                  ? "bg-slate-700 text-slate-400" 
                  : "bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              {isTestingLine ? "กำลังส่งทดสอบ..." : "ส่งข้อความทดสอบเข้า LINE"}
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              บันทึกการตั้งค่า LINE
            </button>
          </div>

          {(lineStatus.success || lineStatus.error) && (
            <p className={`text-xs font-bold p-2.5 rounded-xl animate-fade-in text-center border ${
              lineStatus.success 
                ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20" 
                : "text-rose-400 bg-rose-500/15 border-rose-500/20"
            }`}>
              {lineStatus.success || lineStatus.error}
            </p>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-500/5 border border-rose-500/10 rounded-3xl p-6 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2 pb-2 border-b border-rose-500/10">
          <AlertTriangle className="w-4 h-4" />
          พื้นที่อันตราย (Danger Zone)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          หากล้างข้อมูล ประวัติรายการเงิน และบัญชีกระเป๋าตังค์ของคุณที่เก็บสะสมไว้จะถูกลบทั้งหมดอย่างถาวรจากทั้งพื้นที่เก็บข้อมูลจำลองของเครื่อง (Local Storage) และฐานข้อมูลระบบคลาวด์ Firestore
        </p>
        <button
          onClick={confirmReset}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          ล้างลบข้อมูลแอพทั้งหมดแบบถาวร
        </button>
      </div>
    </div>
  );
}
