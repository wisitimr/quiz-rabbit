-- ============================================================
-- Quiz Rabbit v2 - Checkpoint-Based Scan & Collect System
-- ============================================================
-- ระบบเช็คพอยต์: สแกน QR 5 จุด ตอบถูกจุดละ 1 ข้อ → รับ redeem QR
-- ============================================================

-- ลบตารางเก่า (เรียงจากตารางที่มี FK ก่อน)
DROP TABLE IF EXISTS redeem_tokens CASCADE;
DROP TABLE IF EXISTS checkpoint_attempts CASCADE;
DROP TABLE IF EXISTS session_checkpoints CASCADE;
DROP TABLE IF EXISTS checkpoint_tokens CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS quiz_scan_tokens CASCADE;
DROP TABLE IF EXISTS quiz_session_questions CASCADE;
DROP TABLE IF EXISTS quiz_sessions CASCADE;
DROP TABLE IF EXISTS quiz_choices CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quiz_categories CASCADE;
DROP TABLE IF EXISTS quiz_campaigns CASCADE;
DROP TABLE IF EXISTS quiz_characters CASCADE;
DROP TABLE IF EXISTS quiz_themes CASCADE;
DROP TABLE IF EXISTS line_users CASCADE;

-- ============================================================
-- 1) line_users - เก็บข้อมูลผู้ใช้จาก LINE (ไม่เปลี่ยน)
-- ============================================================
CREATE TABLE line_users (
    id              BIGSERIAL PRIMARY KEY,
    line_uid        TEXT NOT NULL UNIQUE,
    display_name    TEXT,
    picture_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_users_uid ON line_users(line_uid);

-- ============================================================
-- 2) quiz_themes - ธีมสี/ฟอนต์ (ไม่เปลี่ยน)
-- ============================================================
CREATE TABLE quiz_themes (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3) quiz_characters - ตัวละคร (ไม่เปลี่ยน)
-- ============================================================
CREATE TABLE quiz_characters (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    asset_idle      TEXT NOT NULL DEFAULT '',
    asset_correct   TEXT NOT NULL DEFAULT '',
    asset_wrong     TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4) quiz_campaigns - แคมเปญ (v2: checkpoint-based)
-- ============================================================
-- เปลี่ยนจาก max_questions/time_per_question_sec
-- เป็น total_checkpoints/retry_rotate_question
CREATE TABLE quiz_campaigns (
    id                      BIGSERIAL PRIMARY KEY,
    slug                    TEXT NOT NULL UNIQUE,
    title                   TEXT NOT NULL,
    description             TEXT,
    theme_id                BIGINT NOT NULL REFERENCES quiz_themes(id),
    is_active               BOOLEAN NOT NULL DEFAULT true,
    total_checkpoints       INT NOT NULL DEFAULT 5,
    retry_rotate_question   BOOLEAN NOT NULL DEFAULT false,
    scene_background_url        TEXT NOT NULL DEFAULT '',
    scene_characters     BIGINT[] NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_slug ON quiz_campaigns(slug);
CREATE INDEX idx_campaigns_active ON quiz_campaigns(is_active) WHERE is_active = true;

-- ============================================================
-- 5) quiz_categories - หมวดหมู่คำถาม (1 checkpoint = 1 category)
-- ============================================================
CREATE TABLE quiz_categories (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6) checkpoint_tokens - QR code ที่ติดตามจุดเช็คพอยต์
-- ============================================================
-- Pre-generated, reusable tokens สำหรับ QR code แต่ละจุด
-- 1 checkpoint = 1 category ของคำถาม
CREATE TABLE checkpoint_tokens (
    id                  BIGSERIAL PRIMARY KEY,
    token               TEXT NOT NULL UNIQUE,
    campaign_id         BIGINT NOT NULL REFERENCES quiz_campaigns(id),
    checkpoint_index    INT NOT NULL,
    category_id         BIGINT NOT NULL REFERENCES quiz_categories(id),
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, checkpoint_index)
);

CREATE INDEX idx_checkpoint_tokens_token ON checkpoint_tokens(token);

-- ============================================================
-- 7) quiz_questions - คำถาม (ผูกกับ category)
-- ============================================================
CREATE TABLE quiz_questions (
    id                  BIGSERIAL PRIMARY KEY,
    category_id         BIGINT NOT NULL REFERENCES quiz_categories(id),
    question_text       TEXT NOT NULL,
    explanation         TEXT,
    sort_order          INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_category ON quiz_questions(category_id) WHERE is_active = true;

-- ============================================================
-- 6) quiz_choices - ตัวเลือก (ไม่เปลี่ยน)
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

CREATE UNIQUE INDEX idx_unique_correct_per_question
    ON quiz_choices(question_id) WHERE is_correct = true;

-- ============================================================
-- 7) user_sessions - session ต่อ user ต่อ campaign
-- ============================================================
-- 1 user สามารถมีได้ 1 session ต่อ campaign (UNIQUE)
CREATE TABLE user_sessions (
    id              BIGSERIAL PRIMARY KEY,
    campaign_id     BIGINT NOT NULL REFERENCES quiz_campaigns(id),
    user_id         BIGINT NOT NULL REFERENCES line_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    UNIQUE(user_id, campaign_id)
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_campaign ON user_sessions(campaign_id);

-- ============================================================
-- 9) session_checkpoints - ความคืบหน้าต่อ user ต่อ checkpoint
-- ============================================================
-- ติดตามว่า user ผ่านจุดไหนแล้ว + คำถามที่ได้รับ
CREATE TABLE session_checkpoints (
    id                      BIGSERIAL PRIMARY KEY,
    session_id              BIGINT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    checkpoint_index        INT NOT NULL,
    assigned_question_id    BIGINT REFERENCES quiz_questions(id),
    is_completed            BOOLEAN NOT NULL DEFAULT false,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, checkpoint_index)
);

CREATE INDEX idx_session_checkpoints_session ON session_checkpoints(session_id);

-- ============================================================
-- 10) checkpoint_attempts - ประวัติการตอบ (analytics + rotation)
-- ============================================================
-- เก็บทุกครั้งที่ตอบ สำหรับ analytics และหมุนคำถาม
CREATE TABLE checkpoint_attempts (
    id                      BIGSERIAL PRIMARY KEY,
    session_checkpoint_id   BIGINT NOT NULL REFERENCES session_checkpoints(id) ON DELETE CASCADE,
    question_id             BIGINT NOT NULL REFERENCES quiz_questions(id),
    choice_id               BIGINT NOT NULL REFERENCES quiz_choices(id),
    is_correct              BOOLEAN NOT NULL,
    attempted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoint_attempts_scp ON checkpoint_attempts(session_checkpoint_id);

-- ============================================================
-- 11) redeem_tokens - QR code สำหรับแลกรางวัล
-- ============================================================
-- สร้างเมื่อ user ผ่านครบทุกจุด, ใช้ได้ครั้งเดียว
CREATE TABLE redeem_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token           TEXT NOT NULL UNIQUE,
    session_id      BIGINT NOT NULL UNIQUE REFERENCES user_sessions(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_used         BOOLEAN NOT NULL DEFAULT false,
    used_at         TIMESTAMPTZ,
    kiosk_id        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_redeem_tokens_token ON redeem_tokens(token);

-- ============================================================
-- Trigger: อัพเดท updated_at อัตโนมัติ
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
