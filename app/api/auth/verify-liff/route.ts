import { NextRequest, NextResponse } from "next/server";
import { verifyLiffToken } from "@/lib/liff";
import { findOrCreateUser } from "@/lib/quiz";

// ============================================================
// POST /api/auth/verify-liff
// ============================================================
// Helper endpoint สำหรับ verify LIFF ID token
// Client ส่ง LIFF ID token มา → server verify → คืน user info
// ใช้เมื่อ client ต้องการ confirm ว่า login สำเร็จแล้ว
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_token } = body;

    if (!id_token || typeof id_token !== "string") {
      return NextResponse.json(
        { error: "Missing id_token" },
        { status: 400 }
      );
    }

    // Verify LIFF token ฝั่ง server (ห้ามเชื่อ client)
    const payload = await verifyLiffToken(id_token);

    // หา user ใน DB หรือสร้างใหม่
    const user = await findOrCreateUser(
      payload.sub,
      payload.name,
      payload.picture
    );

    return NextResponse.json({
      user: {
        id: user.id,
        display_name: user.display_name,
        picture_url: user.picture_url,
      },
    });
  } catch (error) {
    console.error("LIFF verification failed:", error);
    return NextResponse.json(
      { error: "Token verification failed" },
      { status: 401 }
    );
  }
}
