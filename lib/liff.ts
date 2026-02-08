import * as jose from "jose";

// ============================================================
// LIFF Token Verification (Server-side)
// ============================================================
// ทำไมต้อง verify LIFF token ฝั่ง server?
// - Client สามารถปลอม userId ได้ง่าย ๆ
// - LIFF ID token เป็น JWT ที่ LINE sign มา เราต้อง verify signature
// - ถ้าไม่ verify ใครก็สามารถส่ง userId คนอื่นมาแอบอ้างได้
// ============================================================

// URL สำหรับดึง LINE public keys (JWKS) เพื่อ verify JWT signature
const LINE_JWKS_URL = "https://api.line.me/oauth2/v2.1/certs";

// Cache JWKS เพื่อไม่ต้องดึงทุกครั้ง
let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 ชั่วโมง

async function getLineJWKS(): Promise<jose.JSONWebKeySet> {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const response = await fetch(LINE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch LINE JWKS: ${response.status}`);
  }
  jwksCache = (await response.json()) as jose.JSONWebKeySet;
  jwksCacheTime = now;
  return jwksCache;
}

export interface LiffTokenPayload {
  sub: string; // LINE userId
  name?: string;
  picture?: string;
  email?: string;
}

// ============================================================
// verifyLiffToken - ตรวจสอบ LIFF ID token และคืน payload
// ============================================================
// ขั้นตอน:
// 1. ดึง public keys จาก LINE (JWKS)
// 2. Verify JWT signature ด้วย public key
// 3. ตรวจสอบ issuer (ต้องเป็น https://access.line.me)
// 4. ตรวจสอบ audience (ต้องตรงกับ LIFF channel ID ของเรา)
// 5. ตรวจสอบ expiration (token หมดอายุหรือยัง)
// ============================================================
export async function verifyLiffToken(
  idToken: string
): Promise<LiffTokenPayload> {
  // Dev mode: ข้าม verify แล้วคืน test user
  if (process.env.NODE_ENV === "development" && idToken === "dev-mock-token") {
    console.warn("Dev mode: skipping LIFF token verification");
    return {
      sub: "test-user",
      name: "Tester",
    };
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    throw new Error("LINE_CHANNEL_ID is not configured");
  }

  const jwks = await getLineJWKS();
  const JWKS = jose.createLocalJWKSet(jwks);

  // Verify JWT ด้วย LINE public key
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: "https://access.line.me",
    audience: channelId,
  });

  // ตรวจว่ามี sub (LINE userId) หรือไม่
  if (!payload.sub) {
    throw new Error("Invalid LIFF token: missing sub claim");
  }

  return {
    sub: payload.sub,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
    email: payload.email as string | undefined,
  };
}
