import { NextRequest, NextResponse } from "next/server";
import { verifyLiffToken } from "@/lib/liff";
import { findOrCreateUser, submitCheckpointAnswer } from "@/lib/quiz";

// ============================================================
// POST /api/answer
// ============================================================
// Body: { sessionCheckpointId, questionId, choiceId, liffIdToken }
// Flow: verify LIFF → submit answer → return result
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionCheckpointId, questionId, choiceId, liffIdToken } = body;

    if (!sessionCheckpointId || !questionId || !choiceId || !liffIdToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Verify LIFF token
    const payload = await verifyLiffToken(liffIdToken);

    // 2. Find user
    const user = await findOrCreateUser(
      payload.sub,
      payload.name,
      payload.picture
    );

    // 3. Submit answer
    const result = await submitCheckpointAnswer(
      sessionCheckpointId,
      questionId,
      choiceId,
      user.id
    );

    if (!result) {
      return NextResponse.json(
        { error: "Invalid answer submission" },
        { status: 400 }
      );
    }

    // 4. Build response
    const response: Record<string, unknown> = {
      isCorrect: result.isCorrect,
      correctChoiceId: result.correctChoiceId,
      explanation: result.explanation,
      checkpoint: {
        index: result.checkpointIndex,
        categoryName: result.categoryName,
        isCompleted: result.isCheckpointComplete,
      },
      progress: result.progress,
    };

    if (result.newQuestion) {
      response.newQuestion = {
        id: result.newQuestion.id,
        text: result.newQuestion.question_text,
        choices: result.newQuestion.choices,
      };
    }

    if (result.redeemToken) {
      response.redeemToken = result.redeemToken;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Answer submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
