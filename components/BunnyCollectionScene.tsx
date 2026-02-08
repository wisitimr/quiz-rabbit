"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// ============================================================
// BunnyCollectionScene v2 — กระต่ายเดินไปมาสวนทางกัน
// ============================================================
//
// หลักการ:
//   - กระต่ายแต่ละตัวเดินไป-กลับ (wander) ด้วย CSS animation บน `left`
//   - สลับทิศ LTR / RTL → ทำให้สวนทางกันได้
//   - 3 เลน (แถว) ที่ bottom% ต่างกัน → มีความลึก
//   - ตัวใหม่เข้ามาด้วย hop animation จากขอบ → แล้วเริ่ม wander
//
// Animation layers (3 ชั้นซ้อนกัน):
//   1. Positioner (outer): animate `left` สำหรับ wander หรือ
//      `transform: translateX` สำหรับ enter
//   2. Facer (middle): animate `scaleX` เพื่อหันหน้าตามทิศเดิน
//   3. Bobber (inner): animate `translateY` เด้งขึ้นลงเบา ๆ
//
// ทำไมต้อง 3 ชั้น:
//   - CSS animation ใช้ `transform` ได้ตัวเดียวต่อ element
//   - แยก scaleX (หันหน้า) กับ translateY (เด้ง) คนละ element
//   - wander ใช้ `left` (ไม่ใช่ transform) เพื่อไม่ชนกัน
// ============================================================

export interface CharacterConfig {
  /** asset URLs — one per slot (different character each) */
  assets: string[];
  sizePx?: number;
}

export interface SceneThemeConfig {
  backgroundImage: string;
  radiusPx: string;
}

interface BunnyCollectionSceneProps {
  collected: number;
  max?: number;
  /** เพิ่มทีละ 1 เมื่อตอบถูก — trigger enter animation สำหรับตัวใหม่ */
  spawnKey: number;
  characterConfig: CharacterConfig;
  themeConfig: SceneThemeConfig;
}

// --- Bunny instance data ---

interface BunnyInstance {
  id: number;
  lane: number;        // 0, 1, 2
  direction: "ltr" | "rtl";
  speedMs: number;     // wander round-trip duration
  xFrom: number;       // left bound (%)
  xTo: number;         // right bound (%)
  phaseOffsetMs: number;
  isEntering: boolean;
}

// Lane Y positions: bottom % — lower number = higher on screen (farther away)
const LANE_BOTTOM = [34, 28, 22];

// Deterministic pseudo-random helpers (no Math.random → SSR safe)
function seeded(index: number, salt: number): number {
  return ((index + 1) * (salt + 7)) % 97 / 97; // 0..1
}

function createBunny(index: number, entering: boolean): BunnyInstance {
  const direction: "ltr" | "rtl" = index % 2 === 0 ? "ltr" : "rtl";
  const lane = index % 3;

  // Speed: 7000–10000ms round-trip (varies per bunny)
  const speedMs = 7000 + Math.round(seeded(index, 31) * 3000);

  // Wander range: LTR starts left, RTL starts right
  // Ranges overlap in the middle so they cross paths
  let xFrom: number, xTo: number;
  if (direction === "ltr") {
    xFrom = 3 + Math.round(seeded(index, 13) * 15);   // 3–18%
    xTo = 55 + Math.round(seeded(index, 47) * 20);     // 55–75%
  } else {
    xFrom = 25 + Math.round(seeded(index, 19) * 15);   // 25–40%
    xTo = 82 + Math.round(seeded(index, 59) * 15);     // 82–97%
  }

  // Phase offset: stagger pre-existing bunnies, 0 for newly spawned
  const phaseOffsetMs = entering ? 0 : Math.round(seeded(index, 41) * speedMs);

  return { id: index, lane, direction, speedMs, xFrom, xTo, phaseOffsetMs, isEntering: entering };
}

