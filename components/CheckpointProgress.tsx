"use client";

// ============================================================
// CheckpointProgress - แสดงความคืบหน้าสะสม
// ============================================================
// แสดง total ช่อง: ช่องที่สะสมแล้ว = เขียว ✓, ช่องปัจจุบัน = ไฮไลท์, ที่เหลือ = เทา
// ไม่ผูกกับเลขจุดเช็คพอยต์ — สแกนจุดไหนก่อนก็ได้
// ============================================================

interface CheckpointProgressProps {
  total: number;
  completed: number;
  /** true เมื่อกำลังอยู่ที่จุดที่ยังไม่ผ่าน (แสดง current highlight) */
  showCurrent?: boolean;
}

export default function CheckpointProgress({
  total,
  completed,
  showCurrent = false,
}: CheckpointProgressProps) {
  const slots = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="w-full max-w-sm mx-auto">
      <p
        className="text-sm font-bold mb-3 text-center"
        style={{ color: "var(--qr-primary)" }}
      >
        จุดเช็คพอยต์ {completed}/{total}
      </p>
      <div className="flex items-center justify-center gap-3">
        {slots.map((i) => {
          const isCompleted = i < completed;
          const isCurrent = showCurrent && i === completed;

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  text-sm font-bold transition-all duration-300
                  ${isCurrent ? "scale-110" : ""}
                `}
                style={{
                  backgroundColor: isCompleted
                    ? "var(--qr-correct)"
                    : isCurrent
                      ? "var(--qr-btn)"
                      : "#e0e0e0",
                  color: isCompleted || isCurrent ? "white" : "#999",
                  boxShadow: isCurrent
                    ? "0 0 0 3px var(--qr-shadow)"
                    : "none",
                }}
              >
                {isCompleted ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
