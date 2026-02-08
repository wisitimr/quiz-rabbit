import Image from "next/image";

// ============================================================
// หน้าแรก - Landing page (SSR)
// ============================================================
// หน้านี้เป็น Server Component (default)
// ไม่ต้องใช้ interactivity จึงไม่ต้อง "use client"
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
        {/* ตัวละคร */}
        <div className="mb-6">
          <Image
            src="/assets/bunny-idle.svg"
            alt="Quiz Rabbit"
            width={160}
            height={200}
            priority
          />
        </div>

        {/* หัวข้อ */}
        <h1 className="text-3xl font-bold text-pink-500 mb-3">
          Quiz Rabbit
        </h1>
        <p className="text-gray-600 mb-8">
          สแกน QR Code เพื่อเริ่มเล่นเกมตอบคำถาม
          <br />
          กับน้องกระต่ายกันเถอะ!
        </p>

        {/* คำแนะนำ */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h2 className="font-bold text-pink-500 mb-4">วิธีเล่น</h2>
          <ol className="text-left text-gray-600 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                1
              </span>
              <span>เปิดแอป LINE แล้วสแกน QR Code</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                2
              </span>
              <span>ตอบคำถาม 10 ข้อ (เลือกจาก 4 ตัวเลือก)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                3
              </span>
              <span>คำถามจะถูกสุ่มไม่ซ้ำกันในแต่ละรอบ</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs">
                4
              </span>
              <span>ดูคะแนนรวมเมื่อตอบครบทุกข้อ</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
