"use client";

// ============================================================
// CheckpointProgress - แสดงจุดเช็คพอยต์ 5 จุด
// ============================================================
// Completed = เขียว + เครื่องหมายถูก
// Current = ไฮไลท์ + border
// Pending = เทา
// ============================================================

interface CheckpointProgressProps {
  checkpoints: { index: number; isCompleted: boolean }[];
  currentIndex: number;
  total: number;
  completed: number;
}

export default function CheckpointProgress({
  checkpoints,
  currentIndex,
  total,
  completed,
}: CheckpointProgressProps) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <p
        className="text-sm font-bold mb-3 text-center"
        style={{ color: "var(--qr-primary)" }}
      >
        จุดเช็คพอยต์ {completed}/{total}
      </p>
      <div className="flex items-center justify-center gap-3">
        {checkpoints.map((cp) => {
          const isCurrent = cp.index === currentIndex;
          const isCompleted = cp.isCompleted;

          return (
            <div key={cp.index} className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  text-sm font-bold transition-all duration-300
                  ${isCurrent && !isCompleted ? "scale-110" : ""}
                `}
                style={{
                  backgroundColor: isCompleted
                    ? "var(--qr-correct)"
                    : isCurrent
                      ? "var(--qr-btn)"
                      : "#e0e0e0",
                  color: isCompleted || isCurrent ? "white" : "#999",
                  boxShadow: isCurrent && !isCompleted
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
                  cp.index
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
