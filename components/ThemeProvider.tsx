"use client";

import { ReactNode } from "react";
import { ThemeConfig } from "@/lib/types";
import { themeToCssVars } from "@/lib/theme";

// ============================================================
// ThemeProvider - ใส่ CSS variables ตาม theme config จาก DB
// ============================================================
// วิธีการทำงาน:
// 1. Server fetch theme config จาก DB (JSONB)
// 2. ส่ง ThemeConfig มาเป็น prop
// 3. Component นี้แปลงเป็น CSS custom properties
// 4. ทุก child component ใช้ var(--qr-xxx) เพื่ออ้างอิงค่าสี/ฟอนต์
//
// เปลี่ยนธีม: แค่อัพเดท JSONB ใน quiz_themes → ทุกอย่างเปลี่ยนตาม
// ============================================================

interface ThemeProviderProps {
  theme: ThemeConfig;
  children: ReactNode;
}

export default function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const cssVars = themeToCssVars(theme);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        ...(cssVars as React.CSSProperties),
        backgroundColor: "var(--qr-bg)",
        fontFamily: "var(--qr-font)",
      }}
    >
      {children}
    </div>
  );
}
