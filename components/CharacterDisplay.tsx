"use client";

import Image from "next/image";
import { QuizCharacter, CharacterMetadata } from "@/lib/types";

// ============================================================
// CharacterDisplay - แสดงตัวละครตามสถานะ (ปกติ/ตอบถูก/ตอบผิด)
// ============================================================

type CharacterState = "idle" | "correct" | "wrong";

interface CharacterDisplayProps {
  character: QuizCharacter;
  state: CharacterState;
  showPhrase?: boolean;
}

// สุ่มเลือกประโยคจาก character metadata
function getRandomPhrase(
  metadata: CharacterMetadata,
  state: CharacterState
): string {
  const phrases =
    state === "correct"
      ? metadata.correctPhrases
      : state === "wrong"
        ? metadata.wrongPhrases
        : [];

  if (!phrases || phrases.length === 0) return "";
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function resolveAssetUrl(
  state: CharacterState,
  character: QuizCharacter
): string {
  if (state === "correct") return character.asset_correct || character.asset_idle;
  if (state === "wrong") return character.asset_wrong || character.asset_idle;
  return character.asset_idle;
}

export default function CharacterDisplay({
  character,
  state,
  showPhrase = false,
}: CharacterDisplayProps) {
  const assetUrl = resolveAssetUrl(state, character);

  const phrase = showPhrase
    ? getRandomPhrase(character.metadata, state)
    : "";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* ตัวละคร: ใช้ animation ต่างกันตามสถานะ */}
      <div
        className={`transition-all duration-500 ${
          state === "correct"
            ? "animate-bounce"
            : state === "wrong"
              ? "animate-pulse"
              : ""
        }`}
      >
        <Image
          src={assetUrl}
          alt={character.name}
          width={120}
          height={150}
          priority
        />
      </div>

      {/* แสดงประโยคตัวละครถ้ามี */}
      {phrase && (
        <div
          className="relative px-4 py-2 rounded-2xl text-sm font-medium max-w-[200px] text-center"
          style={{
            backgroundColor: "var(--qr-card, white)",
            color: "var(--qr-primary, #FF6B9D)",
            boxShadow: `0 2px 8px var(--qr-shadow, rgba(0,0,0,0.1))`,
          }}
        >
          {/* ลูกศรชี้ลง (speech bubble) */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: `8px solid var(--qr-card, white)`,
            }}
          />
          {phrase}
        </div>
      )}
    </div>
  );
}
