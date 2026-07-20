import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { FileUp, Sparkles, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { parseSlipWithFallback } from "../lib/api";

interface SlipUploaderProps {
  onParsed: (data: any, previewUrl: string) => void;
  theme?: "dark" | "light";
}

export default function SlipUploader({ onParsed, theme = "dark" }: SlipUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLight = theme === "light";

  const processFile = async (file: File) => {
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPEG, WEBP)");
      return;
    }

    // Limit size to 5MB for parsing
    if (file.size > 5 * 1024 * 1024) {
      setError("ขนาดไฟล์ใหญ่เกินไป กรุณาอัปโหลดรูปที่มีขนาดไม่เกิน 5MB");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusText("กำลังอ่านรูปภาพ...");

    // Create a local preview URL
    const previewUrl = URL.createObjectURL(file);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;
          // Strip the data:image/*;base64, prefix for the Gemini API
          const commaIndex = base64String.indexOf(",");
          const base64Data = base64String.substring(commaIndex + 1);

          setStatusText("AI กำลังวิเคราะห์สลิป / ใบเสร็จ...");

          const result = await parseSlipWithFallback(base64Data, file.type, setStatusText);
          onParsed(result, previewUrl);
        } catch (err: any) {
          console.error("FileReader onload error:", err);
          setError(err.message || "เกิดข้อผิดพลาดในการวิเคราะห์สลิป");
        } finally {
          setIsLoading(false);
          setStatusText("");
        }
      };
      reader.onerror = () => {
        setError("เกิดข้อผิดพลาดในการอ่านไฟล์");
        setIsLoading(false);
        setStatusText("");
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      setIsLoading(false);
      setStatusText("");
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      id="slip-uploader-card" 
      className={`backdrop-blur-md rounded-3xl p-6 shadow-lg transition-all duration-200 ${
        isLight 
          ? "bg-white border border-slate-200/80 shadow-slate-100/50" 
          : "bg-white/5 border border-white/10"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-2.5 backdrop-blur-md border rounded-xl transition-all duration-200 ${
          isLight 
            ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
            : "bg-white/10 border border-white/20 text-indigo-400"
        }`}>
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className={`font-bold text-base transition-colors ${
            isLight ? "text-slate-800" : "text-white"
          }`}>
            สแกนบิลและสลิปอัตโนมัติ
          </h2>
          <p className={`text-xs transition-colors ${
            isLight ? "text-slate-500" : "text-slate-400"
          }`}>
            อัปโหลดสลิปธนาคารหรือใบเสร็จเพื่อแยกรายรับรายจ่ายอัตโนมัติด้วย AI
          </p>
        </div>
      </div>

      <div
        id="drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
          isDragActive
            ? isLight
              ? "border-indigo-500 bg-indigo-50"
              : "border-indigo-500 bg-indigo-500/10"
            : isLoading
            ? isLight
              ? "border-slate-200 bg-slate-50/50 cursor-not-allowed"
              : "border-white/10 bg-white/5 cursor-not-allowed"
            : isLight
            ? "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
            : "border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10"
        }`}
        onClick={isLoading ? undefined : onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center text-center py-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <p className={`text-sm font-medium mb-1 ${
              isLight ? "text-slate-700" : "text-slate-200"
            }`}>{statusText}</p>
            <p className={`text-xs ${
              isLight ? "text-slate-400" : "text-slate-500"
            }`}>ขั้นตอนนี้ใช้เวลาประมาณ 2-5 วินาที</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
              isLight 
                ? "bg-indigo-50 text-indigo-600" 
                : "bg-white/10 text-slate-300 group-hover:text-white"
            }`}>
              <FileUp className={`w-6 h-6 ${isLight ? "text-indigo-600" : "text-white"}`} />
            </div>
            <p className={`text-sm font-medium mb-1 leading-relaxed ${
              isLight ? "text-slate-600" : "text-slate-300"
            }`}>
              <span className="text-indigo-600 font-bold">ลากรูปมาวางที่นี่</span> หรือ <span className="text-indigo-600 font-bold">คลิกเพื่อเลือกไฟล์</span>
            </p>
            <p className={`text-xs max-w-sm leading-relaxed ${
              isLight ? "text-slate-400" : "text-slate-400"
            }`}>รองรับสลิปธนาคาร (โอนเงินเข้า/ออก), ใบเสร็จร้านค้า และบิลต่างๆ</p>
          </div>
        )}
      </div>

      {error && (
        <div 
          id="uploader-error" 
          className={`mt-4 p-3.5 rounded-2xl text-xs flex items-start gap-2 border transition-all duration-200 ${
            isLight
              ? "bg-rose-50 border-rose-100 text-rose-600 shadow-xs"
              : "bg-rose-500/10 text-rose-300 border-rose-500/20"
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="whitespace-pre-line leading-relaxed">{error}</span>
        </div>
      )}
    </div>
  );
}
