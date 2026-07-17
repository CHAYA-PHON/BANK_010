import React, { useState, useEffect } from "react";
import { Coins, ShieldCheck, KeyRound, Eye, EyeOff, Sparkles, HelpCircle } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [pin, setPin] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authMode, setAuthMode] = useState<"pin" | "password">("pin");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSetupMode, setIsSetupMode] = useState<boolean>(false);
  const [setupPin, setSetupPin] = useState<string>("");
  const [setupPinConfirm, setSetupPinConfirm] = useState<string>("");
  const [setupPassword, setSetupPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    // Check if security has been configured
    const savedPin = localStorage.getItem("app_security_pin");
    const savedPassword = localStorage.getItem("app_security_password");
    if (!savedPin && !savedPassword) {
      setIsSetupMode(true);
    }
  }, []);

  const handleNumpadClick = (num: string) => {
    setErrorMessage("");
    if (isSetupMode) {
      if (setupPin.length < 6) {
        setSetupPin(prev => prev + num);
      } else if (setupPinConfirm.length < 6) {
        setSetupPinConfirm(prev => prev + num);
      }
    } else {
      if (pin.length < 6) {
        const newPin = pin + num;
        setPin(newPin);
        
        // Auto-submit PIN when it reaches 6 digits
        if (newPin.length === 6) {
          verifyPin(newPin);
        }
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage("");
    if (isSetupMode) {
      if (setupPinConfirm.length > 0) {
        setSetupPinConfirm(prev => prev.slice(0, -1));
      } else if (setupPin.length > 0) {
        setSetupPin(prev => prev.slice(0, -1));
      }
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setErrorMessage("");
    if (isSetupMode) {
      setSetupPin("");
      setSetupPinConfirm("");
    } else {
      setPin("");
    }
  };

  const verifyPin = (pinToVerify: string) => {
    const savedPin = localStorage.getItem("app_security_pin") || "123456"; // Default fallback
    if (pinToVerify === savedPin) {
      setSuccessMessage("ยินดีต้อนรับกลับเข้าสู่ระบบ!");
      setTimeout(() => {
        onLoginSuccess();
      }, 500);
    } else {
      setErrorMessage("รหัส PIN 6 หลักไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      setPin("");
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const savedPassword = localStorage.getItem("app_security_password");
    
    if (savedPassword) {
      if (password === savedPassword) {
        setSuccessMessage("ลงชื่อเข้าใช้สำเร็จ!");
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        setErrorMessage("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }
    } else {
      // Fallback if password isn't set, allow default "admin1234"
      if (password === "admin1234") {
        setSuccessMessage("ลงชื่อเข้าใช้ด้วยรหัสผ่านเริ่มต้นสำเร็จ!");
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        setErrorMessage("รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้นคือ admin1234)");
      }
    }
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    if (authMode === "pin") {
      if (setupPin.length !== 6 || setupPinConfirm.length !== 6) {
        setErrorMessage("กรุณากรอกรหัส PIN ให้ครบ 6 หลัก");
        return;
      }
      if (setupPin !== setupPinConfirm) {
        setErrorMessage("รหัส PIN ทั้งสองช่องไม่ตรงกัน");
        setSetupPinConfirm("");
        return;
      }
      localStorage.setItem("app_security_pin", setupPin);
      setSuccessMessage("ตั้งค่ารหัส PIN สำเร็จ!");
      setTimeout(() => {
        setIsSetupMode(false);
        setSetupPin("");
        setSetupPinConfirm("");
        setSuccessMessage("");
      }, 1000);
    } else {
      if (setupPassword.length < 6) {
        setErrorMessage("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
        return;
      }
      localStorage.setItem("app_security_password", setupPassword);
      setSuccessMessage("ตั้งค่ารหัสผ่านสำเร็จ!");
      setTimeout(() => {
        setIsSetupMode(false);
        setSetupPassword("");
        setSuccessMessage("");
      }, 1000);
    }
  };

  const skipSetup = () => {
    // Set standard defaults
    localStorage.setItem("app_security_pin", "123456");
    localStorage.setItem("app_security_password", "admin1234");
    setIsSetupMode(false);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background radial effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-white/15 rounded-3xl shadow-xl text-emerald-400 mb-4 animate-bounce">
            <Coins className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            FinanceAI Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 uppercase tracking-widest font-bold">
            ระบบบันทึกบัญชีอัจฉริยะ
          </p>
        </div>

        {/* Setup passcode mode */}
        {isSetupMode ? (
          <div className="space-y-6">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300">
              <p className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                เริ่มต้นการตั้งค่าความปลอดภัย
              </p>
              กรุณากำหนดรหัส PIN 6 หลัก หรือรหัสผ่านเพื่อใช้เข้าแอพในครั้งถัดไป เพื่อป้องกันข้อมูลทางการเงินของคุณให้ปลอดภัยสูงสุด
            </div>

            {/* Selector tabs for setup */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode("pin"); setErrorMessage(""); }}
                className={`py-2 px-3 rounded-lg transition-all ${authMode === "pin" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🔢 PIN 6 หลัก
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("password"); setErrorMessage(""); }}
                className={`py-2 px-3 rounded-lg transition-all ${authMode === "password" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🔒 รหัสผ่านตัวอักษร
              </button>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              {authMode === "pin" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {!setupPin ? "1. กำหนดรหัส PIN ใหม่ (6 หลัก)" : "2. ยืนยันรหัส PIN อีกครั้ง"}
                    </label>
                    
                    {/* Visual PIN indicator bubbles */}
                    <div className="flex justify-center gap-3 py-4">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const targetVal = setupPinConfirm.length > 0 || setupPin.length === 6 ? setupPinConfirm : setupPin;
                        const isFilled = targetVal.length > i;
                        return (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                              isFilled
                                ? "bg-indigo-500 border-indigo-400 scale-110 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                : "border-slate-600 bg-transparent"
                            }`}
                          />
                        );
                      })}
                    </div>

                    <p className="text-center text-xs text-slate-400 font-medium">
                      {!setupPin 
                        ? `กรอกตัวเลข [ ${setupPin.length}/6 ]`
                        : `ยืนยันตัวเลข [ ${setupPinConfirm.length}/6 ]`}
                    </p>
                  </div>

                  {/* Numpad */}
                  <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto pt-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleNumpadClick(num)}
                        className="h-12 rounded-xl bg-white/5 border border-white/5 text-lg font-bold hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleClear}
                      className="h-12 rounded-xl bg-white/5 text-xs font-bold hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition-all cursor-pointer text-slate-400"
                    >
                      ล้างหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadClick("0")}
                      className="h-12 rounded-xl bg-white/5 border border-white/5 text-lg font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-white"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="h-12 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-slate-400"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      กำหนดรหัสผ่าน (ขั้นต่ำ 6 ตัวอักษร)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านของคุณ"
                        className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                        required
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    บันทึกรหัสผ่านเพื่อเริ่มใช้งาน
                  </button>
                </div>
              )}

              {errorMessage && (
                <p className="text-center text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl animate-shake">
                  ⚠️ {errorMessage}
                </p>
              )}

              {successMessage && (
                <p className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                  🎉 {successMessage}
                </p>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={skipSetup}
                  className="text-[11px] text-slate-500 hover:text-slate-400 underline font-medium cursor-pointer"
                >
                  ข้ามการตั้งค่าด่วน (ใช้รหัสเริ่มต้น PIN: 123456 / รหัสผ่าน: admin1234)
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Authenticate Existing User */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode("pin"); setErrorMessage(""); setPin(""); }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${authMode === "pin" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🔢 ปลดล็อคด้วย PIN
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("password"); setErrorMessage(""); setPassword(""); }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${authMode === "password" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🔒 ปลดล็อคด้วยรหัสผ่าน
              </button>
            </div>

            {authMode === "pin" ? (
              <div className="space-y-6">
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">
                    กรุณากรอกรหัส PIN 6 หลักเพื่อเข้าใช้งาน
                  </span>
                  
                  {/* Visual PIN indicator bubbles */}
                  <div className="flex justify-center gap-3 py-2">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const isFilled = pin.length > i;
                      return (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                            isFilled
                              ? "bg-emerald-500 border-emerald-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : "border-slate-700 bg-transparent"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Tactical numpad */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadClick(num)}
                      className="h-12 rounded-xl bg-white/5 border border-white/5 text-lg font-bold hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="h-12 rounded-xl bg-white/5 text-xs font-bold hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition-all text-slate-400 cursor-pointer"
                  >
                    ล้าง
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadClick("0")}
                    className="h-12 rounded-xl bg-white/5 border border-white/5 text-lg font-bold hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-12 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 active:scale-95 transition-all text-slate-400 cursor-pointer"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    รหัสผ่านเข้าใช้งาน
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ป้อนรหัสผ่านของคุณที่นี่"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                      required
                    />
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  ลงชื่อเข้าใช้ความปลอดภัย
                </button>
              </form>
            )}

            {errorMessage && (
              <p className="text-center text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl animate-shake">
                ⚠️ {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                🎉 {successMessage}
              </p>
            )}

            <div className="text-center pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500">
              <span>PIN เริ่มต้น: <b>123456</b></span>
              <span>รหัสผ่านเริ่มต้น: <b>admin1234</b></span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-slate-600 max-w-xs leading-relaxed">
        ข้อมูลทั้งหมดจะถูกเข้ารหัสและบันทึกอยู่บนอุปกรณ์ของคุณและระบบคลาวด์ Firestore อย่างปลอดภัย
      </div>
    </div>
  );
}
