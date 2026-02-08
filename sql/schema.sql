-- ============================================================
-- Quiz Rabbit - Database Schema
-- ============================================================
-- สร้างตารางทั้งหมดสำหรับระบบ Quiz ผ่าน LINE LIFF
-- รองรับการเปลี่ยน theme และ character ได้โดยไม่ต้องแก้ logic หลัก
-- ============================================================

-- ลบตารางเก่า (ถ้ามี) เรียงจากตารางที่มี FK ก่อน
DROP TABLE IF EXISTS quiz_scan_tokens CASCADE;
DROP TABLE IF EXISTS quiz_session_questions CASCADE;
DROP TABLE IF EXISTS quiz_sessions CASCADE;
DROP TABLE IF EXISTS quiz_choices CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quiz_campaigns CASCADE;
DROP TABLE IF EXISTS quiz_characters CASCADE;
DROP TABLE IF EXISTS quiz_themes CASCADE;
DROP TABLE IF EXISTS line_users CASCADE;

-- ============================================================
-- 1) line_users - เก็บข้อมูลผู้ใช้จาก LINE
-- ============================================================
-- เก็บเฉพาะ line_uid ที่ได้จากการ verify LIFF token ฝั่ง server เท่านั้น
-- ห้ามเชื่อ userId ที่ client ส่งมาตรง ๆ
CREATE TABLE line_users (
    id              BIGSERIAL PRIMARY KEY,
    line_uid        TEXT NOT NULL UNIQUE,           -- LINE userId (จาก verified token)
    display_name    TEXT,
    picture_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_users_uid ON line_users(line_uid);

-- ============================================================
-- 2) quiz_themes - ธีมสี/ฟอนต์ของแคมเปญ (เก็บเป็น JSONB)
-- ============================================================
-- ช่วยให้เปลี่ยน look & feel ได้โดยแค่อัพเดท JSON ใน DB
CREATE TABLE quiz_themes (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- config ตัวอย่าง: {
    --   "primaryColor": "#FF6B6B",
    --   "backgroundColor": "#FFF5E4",
    --   "buttonColor": "#4ECDC4",
    --   "buttonRadius": "12px",
    --   "fontFamily": "'Noto Sans Thai', sans-serif",
    --   "correctColor": "#2ECC71",
    --   "wrongColor": "#E74C3C"
    -- }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3) quiz_characters - ตัวละคร (เช่น กระต่าย, แมว, หมี)
-- ============================================================
-- แยก character ออกจาก theme เพื่อให้ mix & match ได้
CREATE TABLE quiz_characters (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,                  -- ชื่อตัวละคร เช่น "bunny"
    asset_idle      TEXT NOT NULL DEFAULT '',       -- URL รูปปกติ
    asset_correct   TEXT NOT NULL DEFAULT '',       -- URL รูปตอบถูก (ดีใจ)
    asset_wrong     TEXT NOT NULL DEFAULT '',       -- URL รูปตอบผิด (เศร้า)
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4) quiz_campaigns - แคมเปญ quiz (รวม theme + character)
-- ============================================================
-- 1 แคมเปญ = 1 theme + 1 character + ชุดคำถาม
CREATE TABLE quiz_campaigns (
    id              BIGSERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,           -- ใช้ใน URL เช่น "new-year-2025"
    title           TEXT NOT NULL,
    description     TEXT,
    theme_id        BIGINT NOT NULL REFERENCES quiz_themes(id),
    character_id    BIGINT NOT NULL REFERENCES quiz_characters(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    max_questions   INT NOT NULL DEFAULT 10,        -- จำนวนคำถามต่อ session
    time_per_question_sec INT NOT NULL DEFAULT 30,  -- เวลาต่อข้อ (วินาที)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_slug ON quiz_campaigns(slug);
CREATE INDEX idx_campaigns_active ON quiz_campaigns(is_active) WHERE is_active = true;

-- ============================================================
-- 5) quiz_questions - คำถาม
-- ============================================================
CREATE TABLE quiz_questions (
    id              BIGSERIAL PRIMARY KEY,
    campaign_id     BIGINT NOT NULL REFERENCES quiz_campaigns(id),
    question_text   TEXT NOT NULL,
    explanation     TEXT,                           -- คำอธิบายเฉลย (แสดงหลังตอบ)
    sort_order      INT NOT NULL DEFAULT 0,        -- ใช้จัดลำดับเริ่มต้น (แต่ randomize ตอน serve)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_campaign ON quiz_questions(campaign_id) WHERE is_active = true;

-- ============================================================
-- 6) quiz_choices - ตัวเลือก (4 ข้อต่อคำถาม, ถูก 1 ข้อ)
-- ============================================================
CREATE TABLE quiz_choices (
    id              BIGSERIAL PRIMARY KEY,
    question_id     BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    choice_text     TEXT NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT false,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_choices_question ON quiz_choices(question_id);

-- Partial unique index: บังคับให้แต่ละคำถามมีตัวเลือกที่ถูกต้องแค่ 1 ข้อ
-- ใช้ partial index เพราะเราสนแค่แถวที่ is_correct = true
CREATE UNIQUE INDEX idx_unique_correct_per_question
    ON quiz_choices(question_id) WHERE is_correct = true;

-- ============================================================
-- 7) quiz_sessions - session ต่อ user ต่อ campaign
-- ============================================================
-- เก็บ progress ของผู้เล่นแต่ละคน
CREATE TABLE quiz_sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES line_users(id),
    campaign_id     BIGINT NOT NULL REFERENCES quiz_campaigns(id),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'expired')),
    score           INT NOT NULL DEFAULT 0,
    total_answered  INT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON quiz_sessions(user_id);
