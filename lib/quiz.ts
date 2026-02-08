import { queryOne, query, withTransaction } from "./db";
import {
  CampaignWithConfig,
  CheckpointToken,
  LineUser,
  QuizChoice,
  RedeemToken,
  SessionCheckpoint,
  UserSession,
} from "./types";
import { mergeTheme } from "./theme";
import crypto from "crypto";

// ============================================================
// Quiz Core Logic v2 - Checkpoint-Based System
// ============================================================

// --- User Management ---

export async function findOrCreateUser(
  lineUid: string,
  displayName?: string,
  pictureUrl?: string
): Promise<LineUser> {
  const user = await queryOne<LineUser>(
    `INSERT INTO line_users (line_uid, display_name, picture_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (line_uid)
     DO UPDATE SET
       display_name = COALESCE($2, line_users.display_name),
       picture_url = COALESCE($3, line_users.picture_url)
     RETURNING id, line_uid, display_name, picture_url`,
    [lineUid, displayName ?? null, pictureUrl ?? null]
  );

  if (!user) throw new Error("Failed to create/find user");
  return user;
}

// --- Campaign ---

export async function getCampaignWithConfig(
  campaignId: number
): Promise<CampaignWithConfig | null> {
  const row = await queryOne<{
    campaign_id: number;
    slug: string;
    title: string;
    description: string | null;
    theme_id: number;
    character_id: number;
    is_active: boolean;
    total_checkpoints: number;
    retry_rotate_question: boolean;
    theme_config: Record<string, string>;
    char_id: number;
    char_name: string;
    asset_idle: string;
    asset_correct: string;
    asset_wrong: string;
    char_metadata: Record<string, unknown>;
  }>(
    `SELECT
       c.id AS campaign_id, c.slug, c.title, c.description,
       c.theme_id, c.character_id, c.is_active,
       c.total_checkpoints, c.retry_rotate_question,
       t.config AS theme_config,
       ch.id AS char_id, ch.name AS char_name,
       ch.asset_idle, ch.asset_correct, ch.asset_wrong,
       ch.metadata AS char_metadata
     FROM quiz_campaigns c
     JOIN quiz_themes t ON t.id = c.theme_id
     JOIN quiz_characters ch ON ch.id = c.character_id
     WHERE c.id = $1`,
    [campaignId]
  );

  if (!row) return null;

  return {
    campaign: {
      id: row.campaign_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      theme_id: row.theme_id,
      character_id: row.character_id,
      is_active: row.is_active,
      total_checkpoints: row.total_checkpoints,
      retry_rotate_question: row.retry_rotate_question,
    },
    theme: mergeTheme(row.theme_config),
    character: {
      id: row.char_id,
      name: row.char_name,
      asset_idle: row.asset_idle,
      asset_correct: row.asset_correct,
      asset_wrong: row.asset_wrong,
      metadata: row.char_metadata as unknown as CampaignWithConfig["character"]["metadata"],
    },
  };
}

export async function getCampaignBySlug(
  slug: string
): Promise<CampaignWithConfig | null> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM quiz_campaigns WHERE slug = $1 AND is_active = true`,
    [slug]
  );
  if (!row) return null;
  return getCampaignWithConfig(row.id);
}

// --- Checkpoint Token ---

export async function validateCheckpointToken(
  token: string
): Promise<CheckpointToken | null> {
  return queryOne<CheckpointToken>(
    `SELECT id, token, campaign_id, checkpoint_index, expires_at
     FROM checkpoint_tokens
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
}

// --- User Session ---

export async function getOrCreateUserSession(
  userId: number,
  campaignId: number
): Promise<UserSession> {
  return withTransaction(async (client) => {
    // Try to get existing session
    const existing = (
      await client.query(
        `SELECT * FROM user_sessions
         WHERE user_id = $1 AND campaign_id = $2
         FOR UPDATE`,
        [userId, campaignId]
      )
    ).rows[0] as UserSession | undefined;

    if (existing) return existing;

    // Create new session
    const created = (
      await client.query(
        `INSERT INTO user_sessions (user_id, campaign_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, campaign_id) DO UPDATE SET user_id = user_sessions.user_id
         RETURNING *`,
        [userId, campaignId]
      )
    ).rows[0] as UserSession;

    return created;
  });
}

// --- Checkpoint Question Assignment ---

