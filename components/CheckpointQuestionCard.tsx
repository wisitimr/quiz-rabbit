"use client";

import { useState, useCallback } from "react";
import { QuizChoice, CampaignWithConfig, QuizCharacter } from "@/lib/types";
import CharacterDisplay from "./CharacterDisplay";

// ============================================================
// CheckpointQuestionCard - คำถามสำหรับระบบ checkpoint
// ============================================================
// ตอบถูก → onCorrectAnswer / onAllComplete
// ตอบผิด (no rotate) → แสดงปุ่ม "ลองอีกครั้ง"
// ตอบผิด (rotate) → รับคำถามใหม่ผ่าน onQuestionRotate
// ============================================================

interface CheckpointQuestionCardProps {
  questionId: number;
  questionText: string;
  choices: QuizChoice[];
  sessionCheckpointId: number;
  checkpointToken: string;
  campaign: CampaignWithConfig;
  /** checkpoint index (1-based) — ใช้เลือก sceneChar ที่ตรงกับจุด */
  checkpointIndex: number;
  onCorrectAnswer?: () => void;
  onAllComplete?: (redeemToken: string) => void;
  onQuestionRotate?: (newQuestion: {
    id: number;
    text: string;
    choices: QuizChoice[];
  }) => void;
}

type AnswerState = "idle" | "submitting" | "correct" | "wrong";

export default function CheckpointQuestionCard({
  questionId,
  questionText,
  choices,
  sessionCheckpointId,
  campaign,
  checkpointIndex,
  onCorrectAnswer,
  onAllComplete,
  onQuestionRotate,
}: CheckpointQuestionCardProps) {
  // เลือกตัวละครตามเลขจุดเช็คพอยต์ (1-based → 0-based)
  const sceneChars = campaign.sceneCharacters;
  const character: QuizCharacter = sceneChars?.length
    ? sceneChars[(checkpointIndex - 1) % sceneChars.length]
    : campaign.sceneCharacters[0];
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [correctChoiceId, setCorrectChoiceId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!selectedChoiceId || answerState !== "idle") return;

    setAnswerState("submitting");

    try {
      const liffIdToken = await getLiffIdToken();

      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionCheckpointId,
          questionId,
          choiceId: selectedChoiceId,
          liffIdToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit answer");
      }

      const data = await response.json();

      setCorrectChoiceId(data.correctChoiceId);
      setExplanation(data.explanation);

      if (data.isCorrect) {
        setAnswerState("correct");

        if (data.redeemToken) {
          // All checkpoints complete
          onAllComplete?.(data.redeemToken);
        } else {
          onCorrectAnswer?.();
        }
      } else {
        setAnswerState("wrong");

        if (data.newQuestion) {
          // Question rotated — wait for user to see result, then rotate
          setTimeout(() => {
            onQuestionRotate?.(data.newQuestion);
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      setAnswerState("idle");
    }
  }, [
    selectedChoiceId,
    sessionCheckpointId,
    questionId,
    answerState,
    onCorrectAnswer,
    onAllComplete,
    onQuestionRotate,
  ]);

  const handleRetry = useCallback(() => {
    setSelectedChoiceId(null);
    setAnswerState("idle");
    setCorrectChoiceId(null);
    setExplanation(null);
  }, []);

  const answered = answerState === "correct" || answerState === "wrong";

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
      {/* ตัวละคร */}
      <div className="flex justify-center py-2">
        <CharacterDisplay
          character={character}
          state={answered ? (answerState as "correct" | "wrong") : "idle"}
          showPhrase={answered}
        />
      </div>

      {/* คำถาม */}
      <div
        className="p-5 rounded-2xl"
        style={{
          backgroundColor: "var(--qr-card)",
          boxShadow: `0 4px 16px var(--qr-shadow)`,
        }}
      >
        <h2
          className="font-bold mb-4 leading-relaxed"
          style={{ fontSize: "var(--qr-q-size)" }}
        >
          {questionText}
        </h2>

        {/* ตัวเลือก */}
        <div className="flex flex-col gap-3">
          {choices.map((choice) => {
            let buttonStyle: React.CSSProperties = {
              borderRadius: "var(--qr-btn-radius)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "transparent",
            };

            if (answered) {
              if (choice.id === correctChoiceId) {
                buttonStyle = {
                  ...buttonStyle,
                  backgroundColor: "var(--qr-correct)",
                  color: "white",
                  borderColor: "var(--qr-correct)",
                };
              } else if (
                choice.id === selectedChoiceId &&
                answerState === "wrong"
              ) {
                buttonStyle = {
                  ...buttonStyle,
                  backgroundColor: "var(--qr-wrong)",
                  color: "white",
                  borderColor: "var(--qr-wrong)",
                };
              } else {
                buttonStyle = {
                  ...buttonStyle,
                  backgroundColor: "#f0f0f0",
                  color: "#999",
                };
              }
            } else {
              if (choice.id === selectedChoiceId) {
                buttonStyle = {
                  ...buttonStyle,
                  backgroundColor: "var(--qr-btn)",
                  color: "var(--qr-btn-text)",
                  borderColor: "var(--qr-btn)",
                };
              } else {
                buttonStyle = {
                  ...buttonStyle,
                  backgroundColor: "var(--qr-card)",
                  color: "#333",
                  borderColor: "#e0e0e0",
                };
              }
            }

            return (
              <button
                key={choice.id}
                onClick={() => {
                  if (!answered && answerState !== "submitting") {
                    setSelectedChoiceId(choice.id);
                  }
                }}
                disabled={answered || answerState === "submitting"}
                className="w-full p-3 text-left font-medium transition-all duration-200 active:scale-[0.98]"
                style={buttonStyle}
              >
                {choice.choice_text}
              </button>
            );
          })}
        </div>
      </div>

      {/* คำอธิบายหลังตอบ */}
      {answered && explanation && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            backgroundColor:
              answerState === "correct"
                ? "rgba(46, 204, 113, 0.1)"
                : "rgba(231, 76, 60, 0.1)",
            color: "#333",
          }}
        >
          <p className="font-bold mb-1">
            {answerState === "correct" ? "ถูกต้อง!" : "ผิด"}
          </p>
          <p>{explanation}</p>
        </div>
      )}

      {/* ปุ่ม */}
      {!answered ? (
        <button
          onClick={handleSubmit}
          disabled={!selectedChoiceId || answerState === "submitting"}
          className="w-full py-3 font-bold text-lg transition-all duration-200 disabled:opacity-50"
          style={{
            backgroundColor: "var(--qr-btn)",
            color: "var(--qr-btn-text)",
            borderRadius: "var(--qr-btn-radius)",
          }}
        >
          {answerState === "submitting" ? "กำลังส่ง..." : "ส่งคำตอบ"}
        </button>
      ) : answerState === "wrong" && !campaign.campaign.retry_rotate_question ? (
        <button
          onClick={handleRetry}
          className="w-full py-3 font-bold text-lg transition-all duration-200"
          style={{
            backgroundColor: "var(--qr-btn)",
            color: "var(--qr-btn-text)",
            borderRadius: "var(--qr-btn-radius)",
          }}
        >
          ลองอีกครั้ง
        </button>
      ) : null}
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

declare global {
  interface Window {
    liff?: {
      getIDToken(): string | null;
      init(config: { liffId: string }): Promise<void>;
      isLoggedIn(): boolean;
      login(): void;
      scanCodeV2(): Promise<{ value: string | null }>;
    };
  }
}
