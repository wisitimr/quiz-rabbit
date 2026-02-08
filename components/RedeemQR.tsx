"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

// ============================================================
// RedeemQR - แสดง QR code สำหรับแลกรางวัลที่ kiosk
// ============================================================

interface RedeemQRProps {
  token: string;
  expiresInDays?: number;
}

export default function RedeemQR({ token, expiresInDays = 7 }: RedeemQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, token, {
      width: 240,
      margin: 2,
      color: {
        dark: "#333333",
        light: "#FFFFFF",
      },
    }).catch((err: unknown) => {
      console.error("QR render error:", err);
    });
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      <div
        className="text-center p-6 rounded-2xl w-full"
        style={{
          backgroundColor: "var(--qr-card)",
          boxShadow: `0 4px 16px var(--qr-shadow)`,
        }}
      >
        <p className="text-4xl mb-3">🎉</p>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "var(--qr-primary)" }}
        >
          ยินดีด้วย!
        </h2>
        <p className="text-gray-600 mb-4">
          คุณผ่านครบทุกจุดเช็คพอยต์แล้ว
        </p>

        <div className="bg-white rounded-xl p-4 inline-block">
          <canvas ref={canvasRef} />
        </div>

        <p className="text-gray-400 text-xs mt-4">
          นำ QR Code นี้ไปสแกนที่จุดแลกรางวัล
        </p>
        <p className="text-gray-400 text-xs">
          หมดอายุใน {expiresInDays} วัน
        </p>
      </div>
    </div>
  );
}
