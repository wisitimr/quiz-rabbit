// ============================================================
// หน้าแรก - Landing page (SSR)
// ============================================================

export default function HomePage() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-6"
      style={{
        background: "linear-gradient(135deg, #FFF5E4 0%, #FFE4EC 100%)",
      }}
    >
      <div className="text-center max-w-md">
        {/* หัวข้อ */}
        <h1 className="text-3xl font-bold text-pink-500 mb-3">
          Quiz Rabbit
        </h1>
        <p className="text-gray-600 mb-8">
          สแกน QR Code ตาม 5 จุดเช็คพอยต์
          <br />
          ตอบคำถามให้ครบ แลกรางวัล!
        </p>

        {/* คำแนะนำ */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h2 className="font-bold text-pink-500 mb-4">วิธีเล่น</h2>
          <ol className="text-left text-gray-600 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                1
              </span>
              <span>สแกน QR Code ที่จุดเช็คพอยต์</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                2
              </span>
              <span>ตอบคำถาม 1 ข้อให้ถูกต้อง</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                3
              </span>
              <span>ไปสแกนจุดถัดไป จนครบ 5 จุด</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                4
              </span>
              <span>รับ QR Code แลกรางวัล!</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
