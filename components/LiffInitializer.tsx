"use client";

import { useEffect, useState, ReactNode } from "react";

// ============================================================
// LiffInitializer - Client Component สำหรับ init LIFF SDK
// ============================================================
// LIFF SDK ต้อง init ฝั่ง client เท่านั้น (ใช้ browser APIs)
// Component นี้:
// 1. โหลด LIFF SDK
// 2. เรียก liff.init() ด้วย LIFF_ID
// 3. ถ้า user ยังไม่ login → redirect ไป LINE login
// 4. เมื่อ init สำเร็จ → render children
// ============================================================

interface LiffInitializerProps {
  liffId: string;
  children: ReactNode;
}

export default function LiffInitializer({
  liffId,
  children,
}: LiffInitializerProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initLiff() {
      try {
        // Import LIFF SDK แบบ dynamic (ลด initial bundle)
        const liff = (await import("@line/liff")).default;

        await liff.init({ liffId });

        // ถ้ายังไม่ login → redirect ไป LINE login
        if (!liff.isLoggedIn()) {
          // Dev mode: ข้าม login ไปเลย (ไม่ต้องเปิดผ่าน LINE)
          if (process.env.NODE_ENV === "development") {
            console.warn("Dev mode: skipping LIFF login");
            setIsReady(true);
            return;
          }
          liff.login();
          return;
        }

        // เก็บ liff instance ไว้ใน window สำหรับ component อื่นเรียกใช้
        window.liff = liff;
        setIsReady(true);
      } catch (err) {
        console.error("LIFF init failed:", err);
        setError("ไม่สามารถเชื่อมต่อ LINE ได้");

        // ใน development mode ให้ข้ามไปได้
        if (process.env.NODE_ENV === "development") {
          console.warn("Dev mode: proceeding without LIFF");
          setIsReady(true);
        }
      }
    }

    initLiff();
  }, [liffId]);

  if (error && process.env.NODE_ENV !== "development") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-lg font-bold text-red-500 mb-2">เกิดข้อผิดพลาด</p>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400 mt-2">กรุณาเปิดผ่าน LINE อีกครั้ง</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-pink-300 border-t-pink-600 mx-auto mb-3" />
          <p className="text-gray-500">กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
