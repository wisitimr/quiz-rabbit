import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

// ============================================================
// Root Layout - Layout หลักของ app
// ============================================================
// ใช้ Noto Sans Thai เป็นฟอนต์หลัก (รองรับภาษาไทย)
// ใช้ next/font เพื่อ self-host font (ไม่ต้อง request ไป Google Fonts ตอน runtime)
// Viewport ตั้งค่าสำหรับ mobile-first (LIFF เปิดใน LINE app)
// ============================================================

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-thai",
});

export const metadata: Metadata = {
  title: "Quiz Rabbit - ตอบคำถามกับน้องกระต่าย",
  description: "เกมตอบคำถามสนุก ๆ ผ่าน LINE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body
        className="antialiased"
        style={{ fontFamily: 'var(--font-noto-thai), "Noto Sans Thai", sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
