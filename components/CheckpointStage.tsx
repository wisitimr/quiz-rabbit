"use client";

import { useState, useEffect, useCallback } from "react";
import { CampaignWithConfig, QuizChoice } from "@/lib/types";
import CheckpointProgress from "./CheckpointProgress";
import CheckpointQuestionCard from "./CheckpointQuestionCard";
import RedeemQR from "./RedeemQR";

// ============================================================
// CheckpointStage - Main orchestrator สำหรับระบบ checkpoint
// ============================================================
// States: loading → error | checkpoint-completed | question | all-complete
// On mount: waits for LIFF → calls /api/scan/enter → populates state
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

        // Check if all complete (with existing redeem token)
        if (data.redeemToken) {
          setState({ type: "all-complete", redeemToken: data.redeemToken });
          return;
        }

        // Check if this checkpoint is already completed
        if (data.checkpoint.isCompleted) {
          setState({
            type: "checkpoint-completed",
            checkpointIndex: data.checkpoint.index,
          });
          return;
        }

        // Show question
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
    // Update progress locally
    setProgress((prev) => {
      const updated = prev.checkpoints.map((cp) =>
        cp.index === checkpointIndex ? { ...cp, isCompleted: true } : cp
      );
      return { ...prev, completed: prev.completed + 1, checkpoints: updated };
    });

    setState({
      type: "checkpoint-completed",
      checkpointIndex,
    });
  }, [checkpointIndex]);

  const handleAllComplete = useCallback((redeemToken: string) => {
    setProgress((prev) => {
      const updated = prev.checkpoints.map((cp) =>
        cp.index === checkpointIndex ? { ...cp, isCompleted: true } : cp
      );
      return { ...prev, completed: prev.total, checkpoints: updated };
    });

    setState({ type: "all-complete", redeemToken });
  }, [checkpointIndex]);

  const handleQuestionRotate = useCallback(
    (newQuestion: { id: number; text: string; choices: QuizChoice[] }) => {
      setState((prev) => {
        if (prev.type !== "question") return prev;
        return {
          ...prev,
          question: newQuestion,
        };
      });
    },
    []
  );

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
        <CheckpointProgress
          checkpoints={progress.checkpoints}
          currentIndex={checkpointIndex}
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
        <CheckpointProgress
          checkpoints={progress.checkpoints}
          currentIndex={state.checkpointIndex}
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
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "var(--qr-correct)" }}
          >
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--qr-primary)" }}
          >
            ผ่านจุดที่ {state.checkpointIndex} แล้ว!
          </h2>
          <p className="text-gray-500 text-sm">
            ไปสแกนจุดเช็คพอยต์ถัดไปเพื่อเล่นต่อ
          </p>
        </div>
      </div>
    );
  }

  // state.type === "question"
  return (
    <div className="flex flex-col gap-6">
      <CheckpointProgress
        checkpoints={progress.checkpoints}
        currentIndex={state.checkpointIndex}
        total={progress.total}
        completed={progress.completed}
      />
      <CheckpointQuestionCard
        key={state.question.id}
        questionId={state.question.id}
        questionText={state.question.text}
        choices={state.question.choices}
        sessionCheckpointId={state.sessionCheckpointId}
        checkpointToken={checkpointToken}
        campaign={campaign}
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
