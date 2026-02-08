import { NextRequest, NextResponse } from "next/server";
import { validateAndConsumeRedeemToken } from "@/lib/quiz";

// ============================================================
// POST /api/kiosk/redeem
// ============================================================
// Body: { redeemToken, kioskId }
// Atomic consume → return campaign info
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { redeemToken, kioskId } = body;

    if (!redeemToken || !kioskId) {
      return NextResponse.json(
        { error: "Missing redeemToken or kioskId" },
        { status: 400 }
      );
    }

    const result = await validateAndConsumeRedeemToken(redeemToken, kioskId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid, expired, or already used redeem token",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: {
        title: result.campaignTitle,
        slug: result.campaignSlug,
      },
      redeemedAt: result.redeemedAt,
    });
  } catch (error) {
    console.error("Kiosk redeem error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
