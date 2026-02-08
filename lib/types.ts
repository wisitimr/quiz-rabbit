// ============================================================
// Type definitions สำหรับระบบ Quiz Rabbit v2 (Checkpoint-based)
// ============================================================

// --- ข้อมูลผู้ใช้จาก LINE ---
export interface LineUser {
  id: number;
  line_uid: string;
  display_name: string | null;
  picture_url: string | null;
}

// --- Theme config (เก็บเป็น JSONB ใน DB) ---
export interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  cardColor: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonRadius: string;
  correctColor: string;
  wrongColor: string;
  fontFamily: string;
  titleFontSize: string;
  questionFontSize: string;
  progressBarColor: string;
  shadowColor: string;
}

// --- ตัวละคร ---
export interface QuizCharacter {
  id: number;
  name: string;
  asset_idle: string;
  asset_correct: string;
  asset_wrong: string;
  metadata: CharacterMetadata;
}

export interface CharacterMetadata {
  displayName: string;
  greeting: string;
  correctPhrases: string[];
  wrongPhrases: string[];
  completePhrases: string[];
}

// --- แคมเปญ (v2: checkpoint-based) ---
export interface QuizCampaign {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  theme_id: number;
  is_active: boolean;
  total_checkpoints: number;
  retry_rotate_question: boolean;
  scene_background_url: string;
  scene_characters: number[];
}

// --- ข้อมูลแคมเปญที่รวม theme + character แล้ว ---
export interface CampaignWithConfig {
  campaign: QuizCampaign;
  theme: ThemeConfig;
  /** ตัวละครจาก scene_characters — resolved จาก quiz_characters */
  sceneCharacters: QuizCharacter[];
}

// --- หมวดหมู่คำถาม ---
export interface QuizCategory {
  id: number;
  name: string;
}

// --- คำถาม ---
export interface QuizQuestion {
  id: number;
  category_id: number;
  question_text: string;
  explanation: string | null;
}

// --- ตัวเลือก (ส่งไป client โดยไม่มี is_correct) ---
export interface QuizChoice {
  id: number;
  question_id: number;
  choice_text: string;
  sort_order: number;
}

// ตัวเลือกฝั่ง server (มี is_correct) - ห้ามส่งไป client
export interface QuizChoiceWithAnswer extends QuizChoice {
  is_correct: boolean;
}

// --- User Session (v2) ---
export interface UserSession {
  id: number;
  campaign_id: number;
  user_id: number;
  created_at: string;
  completed_at: string | null;
}

// --- Checkpoint Token ---
export interface CheckpointToken {
  id: number;
  token: string;
  campaign_id: number;
  checkpoint_index: number;
  category_id: number;
  expires_at: string;
}

// --- Session Checkpoint ---
export interface SessionCheckpoint {
  id: number;
  session_id: number;
  checkpoint_index: number;
  assigned_question_id: number | null;
  is_completed: boolean;
  completed_at: string | null;
}

// --- Checkpoint Attempt ---
export interface CheckpointAttempt {
  id: number;
  session_checkpoint_id: number;
  question_id: number;
  choice_id: number;
  is_correct: boolean;
  attempted_at: string;
}

// --- Redeem Token ---
export interface RedeemToken {
  id: number;
  token: string;
  session_id: number;
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
  kiosk_id: string | null;
}

// --- API Types ---

// GET /api/scan/enter
export interface CheckpointEnterResponse {
  campaign: CampaignWithConfig;
  checkpoint: {
    index: number;
    categoryName: string;
    isCompleted: boolean;
  };
  progress: {
    completed: number;
    total: number;
    checkpoints: { index: number; isCompleted: boolean }[];
  };
  question: {
    id: number;
    text: string;
    choices: QuizChoice[];
  } | null;
  sessionCheckpointId: number;
}

// POST /api/answer
export interface CheckpointAnswerResponse {
  isCorrect: boolean;
  correctChoiceId: number;
  explanation: string | null;
  checkpoint: {
    index: number;
    categoryName: string;
    isCompleted: boolean;
  };
  progress: {
    completed: number;
    total: number;
    checkpoints: { index: number; isCompleted: boolean }[];
  };
  newQuestion?: {
    id: number;
    text: string;
    choices: QuizChoice[];
  };
  redeemToken?: string;
}

// POST /api/kiosk/redeem
export interface KioskRedeemRequest {
  redeemToken: string;
  kioskId: string;
}

export interface KioskRedeemResponse {
  success: boolean;
  campaign?: {
    title: string;
    slug: string;
  };
  redeemedAt?: string;
}
