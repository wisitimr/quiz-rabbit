import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // กำหนดค่า environment variables ที่จะใช้ใน client (เฉพาะ NEXT_PUBLIC_ เท่านั้น)
  // ห้ามใส่ secrets เช่น LINE_CHANNEL_SECRET ใน client bundle
  env: {},
  images: {
    // รองรับ image URL จากอินเทอร์เน็ต (scene backgrounds + character images)
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
