import { NextRequest, NextResponse } from "next/server";
import { verifyLiffToken } from "@/lib/liff";
import {
  findOrCreateUser,
  validateCheckpointToken,
  getOrCreateUserSession,
  getOrAssignCheckpointQuestion,
  getCampaignWithConfig,
  getSessionProgress,
  getExistingRedeemToken,
} from "@/lib/quiz";

// ============================================================
// GET /api/scan/enter?checkpointToken=...&liffIdToken=...
// ============================================================
// Flow: validate token → verify LIFF → find/create user →
//       get/create session → assign question → return state
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const checkpointToken = searchParams.get("checkpointToken");
    const liffIdToken = searchParams.get("liffIdToken");

    if (!checkpointToken || !liffIdToken) {
      return NextResponse.json(
        { error: "Missing checkpointToken or liffIdToken" },
        { status: 400 }
      );
    }

    // 1. Validate checkpoint token
    const cpToken = await validateCheckpointToken(checkpointToken);
    if (!cpToken) {
      return NextResponse.json(
        { error: "Invalid or expired checkpoint token" },
        { status: 404 }
      );
    }

    // 2. Verify LIFF token
    const payload = await verifyLiffToken(liffIdToken);

    // 3. Find or create user
    const user = await findOrCreateUser(
      payload.sub,
      payload.name,
      payload.picture
    );

    // 4. Get or create session
    const session = await getOrCreateUserSession(user.id, cpToken.campaign_id);

    // 5. Get campaign config
    const campaignConfig = await getCampaignWithConfig(cpToken.campaign_id);
    if (!campaignConfig) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // 6. Assign question for this checkpoint
    const result = await getOrAssignCheckpointQuestion(
      session.id,
      cpToken.checkpoint_index,
      cpToken.category_id
    );

    if (!result) {
      return NextResponse.json(
        { error: "No questions available" },
        { status: 500 }
      );
    }

    // 7. Get progress
    const progress = await getSessionProgress(session.id, cpToken.campaign_id);

    // 8. Check if all checkpoints are complete → include redeem token
    let redeemToken: string | undefined;
    if (progress.completed >= progress.total) {
      const existing = await getExistingRedeemToken(session.id);
      if (existing) {
        redeemToken = existing.token;
      }
    }

    return NextResponse.json({
      campaign: campaignConfig,
      checkpoint: {
        index: cpToken.checkpoint_index,
        categoryName: cpToken.category_name,
        isCompleted: result.sessionCheckpoint.is_completed,
      },
      progress,
      question: result.question
        ? {
            id: result.question.id,
            text: result.question.question_text,
            choices: result.choices,
          }
        : null,
      sessionCheckpointId: result.sessionCheckpoint.id,
      redeemToken,
    });
  } catch (error) {
    console.error("Scan enter error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