export async function getOrAssignCheckpointQuestion(
  sessionId: number,
  checkpointIndex: number,
  campaignId: number
): Promise<{
  sessionCheckpoint: SessionCheckpoint;
  question: { id: number; question_text: string; explanation: string | null } | null;
  choices: QuizChoice[];
} | null> {
  return withTransaction(async (client) => {
    // Get or create session_checkpoint
    let scp = (
      await client.query(
        `SELECT * FROM session_checkpoints
         WHERE session_id = $1 AND checkpoint_index = $2
         FOR UPDATE`,
        [sessionId, checkpointIndex]
      )
    ).rows[0] as SessionCheckpoint | undefined;

    if (!scp) {
      // First visit to this checkpoint — assign a random question
      const question = (
        await client.query(
          `SELECT id, question_text, explanation
           FROM quiz_questions
           WHERE campaign_id = $1 AND is_active = true
           ORDER BY RANDOM()
           LIMIT 1`,
          [campaignId]
        )
      ).rows[0] as { id: number; question_text: string; explanation: string | null } | undefined;

      if (!question) return null;

      scp = (
        await client.query(
          `INSERT INTO session_checkpoints (session_id, checkpoint_index, assigned_question_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (session_id, checkpoint_index)
           DO UPDATE SET session_id = session_checkpoints.session_id
           RETURNING *`,
          [sessionId, checkpointIndex, question.id]
        )
      ).rows[0] as SessionCheckpoint;
    }

    // If already completed, return checkpoint info with no question
    if (scp.is_completed) {
      return { sessionCheckpoint: scp, question: null, choices: [] };
    }

    // Get the assigned question
    if (!scp.assigned_question_id) return null;

    const question = (
      await client.query(
        `SELECT id, question_text, explanation
         FROM quiz_questions WHERE id = $1`,
        [scp.assigned_question_id]
      )
    ).rows[0] as { id: number; question_text: string; explanation: string | null };

    if (!question) return null;

    // Get choices (no is_correct)
    const choices = (
      await client.query(
        `SELECT id, question_id, choice_text, sort_order
         FROM quiz_choices
         WHERE question_id = $1
         ORDER BY sort_order`,
        [question.id]
      )
    ).rows as QuizChoice[];

    return { sessionCheckpoint: scp, question, choices };
  });
}

// --- Submit Checkpoint Answer ---

