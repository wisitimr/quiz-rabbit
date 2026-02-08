"use client";

import { useState, useEffect, useCallback } from "react";
import { CampaignWithConfig, QuizChoice } from "@/lib/types";
import CheckpointProgress from "./CheckpointProgress";
import CheckpointQuestionCard from "./CheckpointQuestionCard";
import CharacterDisplay from "./CharacterDisplay";
import RedeemQR from "./RedeemQR";
import BunnyCollectionScene from "./BunnyCollectionScene";
import type { CharacterConfig, SceneThemeConfig } from "./BunnyCollectionScene";

// ============================================================
// CheckpointStage - Main orchestrator สำหรับระบบ checkpoint
// ============================================================
// States: loading → error | checkpoint-completed | question | all-complete
// On mount: waits for LIFF → calls /api/scan/enter → populates state
//
// BunnyCollectionScene integration:
//   - celebrateKey เพิ่มทีละ 1 เมื่อตอบถูก → trigger hop animation
//   - localCollected อัพเดทแบบ optimistic ก่อน → UX ลื่นไหล
//   - ค่าจริง sync กลับจาก server progress ตอน fetch ครั้งถัดไป
// ============================================================

interface CheckpointStageProps {
  checkpointToken: string;
  campaign: CampaignWithConfig;
}

interface QuestionData {
  id: number;
  text: string;
  choices: QuizChoice[];
}

type StageState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "checkpoint-completed"; checkpointIndex: number }
  | { type: "question"; question: QuestionData; sessionCheckpointId: number; checkpointIndex: number }
  | { type: "all-complete"; redeemToken: string };

interface ProgressData {
  completed: number;
  total: number;
  checkpoints: { index: number; isCompleted: boolean }[];
}

// แปลง campaign config + completed checkpoint indices → BunnyCollectionScene props
// assets เรียงตาม checkpoint ที่ผ่านมาแล้ว → bunny 0 = char ของ checkpoint แรกที่ผ่าน
function deriveCharacterConfig(
  campaign: CampaignWithConfig,
  completedIndices: number[],
): CharacterConfig {
  const chars = campaign.sceneCharacters;
  if (!chars?.length) {
    return { assets: ["/assets/char-1.svg"], sizePx: 48 };
  }

  const assets = completedIndices.map((cpIndex) => {
    const charIdx = (cpIndex - 1) % chars.length; // checkpoint 1-based → 0-based
    return chars[charIdx].asset_idle;
  });

  return {
    assets: assets.length > 0 ? assets : [chars[0].asset_idle],
    sizePx: 48,
  };
}

function deriveSceneTheme(campaign: CampaignWithConfig): SceneThemeConfig {
  return {
    backgroundImage: campaign.campaign.scene_background_url || "/assets/scene-bg.svg",
    radiusPx: campaign.theme.buttonRadius,
  };
}

