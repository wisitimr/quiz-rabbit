import { notFound } from "next/navigation";
import { validateCheckpointToken, getCampaignWithConfig } from "@/lib/quiz";
import ThemeProvider from "@/components/ThemeProvider";
import CheckpointStage from "@/components/CheckpointStage";
import LiffInitializer from "@/components/LiffInitializer";

// ============================================================
// /scan/[checkpointToken] - SSR Page สำหรับ checkpoint
// ============================================================
// Server: validate checkpoint token + get campaign config
// Client: LIFF auth → call /api/scan/enter → render question
// ============================================================

export const dynamic = "force-dynamic";

interface ScanPageProps {
  params: Promise<{ checkpointToken: string }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { checkpointToken } = await params;

  // Validate checkpoint token (server-side)
  const cpToken = await validateCheckpointToken(checkpointToken);
  if (!cpToken) {
    notFound();
  }

  // Get campaign config for theming
  const campaignConfig = await getCampaignWithConfig(cpToken.campaign_id);
  if (!campaignConfig) {
    notFound();
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

  return (
    <ThemeProvider theme={campaignConfig.theme}>
      <LiffInitializer liffId={liffId}>
        <main className="flex flex-col items-center justify-start min-h-screen p-4 pt-8 max-w-lg mx-auto">
          <h1
            className="font-bold mb-6 text-center"
            style={{
              color: "var(--qr-primary)",
              fontSize: "var(--qr-title-size)",
            }}
          >
            {campaignConfig.campaign.title}
          </h1>

          <CheckpointStage
            checkpointToken={checkpointToken}
            campaign={campaignConfig}
          />
        </main>
      </LiffInitializer>
    </ThemeProvider>
  );
}
