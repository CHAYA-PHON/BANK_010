import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, KeyRound, Download, Upload, Trash2, LogOut, Check, Save, Sparkles, AlertTriangle, Globe, Link
} from "lucide-react";
import { Wallet, Transaction } from "../types";

interface SettingsScreenProps {
  wallets: Wallet[];
  transactions: Transaction[];
  onResetAllData: () => void;
  onLogout: () => void;
  onImportBackup: (data: { wallets: Wallet[]; transactions: Transaction[] }) => void;
}

export default function SettingsScreen({
  wallets,
  transactions,
  onResetAllData,
  onLogout,
  onImportBackup,
}: SettingsScreenProps) {
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPinMode, setIsPinMode] = useState(true);
  
  const [pinStatus, setPinStatus] = useState({ success: "", error: "" });
  const [passwordStatus, setPasswordStatus] = useState({ success: "", error: "" });
  const [exportStatus, setExportStatus] = useState("");

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiStatus, setApiStatus] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("app_api_base_url") || "";
    setApiBaseUrl(saved);
  }, []);

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_api_base_url", apiBaseUrl.trim());
    setApiStatus("บันทึกลิงก์เซิร์ฟเวอร์หลังบ้านสำเร็จแล้ว!");
    setTimeout(() => setApiStatus(""), 3000);
  };

  const handlePinChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus({ success: "", error: "" });

    if (newPin.length !== 6 || isNaN(Number(newPin))) {
      setPinStatus({ success: "", error: "รหัส PIN ต้องเป็นตัวเลข 6 หลัก" });
      return;
    }

    if (newPin !== newPinConfirm) {
      setPinStatus({ success: "", error: "รหัส PIN ยืนยันไม่ตรงกัน" });
      return;
    }

    localStorage.setItem("app_security_pin", newPin);
    setPinStatus({ success: "เปลี่ยนรหัส PIN 6 หลักสำเร็จแล้ว!", error: "" });
    setNewPin("");
    setNewPinConfirm("");
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ success: "", error: "" });

    if (newPassword.length < 6) {
      setPasswordStatus({ success: "", error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }

    localStorage.setItem("app_security_password", newPassword);
    setPasswordStatus({ success: "เปลี่ยนรหัสผ่านสําเร็จแล้ว!", error: "" });
    setNewPassword("");
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
              แก้ไข PIN 6 หลัก
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
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">PIN ใหม่ 6 หลัก</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="เลข 6 หลัก"
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
                    placeholder="เลข 6 หลัก"
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

      {/* Backend API Connection Setting */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
          <Globe className="w-4 h-4 text-indigo-400" />
          เชื่อมโยงเซิร์ฟเวอร์หลังบ้าน (Backend API Connection)
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          หากคุณนำแอปพลิเคชันนี้ไปติดตั้งและใช้งานบนแพลตฟอร์มภายนอก (เช่น <strong>Vercel</strong>, <strong>Netlify</strong> หรือเว็บโฮสติ้งอื่นๆ) 
          คุณจำเป็นต้องนำลิงก์ปลายทางของระบบหลังบ้าน (Cloud Run/Express API) จาก AI Studio มาใส่ที่นี่ เพื่อให้ระบบ AI ทำงานประสานกันได้อย่างสมบูรณ์
        </p>
        
        <form onSubmit={handleSaveApiUrl} className="space-y-4">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1">
              <Link className="w-3 h-3 text-indigo-400" />
              ลิงก์เซิร์ฟเวอร์หลังบ้าน API (Backend Base URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://ais-pre-...run.app (หรือเว้นว่างไว้เพื่อใช้โฮสต์ปัจจุบัน)"
                className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
              >
                บันทึกค่า
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              *ตัวอย่างลิงก์สำหรับแอปของคุณ: <span className="text-indigo-400 font-mono select-all">https://ais-pre-vzwnta4t5vklyptliik43g-446396597239.asia-east1.run.app</span>
            </p>
          </div>

          {apiStatus && (
            <p className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 p-2.5 rounded-xl animate-fade-in text-center">
              {apiStatus}
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