export default function CheckpointStage({
  checkpointToken,
  campaign,
}: CheckpointStageProps) {
  const [state, setState] = useState<StageState>({ type: "loading" });
  const [progress, setProgress] = useState<ProgressData>({
    completed: 0,
    total: campaign.campaign.total_checkpoints,
    checkpoints: [],
  });
  const [checkpointIndex, setCheckpointIndex] = useState(1);

  // ============================================================
  // Bunny collection state:
  // celebrateKey: เพิ่มเฉพาะเมื่อตอบถูก → trigger enter animation
  // localCollected: อัพเดทแบบ optimistic เพื่อให้ bunny hop ทันที
  // collectedIndices: เก็บลำดับ checkpoint index ที่ผ่านแล้ว
  //   → ใช้เลือก character ให้ตรงกับจุดที่สแกน
  // ============================================================
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [localCollected, setLocalCollected] = useState(0);
  const [collectedIndices, setCollectedIndices] = useState<number[]>([]);

  const characterConfig = deriveCharacterConfig(campaign, collectedIndices);
  const sceneTheme = deriveSceneTheme(campaign);

  useEffect(() => {
    async function fetchData() {
      try {
        const liffIdToken = await getLiffIdToken();

        const res = await fetch(
          `/api/scan/enter?checkpointToken=${encodeURIComponent(checkpointToken)}&liffIdToken=${encodeURIComponent(liffIdToken)}`
        );

        if (!res.ok) {
          const err = await res.json();
          setState({ type: "error", message: err.error || "เกิดข้อผิดพลาด" });
          return;
        }

        const data = await res.json();

        setProgress(data.progress);
        setCheckpointIndex(data.checkpoint.index);
        // Sync collected จาก server (ไม่ trigger animation เพราะ celebrateKey ไม่เปลี่ยน)
        setLocalCollected(data.progress.completed);
        // สร้าง collectedIndices จาก checkpoint ที่ผ่านแล้ว (sorted by index)
        const completedCps = (data.progress.checkpoints as { index: number; isCompleted: boolean }[])
          .filter((cp) => cp.isCompleted)
          .map((cp) => cp.index)
          .sort((a, b) => a - b);
        setCollectedIndices(completedCps);

        if (data.redeemToken) {
          setState({ type: "all-complete", redeemToken: data.redeemToken });
          return;
        }

        if (data.checkpoint.isCompleted) {
          setState({
            type: "checkpoint-completed",
            checkpointIndex: data.checkpoint.index,
          });
          return;
        }

        if (data.question) {
          setState({
            type: "question",
            question: data.question,
            sessionCheckpointId: data.sessionCheckpointId,
            checkpointIndex: data.checkpoint.index,
          });
        } else {
          setState({ type: "error", message: "ไม่มีคำถามสำหรับจุดนี้" });
        }
      } catch (error) {
        console.error("Fetch error:", error);
        setState({ type: "error", message: "ไม่สามารถโหลดข้อมูลได้" });
      }
    }

    fetchData();
  }, [checkpointToken]);

  const handleCorrectAnswer = useCallback(() => {
    // Optimistic UI: เพิ่ม collected + trigger hop animation ทันที
    setLocalCollected((c) => c + 1);
    setCelebrateKey((k) => k + 1);
    setCollectedIndices((prev) =>
      prev.includes(checkpointIndex) ? prev : [...prev, checkpointIndex]
    );

    setProgress((prev) => {
      const updated = prev.checkpoints.map((cp) =>
        cp.index === checkpointIndex ? { ...cp, isCompleted: true } : cp
      );
      return { ...prev, completed: prev.completed + 1, checkpoints: updated };
    });

    // รอให้ animation hop เล่นจบก่อนเปลี่ยน state
    setTimeout(() => {
      setState({
        type: "checkpoint-completed",
        checkpointIndex,
      });
    }, 1200);
  }, [checkpointIndex]);

  const handleAllComplete = useCallback((redeemToken: string) => {
    setLocalCollected((c) => c + 1);
    setCelebrateKey((k) => k + 1);
    setCollectedIndices((prev) =>
      prev.includes(checkpointIndex) ? prev : [...prev, checkpointIndex]
    );

    setProgress((prev) => {
      const updated = prev.checkpoints.map((cp) =>
        cp.index === checkpointIndex ? { ...cp, isCompleted: true } : cp
      );
      return { ...prev, completed: prev.total, checkpoints: updated };
    });

    setTimeout(() => {
      setState({ type: "all-complete", redeemToken });
    }, 1200);
  }, [checkpointIndex]);

  const handleQuestionRotate = useCallback(
    (newQuestion: { id: number; text: string; choices: QuizChoice[] }) => {
      setState((prev) => {
        if (prev.type !== "question") return prev;
        return { ...prev, question: newQuestion };
      });
    },
    []
  );

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScanNext = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      if (!window.liff?.scanCodeV2) {
        throw new Error("QR scanner not available");
      }
      const result = await window.liff.scanCodeV2();
      if (result.value) {
        // QR contains a URL like https://domain/scan/dev-cp-2
        // or just a path like /scan/dev-cp-2
        try {
          const url = new URL(result.value);
          window.location.href = url.pathname;
        } catch {
          // Not a full URL — treat as path
          window.location.href = result.value;
        }
      }
    } catch (err) {
      console.error("Scan error:", err);
      setScanError("ไม่สามารถเปิดกล้องสแกนได้");
      setScanning(false);
    }
  }, []);

  // --- Render ---

  if (state.type === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-pink-300 border-t-pink-600 mx-auto mb-3" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-bold text-red-500 mb-2">เกิดข้อผิดพลาด</p>
          <p className="text-gray-600">{state.message}</p>
        </div>
      </div>
    );
  }

  if (state.type === "all-complete") {
    return (
      <div className="flex flex-col gap-6">
        <BunnyCollectionScene
          collected={localCollected}
          max={progress.total}
          spawnKey={celebrateKey}
          characterConfig={characterConfig}
          themeConfig={sceneTheme}
        />
        <CheckpointProgress
          total={progress.total}
          completed={progress.total}
        />
        <RedeemQR token={state.redeemToken} />
      </div>
    );
  }

  if (state.type === "checkpoint-completed") {
    return (
      <div className="flex flex-col gap-6">
        <BunnyCollectionScene
          collected={localCollected}
          max={progress.total}
          spawnKey={celebrateKey}
          characterConfig={characterConfig}
          themeConfig={sceneTheme}
        />
        <CheckpointProgress
          total={progress.total}
          completed={progress.completed}
        />
        <div
          className="text-center p-6 rounded-2xl max-w-sm mx-auto"
          style={{
            backgroundColor: "var(--qr-card)",
            boxShadow: `0 4px 16px var(--qr-shadow)`,
          }}
        >
          <div className="flex justify-center mb-4">
            <CharacterDisplay
              character={campaign.sceneCharacters[(state.checkpointIndex - 1) % campaign.sceneCharacters.length] ?? campaign.sceneCharacters[0]}
              state="correct"
              showPhrase
            />
          </div>
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--qr-primary)" }}
          >
            สะสมได้ {progress.completed}/{progress.total} แล้ว!
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            ไปสแกนจุดเช็คพอยต์ถัดไปเพื่อเล่นต่อ
          </p>
          <button
            onClick={handleScanNext}
            disabled={scanning}
            className="w-full py-3 font-bold text-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--qr-btn)",
              color: "var(--qr-btn-text)",
              borderRadius: "var(--qr-btn-radius)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 012-2h2" /><path d="M17 3h2a2 2 0 012 2v2" />
              <path d="M21 17v2a2 2 0 01-2 2h-2" /><path d="M7 21H5a2 2 0 01-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            {scanning ? "กำลังเปิดกล้อง..." : "สแกน QR จุดถัดไป"}
          </button>
          {scanError && (
            <p className="text-red-500 text-xs mt-2">{scanError}</p>
          )}
        </div>
      </div>
    );
  }

  // state.type === "question"
  return (
    <div className="flex flex-col gap-6">
      <BunnyCollectionScene
        collected={localCollected}
        max={progress.total}
        spawnKey={celebrateKey}
        characterConfig={characterConfig}
        themeConfig={sceneTheme}
      />
      <CheckpointProgress
        total={progress.total}
        completed={progress.completed}
        showCurrent
      />
      <CheckpointQuestionCard
        key={state.question.id}
        questionId={state.question.id}
        questionText={state.question.text}
        choices={state.question.choices}
        sessionCheckpointId={state.sessionCheckpointId}
        checkpointToken={checkpointToken}
        campaign={campaign}
        checkpointIndex={state.checkpointIndex}
        onCorrectAnswer={handleCorrectAnswer}
        onAllComplete={handleAllComplete}
        onQuestionRotate={handleQuestionRotate}
      />
    </div>
  );
}

async function getLiffIdToken(): Promise<string> {
  if (typeof window !== "undefined" && window.liff) {
    const token = window.liff.getIDToken();
    if (token) return token;
  }

  if (process.env.NODE_ENV === "development") {
    return "dev-mock-token";
  }

  throw new Error("LIFF ID token not available");
}
