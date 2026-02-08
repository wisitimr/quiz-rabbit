import { ThemeConfig } from "./types";

// ============================================================
// Theme Utilities
// ============================================================
// ฟังก์ชันช่วยสำหรับจัดการ theme ที่เก็บใน DB
// Theme config เก็บเป็น JSONB ใน quiz_themes.config
// เมื่อต้องการเปลี่ยนธีม แค่อัพเดท JSON ใน DB ไม่ต้องแก้โค้ด
// ============================================================

// ค่า default ถ้า DB ไม่มี config บางตัว
export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#FF6B9D",
  backgroundColor: "#FFF5E4",
  cardColor: "#FFFFFF",
  buttonColor: "#FF6B9D",
  buttonTextColor: "#FFFFFF",
  buttonRadius: "12px",
  correctColor: "#2ECC71",
  wrongColor: "#E74C3C",
  fontFamily: '"Noto Sans Thai", "Sarabun", sans-serif',
  titleFontSize: "1.5rem",
  questionFontSize: "1.1rem",
  progressBarColor: "#FF6B9D",
  shadowColor: "rgba(255, 107, 157, 0.2)",
};

// รวม theme จาก DB กับ default (กันกรณี DB มีแค่บาง field)
export function mergeTheme(dbConfig: Partial<ThemeConfig>): ThemeConfig {
  return { ...DEFAULT_THEME, ...dbConfig };
}

// แปลง ThemeConfig เป็น CSS custom properties (ใช้ใน SSR)
// วิธีนี้ทำให้ component ไม่ต้องรู้จัก theme โดยตรง แค่ใช้ CSS variable
export function themeToCssVars(theme: ThemeConfig): Record<string, string> {
  return {
    "--qr-primary": theme.primaryColor,
    "--qr-bg": theme.backgroundColor,
    "--qr-card": theme.cardColor,
    "--qr-btn": theme.buttonColor,
    "--qr-btn-text": theme.buttonTextColor,
    "--qr-btn-radius": theme.buttonRadius,
    "--qr-correct": theme.correctColor,
    "--qr-wrong": theme.wrongColor,
    "--qr-font": theme.fontFamily,
    "--qr-title-size": theme.titleFontSize,
    "--qr-q-size": theme.questionFontSize,
    "--qr-progress": theme.progressBarColor,
    "--qr-shadow": theme.shadowColor,
  };
}
