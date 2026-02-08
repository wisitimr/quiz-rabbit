import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Middleware: จัดการ LIFF liff.state redirect
// ============================================================
// เมื่อ LINE เปิด LIFF URL เช่น:
//   https://liff.line.me/{liff-id}/scan/token-123
//
// LINE จะ redirect มาที่ endpoint URL ของเราพร้อม query parameter:
//   https://our-domain/?liff.state=%2Fscan%2Ftoken-123
//
// Middleware นี้จะอ่าน liff.state แล้ว redirect ไปยัง path ที่ถูกต้อง:
//   https://our-domain/scan/token-123
// ============================================================

export function middleware(request: NextRequest) {
  const liffState = request.nextUrl.searchParams.get("liff.state");

  if (liffState && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = liffState;
    url.searchParams.delete("liff.state");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
