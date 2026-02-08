import { Pool, PoolClient } from "pg";

// ============================================================
// Database Connection Pool
// ============================================================
// ใช้ connection pool เพื่อจัดการ connection กับ PostgreSQL อย่างมีประสิทธิภาพ
// Pool จะ reuse connection แทนที่จะสร้างใหม่ทุกครั้ง
// ============================================================

// สร้าง pool เดียวสำหรับทั้ง application (singleton pattern)
// ใน production Next.js อาจ hot-reload ทำให้สร้าง pool ซ้ำ จึงเก็บใน globalThis
const globalForDb = globalThis as unknown as {
  pgPool: Pool | undefined;
};

// ถ้ามี pool อยู่แล้วใน global scope ให้ใช้ตัวเดิม (ป้องกัน connection leak ตอน dev)
export const pool: Pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // จำนวน connection สูงสุดใน pool
    idleTimeoutMillis: 30000, // ปิด connection ที่ไม่ได้ใช้หลัง 30 วินาที
    connectionTimeoutMillis: 5000, // timeout ถ้าเชื่อมต่อไม่ได้ใน 5 วินาที
  });

// เก็บ pool ไว้ใน global scope สำหรับ dev mode
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

// ============================================================
// Helper: รัน query เดียว
// ============================================================
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// ============================================================
// Helper: รัน query เดียวและคืนแถวแรก
// ============================================================
export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// ============================================================
// Helper: ใช้ transaction เพื่อรับประกัน atomicity
// ============================================================
// ใช้เมื่อต้องการให้หลาย query ทำงานเป็นหน่วยเดียว
// ถ้า query ใด query หนึ่งล้มเหลว จะ rollback ทั้งหมด
// ตัวอย่างที่ต้องใช้: การ reserve คำถามถัดไป + บันทึกลง session_questions
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
