import Image from "next/image";

// ============================================================
// /result - หน้าแสดงผลคะแนน (SSR)
// ============================================================
// แสดงเมื่อ user ตอบคำถามครบทุกข้อ
// รับ query params: score, total
// ============================================================

export const dynamic = "force-dynamic";

interface ResultPageProps {
  searchParams: Promise<{ score?: string; total?: string }>;
}

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  const score = Number(params.score ?? 0);
  const total = Number(params.total ?? 10);
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  // เลือกข้อความตามคะแนน
  let message: string;
  let emoji: string;
  if (percentage >= 80) {
    message = "สุดยอดไปเลย! คุณเก่งมาก!";
    emoji = "🏆";
  } else if (percentage >= 60) {
    message = "ทำได้ดีมาก! เก่งเลย!";
    emoji = "🌟";
  } else if (percentage >= 40) {
    message = "พยายามดีแล้ว! ลองอีกครั้งนะ";
    emoji = "💪";
  } else {
    message = "ไม่เป็นไร! ลองใหม่อีกทีนะ";
    emoji = "🤗";
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-pink-50 p-6">
      <div className="text-center max-w-sm">
        {/* ตัวละคร */}
        <Image
          src={
            percentage >= 50
              ? "/assets/bunny-correct.svg"
              : "/assets/bunny-wrong.svg"
          }
          alt="Quiz Rabbit"
          width={140}
          height={175}
          className="mx-auto mb-4"
        />

        <p className="text-4xl mb-4">{emoji}</p>

        <h1 className="text-2xl font-bold text-pink-500 mb-2">
          Quiz เสร็จสิ้น!
        </h1>

        <p className="text-gray-600 mb-6">{message}</p>

        {/* การ์ดคะแนน */}
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-6">
          <p className="text-5xl font-bold text-pink-500 mb-2">
            {score}
            <span className="text-2xl text-gray-400">/{total}</span>
          </p>
          <p className="text-gray-500">คะแนนของคุณ ({percentage}%)</p>

          {/* Progress ring */}
          <div className="mt-4 flex justify-center">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#FF6B9D"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 2.51} 251`}
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>
        </div>

        <p className="text-gray-400 text-sm">
          ขอบคุณที่ร่วมเล่นกับน้องกระต่าย!
        </p>
      </div>
    </div>
  );
}
