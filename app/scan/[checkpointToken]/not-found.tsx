export default function ScanNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-pink-50 p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">❌</div>
        <h1 className="text-xl font-bold text-pink-500 mb-3">
          ลิงก์ไม่ถูกต้อง
        </h1>
        <p className="text-gray-500 mb-2">
          QR Code นี้หมดอายุแล้ว หรือไม่ถูกต้อง
        </p>
        <p className="text-gray-400 text-sm">
          กรุณาสแกน QR Code ใหม่อีกครั้ง
        </p>
      </div>
    </div>
  );
}