CREATE INDEX idx_sessions_user_campaign ON quiz_sessions(user_id, campaign_id);
CREATE INDEX idx_sessions_status ON quiz_sessions(status) WHERE status = 'active';

-- ============================================================
-- 8) quiz_session_questions - ติดตามคำถามที่ถูก serve ไปแล้ว
-- ============================================================
-- ป้องกันคำถามซ้ำ: ใช้ UNIQUE(session_id, question_id)
-- เก็บลำดับที่ถูก serve + ผลการตอบ
CREATE TABLE quiz_session_questions (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id     BIGINT NOT NULL REFERENCES quiz_questions(id),
    served_order    INT NOT NULL,                  -- ลำดับที่ส่งคำถามนี้ให้ผู้เล่น
    chosen_choice_id BIGINT REFERENCES quiz_choices(id),  -- ตัวเลือกที่ผู้เล่นเลือก (NULL = ยังไม่ตอบ)
    is_correct      BOOLEAN,                       -- ตอบถูกหรือไม่ (NULL = ยังไม่ตอบ)
    answered_at     TIMESTAMPTZ,
    served_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: ห้ามส่งคำถามซ้ำใน session เดียวกัน
CREATE UNIQUE INDEX idx_unique_session_question
    ON quiz_session_questions(session_id, question_id);

CREATE INDEX idx_session_questions_session ON quiz_session_questions(session_id);

-- ============================================================
-- 9) quiz_scan_tokens - QR scan token (อายุสั้น)
-- ============================================================
-- เมื่อ user สแกน QR จะมาที่ /scan/[token]
-- token ต้อง: (1) ยังไม่หมดอายุ (2) ผูกกับ session (3) ใช้ครั้งเดียว
CREATE TABLE quiz_scan_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token           TEXT NOT NULL UNIQUE,           -- UUID หรือ nanoid
    session_id      BIGINT NOT NULL REFERENCES quiz_sessions(id),
    is_used         BOOLEAN NOT NULL DEFAULT false, -- ใช้แล้วหรือยัง
    expires_at      TIMESTAMPTZ NOT NULL,           -- หมดอายุเมื่อไหร่
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_tokens_token ON quiz_scan_tokens(token);
CREATE INDEX idx_scan_tokens_expires ON quiz_scan_tokens(expires_at);

-- ============================================================
-- ฟังก์ชันอัพเดท updated_at อัตโนมัติ
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_line_users_updated
    BEFORE UPDATE ON line_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_campaigns_updated
    BEFORE UPDATE ON quiz_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
