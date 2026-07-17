import React, { useState, useEffect } from "react";
import { Coins, ShieldCheck, KeyRound, Eye, EyeOff, Sparkles, HelpCircle } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem("last_logged_in_username") || "";
  });
  const [pin, setPin] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authMode, setAuthMode] = useState<"pin" | "password">("pin");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const [isSetupMode, setIsSetupMode] = useState<boolean>(false);
  const [setupUsername, setSetupUsername] = useState<string>("");
  const [setupPin, setSetupPin] = useState<string>("");
  const [setupPinConfirm, setSetupPinConfirm] = useState<string>("");
  const [setupPassword, setSetupPassword] = useState<string>("");
  
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check if security has been configured locally or just set default username
    if (!localStorage.getItem("last_logged_in_username")) {
      setUsername("chayaphon");
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

  const verifyPin = async (pinToVerify: string) => {
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      setErrorMessage("กรุณาระบุชื่อผู้ใช้ก่อนป้อนรหัส PIN");
      setPin("");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      
      const userDocRef = doc(db, "users", trimmedUsername);
      let userSnapshot = await getDoc(userDocRef);

      // Dynamic seed for default user "chayaphon"
      if (!userSnapshot.exists() && trimmedUsername === "chayaphon") {
        const defaultUserDoc = {
          username: "chayaphon",
          pin: "01036",
          password: "Ns009935",
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultUserDoc);
        userSnapshot = await getDoc(userDocRef);
      }

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        if (userData.pin === pinToVerify) {
          setSuccessMessage("ยินดีต้อนรับกลับเข้าสู่ระบบ!");
          localStorage.setItem("last_logged_in_username", trimmedUsername);
          setTimeout(() => {
            onLoginSuccess(userData.username || trimmedUsername);
          }, 500);
        } else {
          setErrorMessage("รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
          setPin("");
        }
      } else {
        setErrorMessage(`ไม่พบบัญชีผู้ใช้ "${username}" กรุณาสร้างบัญชีใหม่ก่อนเข้าใช้งาน`);
        setPin("");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      setErrorMessage("กรุณาระบุชื่อผู้ใช้");
      return;
    }
    if (!password) {
      setErrorMessage("กรุณากรอกรหัสผ่าน");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      
      const userDocRef = doc(db, "users", trimmedUsername);
      let userSnapshot = await getDoc(userDocRef);

      // Dynamic seed for default user "chayaphon"
      if (!userSnapshot.exists() && trimmedUsername === "chayaphon") {
        const defaultUserDoc = {
          username: "chayaphon",
          pin: "01036",
          password: "Ns009935",
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultUserDoc);
        userSnapshot = await getDoc(userDocRef);
      }

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        if (userData.password === password) {
          setSuccessMessage("ลงชื่อเข้าใช้สำเร็จ!");
          localStorage.setItem("last_logged_in_username", trimmedUsername);
          setTimeout(() => {
            onLoginSuccess(userData.username || trimmedUsername);
          }, 500);
        } else {
          setErrorMessage("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        }
      } else {
        setErrorMessage(`ไม่พบบัญชีผู้ใช้ "${username}" กรุณาสร้างบัญชีใหม่ก่อนเข้าใช้งาน`);
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    const trimmedUsername = setupUsername.trim().toLowerCase();
    if (!trimmedUsername) {
      setErrorMessage("กรุณาระบุชื่อผู้ใช้");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setErrorMessage("ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น");
      return;
    }
    if (setupPin.length < 5 || setupPin.length > 6 || !/^\d+$/.test(setupPin)) {
      setErrorMessage("รหัส PIN ต้องเป็นตัวเลข 5-6 หลักเท่านั้น");
      return;
    }
    if (setupPassword.length < 6) {
      setErrorMessage("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    try {
      setIsLoading(true);
      const userDocRef = doc(db, "users", trimmedUsername);
      const userSnapshot = await getDoc(userDocRef);

      if (userSnapshot.exists()) {
        setErrorMessage(`ชื่อผู้ใช้ "${setupUsername}" ถูกใช้งานไปแล้ว กรุณาเลือกชื่ออื่น`);
        return;
      }

      const newUserDoc = {
        username: setupUsername.trim(),
        pin: setupPin,
        password: setupPassword,
        createdAt: new Date().toISOString()
      };

      await setDoc(userDocRef, newUserDoc);
      setSuccessMessage("สร้างบัญชีผู้ใช้สำเร็จแล้ว!");
      localStorage.setItem("last_logged_in_username", trimmedUsername);
      
      setTimeout(() => {
        onLoginSuccess(setupUsername.trim());
      }, 1000);
    } catch (err) {
      console.error("Setup error:", err);
      setErrorMessage("เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
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
        <div className="flex flex-col items-center text-center mb-6">
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

        {/* Setup/Signup passcode mode */}
        {isSetupMode ? (
          <div className="space-y-5">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300">
              <p className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                สมัครบัญชีผู้ใช้ใหม่ (Register New User)
              </p>
              กรุณากำหนดชื่อผู้ใช้ รหัส PIN และรหัสผ่านของคุณ เพื่อซิงค์ข้อมูลทางการเงินอย่างปลอดภัยข้ามอุปกรณ์ของคุณ
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  placeholder="ภาษาอังกฤษ ตัวเลข หรือ _ เช่น somchai"
                  className="w-full px-3 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase">
                    รหัส PIN (5-6 หลัก)
                  </label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="ตัวเลข 5-6 หลัก"
                    className="w-full px-3 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-center font-mono"
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase">
                    รหัสผ่านเข้าใช้งาน (Password)
                  </label>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="ขั้นต่ำ 6 ตัวอักษร"
                    className="w-full px-3 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>
              </div>

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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex justify-center items-center gap-1.5"
              >
                {isLoading ? "กำลังประมวลผล..." : "สมัครสมาชิกและลงชื่อเข้าใช้งาน"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSetupMode(false);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline font-medium cursor-pointer"
                >
                  ย้อนกลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Authenticate Existing User */}
            
            {/* Username input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400">
                ชื่อผู้ใช้ (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="ระบุชื่อผู้ใช้ (เช่น chayaphon)"
                className="w-full px-4 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              />
            </div>

            {/* Mode Selector */}
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
              <div className="space-y-5">
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2.5">
                    กรุณากรอกรหัส PIN (5-6 หลัก) เพื่อเข้าใช้งาน
                  </span>
                  
                  {/* Visual PIN indicator bubbles */}
                  <div className="flex justify-center gap-3 py-1.5">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const isFilled = pin.length > i;
                      return (
                        <div
                          key={i}
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
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
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleNumpadClick(num)}
                      className="h-11 rounded-xl bg-white/5 border border-white/5 text-base font-bold hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isLoading || pin.length < 5}
                    onClick={() => verifyPin(pin)}
                    className="h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-600 hover:text-white disabled:opacity-50 disabled:bg-white/5 disabled:text-slate-500 active:scale-95 transition-all text-emerald-400 cursor-pointer"
                  >
                    ตกลง
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleNumpadClick("0")}
                    className="h-11 rounded-xl bg-white/5 border border-white/5 text-base font-bold hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleBackspace}
                    className="h-11 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 active:scale-95 transition-all text-slate-400 cursor-pointer"
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
                      disabled={isLoading}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ป้อนรหัสผ่านของคุณที่นี่"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#121826] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                      required
                    />
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isLoading ? "กำลังตรวจสอบข้อมูล..." : "ลงชื่อเข้าใช้ด้วยรหัสผ่าน"}
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

            <div className="text-center pt-2.5 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsSetupMode(true);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
              >
                สมัครบัญชีผู้ใช้ใหม่ (Register New Account)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-slate-600 max-w-xs leading-relaxed">
        ข้อมูลทั้งหมดจะถูกซิงค์ผ่านเซิร์ฟเวอร์คลาวด์ Firestore ของคุณโดยตรง ปลอดภัยสูงและเชื่อมโยงได้ทุกอุปกรณ์
      </div>
    </div>
  );
}
