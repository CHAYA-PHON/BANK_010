import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { FileUp, Sparkles, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface SlipUploaderProps {
  onParsed: (data: any, previewUrl: string) => void;
}

export default function SlipUploader({ onParsed }: SlipUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const base64String = reader.result as string;
        // Strip the data:image/*;base64, prefix for the Gemini API
        const commaIndex = base64String.indexOf(",");
        const base64Data = base64String.substring(commaIndex + 1);

        setStatusText("AI กำลังวิเคราะห์สลิป / ใบเสร็จ...");

        const response = await fetch("/api/parse-slip", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type,
          }),
        });

        const resData = await response.json();

        if (resData.success && resData.data) {
          onParsed(resData.data, previewUrl);
        } else {
          throw new Error(resData.error || "ไม่สามารถวิเคราะห์ข้อมูลจากรูปภาพได้");
        }
      };
      reader.onerror = () => {
        throw new Error("เกิดข้อผิดพลาดในการอ่านไฟล์");
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
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
    <div id="slip-uploader-card" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-lg">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-indigo-400 rounded-xl">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-white text-base">สแกนบิลและสลิปอัตโนมัติ</h2>
          <p className="text-xs text-slate-400">อัปโหลดสลิปธนาคารหรือใบเสร็จเพื่อแยกรายรับรายจ่ายอัตโนมัติด้วย AI</p>
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
            ? "border-indigo-500 bg-indigo-500/10"
            : isLoading
            ? "border-white/10 bg-white/5 cursor-not-allowed"
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
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-200 mb-1">{statusText}</p>
            <p className="text-xs text-slate-500">ขั้นตอนนี้ใช้เวลาประมาณ 2-5 วินาที</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white/10 text-slate-300 rounded-full flex items-center justify-center mb-3 group-hover:text-white transition-colors">
              <FileUp className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1 leading-relaxed">
              <span className="text-indigo-400 font-bold">ลากรูปมาวางที่นี่</span> หรือ <span className="text-indigo-400 font-bold">คลิกเพื่อเลือกไฟล์</span>
            </p>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">รองรับสลิปธนาคาร (โอนเงินเข้า/ออก), ใบเสร็จร้านค้า และบิลต่างๆ</p>
          </div>
        )}
      </div>

      {error && (
        <div id="uploader-error" className="mt-4 p-3.5 bg-rose-500/10 text-rose-300 rounded-2xl text-xs flex items-start gap-2 border border-rose-500/20">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