export default function BunnyCollectionScene({
  collected,
  max = 5,
  spawnKey,
  characterConfig,
  themeConfig,
}: BunnyCollectionSceneProps) {
  const safeCollected = Math.max(0, Math.min(collected, max));
  const charSize = characterConfig.sizePx ?? 48;

  // Anti-replay: track previous spawnKey to detect new spawns vs mount
  const prevKeyRef = useRef(spawnKey);
  const [bunnies, setBunnies] = useState<BunnyInstance[]>([]);

  // On mount: create all pre-existing bunnies (no enter animation)
  // On spawnKey change: add one new bunny with enter animation
  useEffect(() => {
    if (prevKeyRef.current === spawnKey) {
      // Mount: create all existing bunnies
      const initial: BunnyInstance[] = [];
      for (let i = 0; i < safeCollected; i++) {
        initial.push(createBunny(i, false));
      }
      setBunnies(initial);
    } else {
      // New spawn
      prevKeyRef.current = spawnKey;
      const newIndex = safeCollected - 1;
      if (newIndex >= 0 && newIndex < max) {
        const newBunny = createBunny(newIndex, true);
        setBunnies((prev) => [...prev.filter((b) => b.id !== newIndex), newBunny]);

        // After enter animation, switch to wandering
        const timer = setTimeout(() => {
          setBunnies((prev) =>
            prev.map((b) => (b.id === newIndex ? { ...b, isEntering: false } : b))
          );
        }, 650);
        return () => clearTimeout(timer);
      }
    }
  }, [spawnKey, safeCollected, max]);

  // Build per-bunny CSS custom properties for keyframes
  function bunnyStyles(b: BunnyInstance): string {
    return `
      .bcs-bunny-${b.id} {
        --bcs-x-from: ${b.xFrom}%;
        --bcs-x-to: ${b.xTo}%;
      }
    `;
  }

  return (
    <>
      <style>{`
        /* ============================================================
           Wander keyframes: animate 'left' property
           LTR: from → to → from (starts left, walks right, returns)
           RTL: to → from → to (starts right, walks left, returns)
           ============================================================ */
        @keyframes bcs-wander-ltr {
          0%, 100% { left: var(--bcs-x-from); }
          50% { left: var(--bcs-x-to); }
        }
        @keyframes bcs-wander-rtl {
          0%, 100% { left: var(--bcs-x-to); }
          50% { left: var(--bcs-x-from); }
        }

        /* Face direction: snap scaleX at halfway point */
        @keyframes bcs-face-ltr {
          0%, 49.9% { transform: scaleX(1); }
          50%, 99.9% { transform: scaleX(-1); }
          100% { transform: scaleX(1); }
        }
        @keyframes bcs-face-rtl {
          0%, 49.9% { transform: scaleX(-1); }
          50%, 99.9% { transform: scaleX(1); }
          100% { transform: scaleX(-1); }
        }

        /* Walk bob: gentle bounce */
        @keyframes bcs-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        /* Enter animations: hop in from edge */
        @keyframes bcs-enter-ltr {
          0% { transform: translateX(-100px); opacity: 0; }
          40% { transform: translateX(12px); opacity: 1; }
          65% { transform: translateX(-4px); }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes bcs-enter-rtl {
          0% { transform: translateX(100px); opacity: 0; }
          40% { transform: translateX(-12px); opacity: 1; }
          65% { transform: translateX(4px); }
          100% { transform: translateX(0); opacity: 1; }
        }

        /* Accessibility: disable all animations */
        @media (prefers-reduced-motion: reduce) {
          .bcs-positioner, .bcs-facer, .bcs-bobber {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }

        /* Per-bunny custom properties */
        ${bunnies.map(bunnyStyles).join("\n")}
      `}</style>

      <div className="w-full">
        <p
          className="text-sm font-bold mb-2 text-center"
          style={{ color: "var(--qr-primary)" }}
        >
          กระต่ายที่เก็บได้ {safeCollected}/{max}
        </p>

        {/* Scene panel */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: "5 / 3",
            borderRadius: themeConfig.radiusPx,
          }}
        >
          {/* Background image via next/image */}
          <Image
            src={themeConfig.backgroundImage}
            alt="Scene background"
            fill
            className="object-cover"
            priority
          />

          {/* ============================================================
              Bunny instances: 3-layer animation nesting
              Layer 1 (positioner): wander via `left` or enter via translateX
              Layer 2 (facer): scaleX flip to face direction
              Layer 3 (bobber): translateY walk bounce
              ============================================================ */}
          {bunnies.map((b) => {
            const laneBottom = LANE_BOTTOM[b.lane] ?? LANE_BOTTOM[0];

            if (b.isEntering) {
              // Enter animation: position at start point, animate translateX
              const startLeft = b.direction === "ltr" ? `${b.xFrom}%` : `${b.xTo}%`;
              return (
                <div
                  key={b.id}
                  className={`bcs-positioner bcs-bunny-${b.id} absolute`}
                  style={{
                    bottom: `${laneBottom}%`,
                    left: startLeft,
                    width: charSize,
                    height: charSize,
                    animation: `bcs-enter-${b.direction} 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                    zIndex: b.lane + 1,
                  }}
                >
                  <div
                    className="bcs-facer"
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: b.direction === "rtl" ? "scaleX(-1)" : "scaleX(1)",
                    }}
                  >
                    <div className="bcs-bobber" style={{ width: "100%", height: "100%" }}>
                      <BunnyImage config={characterConfig} size={charSize} index={b.id} />
                    </div>
                  </div>
                </div>
              );
            }

            // Wandering: animate left + face flip + bob
            return (
              <div
                key={b.id}
                className={`bcs-positioner bcs-bunny-${b.id} absolute`}
                style={{
                  bottom: `${laneBottom}%`,
                  width: charSize,
                  height: charSize,
                  animation: `bcs-wander-${b.direction} ${b.speedMs}ms ease-in-out infinite`,
                  animationDelay: `-${b.phaseOffsetMs}ms`,
                  zIndex: b.lane + 1,
                }}
              >
                <div
                  className="bcs-facer"
                  style={{
                    width: "100%",
                    height: "100%",
                    animation: `bcs-face-${b.direction} ${b.speedMs}ms step-end infinite`,
                    animationDelay: `-${b.phaseOffsetMs}ms`,
                  }}
                >
                  <div
                    className="bcs-bobber"
                    style={{
                      width: "100%",
                      height: "100%",
                      animation: "bcs-bob 350ms ease-in-out infinite",
                    }}
                  >
                    <BunnyImage config={characterConfig} size={charSize} index={b.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Bunny image renderer (picks asset by index, wraps around) ---
function BunnyImage({
  config,
  size,
  index,
}: {
  config: CharacterConfig;
  size: number;
  index: number;
}) {
  const src = config.assets[index % config.assets.length];
  return (
    <Image
      src={src}
      alt={`Character ${index + 1}`}
      width={size}
      height={size}
      priority={false}
    />
  );
}