export async function submitCheckpointAnswer(
  sessionCheckpointId: number,
  questionId: number,
  choiceId: number,
  userId: number
): Promise<{
  isCorrect: boolean;
  correctChoiceId: number;
  explanation: string | null;
  isCheckpointComplete: boolean;
  isAllComplete: boolean;
  redeemToken: string | null;
  newQuestion: { id: number; question_text: string; explanation: string | null; choices: QuizChoice[] } | null;
  progress: { completed: number; total: number; checkpoints: { index: number; isCompleted: boolean }[] };
} | null> {
  return withTransaction(async (client) => {
    // Get session_checkpoint with lock + verify ownership
    const scp = (
      await client.query(
        `SELECT sc.*, us.user_id, us.campaign_id, us.id AS session_id
         FROM session_checkpoints sc
         JOIN user_sessions us ON us.id = sc.session_id
         WHERE sc.id = $1
         FOR UPDATE OF sc`,
        [sessionCheckpointId]
      )
    ).rows[0];

    if (!scp) return null;
    if (scp.user_id !== userId) return null;
    if (scp.is_completed) return null;

    // Verify choice belongs to question
    const choice = (
      await client.query(
        `SELECT id, is_correct FROM quiz_choices
         WHERE id = $1 AND question_id = $2`,
        [choiceId, questionId]
      )
    ).rows[0];

    if (!choice) return null;

    const isCorrect: boolean = choice.is_correct;

    // Record attempt
    await client.query(
      `INSERT INTO checkpoint_attempts (session_checkpoint_id, question_id, choice_id, is_correct)
       VALUES ($1, $2, $3, $4)`,
      [sessionCheckpointId, questionId, choiceId, isCorrect]
    );

    // Get correct choice id
    const correctChoice = (
      await client.query(
        `SELECT id FROM quiz_choices WHERE question_id = $1 AND is_correct = true`,
        [questionId]
      )
    ).rows[0];

    // Get explanation
    const questionRow = (
      await client.query(
        `SELECT explanation FROM quiz_questions WHERE id = $1`,
        [questionId]
      )
    ).rows[0];

    let isAllComplete = false;
    let redeemToken: string | null = null;
    let newQuestion: { id: number; question_text: string; explanation: string | null; choices: QuizChoice[] } | null = null;

    if (isCorrect) {
      // Mark checkpoint complete
      await client.query(
        `UPDATE session_checkpoints
         SET is_completed = true, completed_at = NOW()
         WHERE id = $1`,
        [sessionCheckpointId]
      );

      // Get campaign total_checkpoints
      const campaign = (
        await client.query(
          `SELECT total_checkpoints FROM quiz_campaigns WHERE id = $1`,
          [scp.campaign_id]
        )
      ).rows[0];

      // Count completed checkpoints
      const completedCount = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM session_checkpoints
           WHERE session_id = $1 AND is_completed = true`,
          [scp.session_id]
        )
      ).rows[0].count;

      if (completedCount >= campaign.total_checkpoints) {
        isAllComplete = true;

        // Mark session completed
        await client.query(
          `UPDATE user_sessions SET completed_at = NOW() WHERE id = $1`,
          [scp.session_id]
        );

        // Create redeem token (idempotent)
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const redeemRow = (
          await client.query(
            `INSERT INTO redeem_tokens (token, session_id, expires_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id) DO UPDATE SET session_id = redeem_tokens.session_id
             RETURNING token`,
            [token, scp.session_id, expiresAt.toISOString()]
          )
        ).rows[0];
        redeemToken = redeemRow.token;
      }
    } else {
      // Wrong answer — check if we should rotate the question
      const campaign = (
        await client.query(
          `SELECT retry_rotate_question FROM quiz_campaigns WHERE id = $1`,
          [scp.campaign_id]
        )
      ).rows[0];

      if (campaign.retry_rotate_question) {
        // Get all previously attempted question IDs for this checkpoint
        const attemptedIds = (
          await client.query(
            `SELECT DISTINCT question_id FROM checkpoint_attempts
             WHERE session_checkpoint_id = $1`,
            [sessionCheckpointId]
          )
        ).rows.map((r: { question_id: number }) => r.question_id);

        // Find a new question NOT IN previously attempted
        const nextQ = (
          await client.query(
            `SELECT id, question_text, explanation
             FROM quiz_questions
             WHERE campaign_id = $1
               AND is_active = true
               AND id != ALL($2::bigint[])
             ORDER BY RANDOM()
             LIMIT 1`,
            [scp.campaign_id, attemptedIds]
          )
        ).rows[0] as { id: number; question_text: string; explanation: string | null } | undefined;

        if (nextQ) {
          // Assign new question to checkpoint
          await client.query(
            `UPDATE session_checkpoints SET assigned_question_id = $1 WHERE id = $2`,
            [nextQ.id, sessionCheckpointId]
          );

          const nextChoices = (
            await client.query(
              `SELECT id, question_id, choice_text, sort_order
               FROM quiz_choices WHERE question_id = $1 ORDER BY sort_order`,
              [nextQ.id]
            )
          ).rows as QuizChoice[];

          newQuestion = { ...nextQ, choices: nextChoices };
        } else {
          // All questions exhausted — cycle back: pick random from all campaign questions
          const cycledQ = (
            await client.query(
              `SELECT id, question_text, explanation
               FROM quiz_questions
               WHERE campaign_id = $1 AND is_active = true
               ORDER BY RANDOM()
               LIMIT 1`,
              [scp.campaign_id]
            )
          ).rows[0] as { id: number; question_text: string; explanation: string | null } | undefined;

          if (cycledQ) {
            await client.query(
              `UPDATE session_checkpoints SET assigned_question_id = $1 WHERE id = $2`,
              [cycledQ.id, sessionCheckpointId]
            );

            const cycledChoices = (
              await client.query(
                `SELECT id, question_id, choice_text, sort_order
                 FROM quiz_choices WHERE question_id = $1 ORDER BY sort_order`,
                [cycledQ.id]
              )
            ).rows as QuizChoice[];

            newQuestion = { ...cycledQ, choices: cycledChoices };
          }
        }
      }
      // If not rotating, keep the same question — client will show retry
    }

    // Get progress
    const progress = await getSessionProgressInTx(client, scp.session_id, scp.campaign_id);

    return {
      isCorrect,
      correctChoiceId: correctChoice.id,
      explanation: questionRow.explanation,
      isCheckpointComplete: isCorrect,
      isAllComplete,
      redeemToken,
      newQuestion,
      progress,
    };
  });
}

// --- Session Progress ---

async function getSessionProgressInTx(
  client: import("pg").PoolClient,
  sessionId: number,
  campaignId: number
): Promise<{ completed: number; total: number; checkpoints: { index: number; isCompleted: boolean }[] }> {
  const campaign = (
    await client.query(
      `SELECT total_checkpoints FROM quiz_campaigns WHERE id = $1`,
      [campaignId]
    )
  ).rows[0];

  const checkpoints = (
    await client.query(
      `SELECT checkpoint_index, is_completed
       FROM session_checkpoints
       WHERE session_id = $1
       ORDER BY checkpoint_index`,
      [sessionId]
    )
  ).rows as { checkpoint_index: number; is_completed: boolean }[];

  const total = campaign.total_checkpoints;
  const completedCount = checkpoints.filter((c) => c.is_completed).length;

  // Build full checkpoint status array
  const checkpointStatus: { index: number; isCompleted: boolean }[] = [];
  for (let i = 1; i <= total; i++) {
    const cp = checkpoints.find((c) => c.checkpoint_index === i);
    checkpointStatus.push({ index: i, isCompleted: cp?.is_completed ?? false });
  }

  return { completed: completedCount, total, checkpoints: checkpointStatus };
}

export async function getSessionProgress(
  sessionId: number,
  campaignId: number
): Promise<{ completed: number; total: number; checkpoints: { index: number; isCompleted: boolean }[] }> {
  const campaign = await queryOne<{ total_checkpoints: number }>(
    `SELECT total_checkpoints FROM quiz_campaigns WHERE id = $1`,
    [campaignId]
  );

  if (!campaign) return { completed: 0, total: 0, checkpoints: [] };

  const checkpoints = await query<{ checkpoint_index: number; is_completed: boolean }>(
    `SELECT checkpoint_index, is_completed
     FROM session_checkpoints
     WHERE session_id = $1
     ORDER BY checkpoint_index`,
    [sessionId]
  );

  const total = campaign.total_checkpoints;
  const completedCount = checkpoints.filter((c) => c.is_completed).length;

  const checkpointStatus: { index: number; isCompleted: boolean }[] = [];
  for (let i = 1; i <= total; i++) {
    const cp = checkpoints.find((c) => c.checkpoint_index === i);
    checkpointStatus.push({ index: i, isCompleted: cp?.is_completed ?? false });
  }

  return { completed: completedCount, total, checkpoints: checkpointStatus };
}

// --- Redeem Token ---

export async function getExistingRedeemToken(
  sessionId: number
): Promise<RedeemToken | null> {
  return queryOne<RedeemToken>(
    `SELECT * FROM redeem_tokens
     WHERE session_id = $1 AND is_used = false AND expires_at > NOW()`,
    [sessionId]
  );
}

export async function createRedeemToken(
  sessionId: number,
  ttlDays: number = 7
): Promise<RedeemToken> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const row = await queryOne<RedeemToken>(
    `INSERT INTO redeem_tokens (token, session_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO UPDATE SET session_id = redeem_tokens.session_id
     RETURNING *`,
    [token, sessionId, expiresAt.toISOString()]
  );

  if (!row) throw new Error("Failed to create redeem token");
  return row;
}

export async function validateAndConsumeRedeemToken(
  token: string,
  kioskId: string
): Promise<{ sessionId: number; campaignTitle: string; campaignSlug: string; redeemedAt: string } | null> {
  return withTransaction(async (client) => {
    const row = (
      await client.query(
        `UPDATE redeem_tokens
         SET is_used = true, used_at = NOW(), kiosk_id = $2
         WHERE token = $1 AND is_used = false AND expires_at > NOW()
         RETURNING id, session_id, used_at`,
        [token, kioskId]
      )
    ).rows[0];

    if (!row) return null;

    // Get campaign info
    const session = (
      await client.query(
        `SELECT us.campaign_id, c.title, c.slug
         FROM user_sessions us
         JOIN quiz_campaigns c ON c.id = us.campaign_id
         WHERE us.id = $1`,
        [row.session_id]
      )
    ).rows[0];

    return {
      sessionId: row.session_id,
      campaignTitle: session.title,
      campaignSlug: session.slug,
      redeemedAt: row.used_at,
    };
  });
}
