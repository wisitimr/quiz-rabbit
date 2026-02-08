import { queryOne, query, withTransaction } from "./db";
import {
  CampaignWithConfig,
  CheckpointToken,
  LineUser,
  QuizCharacter,
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
    is_active: boolean;
    total_checkpoints: number;
    retry_rotate_question: boolean;
    scene_background_url: string;
    scene_characters: number[];
    theme_config: Record<string, string>;
  }>(
    `SELECT
       c.id AS campaign_id, c.slug, c.title, c.description,
       c.theme_id, c.is_active,
       c.total_checkpoints, c.retry_rotate_question,
       c.scene_background_url, c.scene_characters,
       t.config AS theme_config
     FROM quiz_campaigns c
     JOIN quiz_themes t ON t.id = c.theme_id
     WHERE c.id = $1`,
    [campaignId]
  );

  if (!row) return null;

  // Resolve scene character IDs → full QuizCharacter objects
  let sceneCharacters: QuizCharacter[] = [];
  const charIds = row.scene_characters;
  if (charIds?.length) {
    const chars = await query<{
      id: number;
      name: string;
      asset_idle: string;
      asset_correct: string;
      asset_wrong: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT id, name, asset_idle, asset_correct, asset_wrong, metadata
       FROM quiz_characters
       WHERE id = ANY($1::bigint[])`,
      [charIds]
    );
    // Maintain order from scene_characters array
    sceneCharacters = charIds
      .map((cid) => chars.find((c) => c.id === cid))
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        asset_idle: c.asset_idle,
        asset_correct: c.asset_correct,
        asset_wrong: c.asset_wrong,
        metadata: c.metadata as unknown as QuizCharacter["metadata"],
      }));
  }

  return {
    campaign: {
      id: row.campaign_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      theme_id: row.theme_id,
      is_active: row.is_active,
      total_checkpoints: row.total_checkpoints,
      retry_rotate_question: row.retry_rotate_question,
      scene_background_url: row.scene_background_url,
      scene_characters: row.scene_characters,
    },
    theme: mergeTheme(row.theme_config),
    sceneCharacters,
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
): Promise<(CheckpointToken & { category_name: string }) | null> {
  return queryOne<CheckpointToken & { category_name: string }>(
    `SELECT ct.id, ct.token, ct.campaign_id, ct.checkpoint_index,
            ct.category_id, ct.expires_at,
            qc.name AS category_name
     FROM checkpoint_tokens ct
     JOIN quiz_categories qc ON qc.id = ct.category_id
     WHERE ct.token = $1 AND ct.expires_at > NOW()`,
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
  categoryId: number
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
      // First visit — assign random question from this category's pool
      const question = (
        await client.query(
          `SELECT id, question_text, explanation
           FROM quiz_questions
           WHERE category_id = $1 AND is_active = true
           ORDER BY RANDOM()
           LIMIT 1`,
          [categoryId]
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
  checkpointIndex: number;
  categoryName: string;
  redeemToken: string | null;
  newQuestion: { id: number; question_text: string; explanation: string | null; choices: QuizChoice[] } | null;
  progress: { completed: number; total: number; checkpoints: { index: number; isCompleted: boolean }[] };
} | null> {
  return withTransaction(async (client) => {
    // Get session_checkpoint with lock + verify ownership + resolve category
    const scp = (
      await client.query(
        `SELECT sc.*, us.user_id, us.campaign_id, us.id AS session_id,
                ct.category_id, qc.name AS category_name
         FROM session_checkpoints sc
         JOIN user_sessions us ON us.id = sc.session_id
         JOIN checkpoint_tokens ct ON ct.campaign_id = us.campaign_id
                                  AND ct.checkpoint_index = sc.checkpoint_index
         JOIN quiz_categories qc ON qc.id = ct.category_id
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

        // Find a new question from this category's pool, NOT IN previously attempted
        const nextQ = (
          await client.query(
            `SELECT id, question_text, explanation
             FROM quiz_questions
             WHERE category_id = $1
               AND is_active = true
               AND id != ALL($2::bigint[])
             ORDER BY RANDOM()
             LIMIT 1`,
            [scp.category_id, attemptedIds]
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
          // All questions exhausted — cycle back: pick random from this category's pool
          const cycledQ = (
            await client.query(
              `SELECT id, question_text, explanation
               FROM quiz_questions
               WHERE category_id = $1 AND is_active = true
               ORDER BY RANDOM()
               LIMIT 1`,
              [scp.category_id]
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
      checkpointIndex: scp.checkpoint_index,
      categoryName: scp.category_name,
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
