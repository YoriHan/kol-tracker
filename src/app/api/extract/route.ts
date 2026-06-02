import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ExtractedFields, Influencer, InfluencerStage } from '@/types/database'

// Subsets we read from Supabase. Pick<> keeps these in sync with
// schema.sql via the Influencer interface.
type LogForExtraction = {
  id: string
  summary: string
  extraction_status: 'pending' | 'ready' | 'applied' | 'discarded'
  influencer_id: string
  contacted_at: string
}
type InfluencerForExtraction = Pick<
  Influencer,
  | 'id'
  | 'twitter_handle'
  | 'display_name'
  | 'current_stage'
  | 'quote_per_post'
  | 'contract_value'
  | 'next_followup_date'
  | 'next_followup_note'
  | 'risk_flags'
>

/**
 * /api/extract — paste-then-extract worker.
 *
 * Flow:
 *   1. Authenticated user pastes a DM/email summary into a
 *      communication_log (existing flow in influencer-detail.tsx).
 *   2. UI calls POST /api/extract with the new log id.
 *   3. This route reads the log + the influencer's current state via
 *      the user's RLS-bound client (NOT service role — the user
 *      already has access to anything they can extract on).
 *   4. Calls Claude with a structured-output tool call that returns
 *      ExtractedFields.
 *   5. Writes the result onto the log row, flips extraction_status
 *      to 'ready'.
 *   6. UI (next PR) renders a diff card; user approves to apply.
 *
 * What this route does NOT do:
 *   - It does not apply extraction to the influencer row. That is a
 *     separate user-confirmed action (next PR's `/api/extract/apply`).
 *   - It does not sweep historical logs. Per task #17, backfill is an
 *     explicit user action; this route only processes the log id the
 *     caller hands in. Status guard makes it idempotent.
 *
 * Env required (Yori, Vercel project settings):
 *   ANTHROPIC_API_KEY — server-only, no NEXT_PUBLIC_ prefix.
 */

const MODEL = 'claude-sonnet-4-5'

const STAGES: InfluencerStage[] = [
  '待接触', '已发DM', '谈判中', '已签约',
  '合作中-Draft1', '合作中-Draft2',
  '待发布', '已发送', '已发Invoice', '已付款', '完成',
]

// Tool schema mirrors `ExtractedFields` in src/types/database.ts.
// Every field is optional — the model is instructed to omit a field
// when the source text doesn't say anything about it, rather than
// guessing or restating the previous value.
const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'record_extraction',
  description:
    'Record structured fields extracted from a KOL communication log. ' +
    'Only include fields that the source text actually addresses; ' +
    'omit anything the text does not mention or that is genuinely ambiguous.',
  input_schema: {
    type: 'object',
    properties: {
      current_stage: {
        type: 'string',
        enum: STAGES,
        description:
          'Current collaboration stage in the existing 11-value Chinese ' +
          'enum. Only set when the source text gives clear evidence of a ' +
          'transition (e.g. "我们签了" → 已签约, "我发出去了" → 已发送).',
      },
      quote_per_post: {
        type: 'number',
        description: 'Per-post quote in the original currency (number only).',
      },
      contract_value: {
        type: 'number',
        description: 'Total contract value if the message states one.',
      },
      next_followup_date: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description:
          'YYYY-MM-DD. Only set when the message names a concrete next ' +
          'check-in date or a deadline that implies one.',
      },
      next_followup_note: {
        type: 'string',
        description:
          'Short reason for the next follow-up (e.g. "等对方法务回复"). ' +
          'Pairs with next_followup_date — set both or neither when possible.',
      },
      risk_flags: {
        type: 'object',
        additionalProperties: true,
        description:
          'Open-shape flag map. Known keys: price_sensitive (bool), ' +
          'deadline_risk (low|medium|high), wants_renegotiate (bool), ' +
          'ghosting (bool). Add new keys only if the signal is unambiguous.',
      },
      summary_short: {
        type: 'string',
        description:
          'One-line plain-Chinese summary of what changed in this message. ' +
          'Used as the heading on the review card.',
      },
    },
  },
}

const SYSTEM_PROMPT = `You are an extraction assistant for a Twitter KOL CRM. \
The user will paste a chunk of their conversation with a creator (Twitter DM, \
email, or screenshot transcript). Your job is to call the \
\`record_extraction\` tool with the structured fields that the new message \
genuinely changes or specifies.

Rules:
- Only include fields the message actually addresses. Do NOT restate the \
  influencer's existing values just to fill in the blanks.
- For \`current_stage\`: only advance when there is clear evidence. A creator \
  saying "I'll think about it" is still 谈判中, not 已签约.
- For dates: use the message's own date framing ("下周三", "月底前") and \
  resolve against the conversation timestamp. If you cannot pin a concrete \
  date, omit \`next_followup_date\`.
- Numbers: extract only what's explicitly stated. Do not estimate.
- \`summary_short\`: write in plain Chinese, ≤ 30 chars, focused on the \
  delta from the previous state — not a generic recap.
- If the message is small talk or has no signal worth recording, call the \
  tool with an empty object \`{}\`.

Always call the tool exactly once. Do not produce free-form text.`

export async function POST(req: NextRequest) {
  // ----- 1. parse body --------------------------------------------------
  let body: { communication_log_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const logId = body.communication_log_id
  if (!logId || typeof logId !== 'string') {
    return NextResponse.json(
      { error: 'communication_log_id required' },
      { status: 400 },
    )
  }

  // ----- 2. env check ---------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Don't leak which env var is missing in the response — log it
    // server-side and return a generic message.
    console.error('[/api/extract] ANTHROPIC_API_KEY missing')
    return NextResponse.json(
      { error: 'extraction unavailable' },
      { status: 503 },
    )
  }

  // ----- 3. auth + RLS-bound DB ----------------------------------------
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // ----- 4. fetch the log + parent influencer (RLS-bound) --------------
  const logRes = await supabase
    .from('communication_logs')
    .select('id, summary, extraction_status, influencer_id, contacted_at')
    .eq('id', logId)
    .single<LogForExtraction>()
  if (logRes.error || !logRes.data) {
    return NextResponse.json({ error: 'log not found' }, { status: 404 })
  }
  const log = logRes.data

  // Idempotency — if extraction already ran (or was discarded), return
  // current state instead of re-billing.
  if (log.extraction_status !== 'pending') {
    return NextResponse.json(
      { status: log.extraction_status, log_id: log.id },
      { status: 200 },
    )
  }

  const infRes = await supabase
    .from('influencers')
    .select(
      'id, twitter_handle, display_name, current_stage, ' +
      'quote_per_post, contract_value, next_followup_date, ' +
      'next_followup_note, risk_flags',
    )
    .eq('id', log.influencer_id)
    .single<InfluencerForExtraction>()
  if (infRes.error || !infRes.data) {
    return NextResponse.json({ error: 'influencer not found' }, { status: 404 })
  }
  const influencer = infRes.data

  // ----- 5. call Claude with structured-output tool --------------------
  const client = new Anthropic({ apiKey })

  // The system prompt is invariant across requests, so cache it.
  // Per-request inputs (influencer state + summary) go in the user
  // turn and are not cached.
  let extracted: ExtractedFields
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_extraction' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Influencer current state:\n` +
                JSON.stringify(
                  {
                    handle: influencer.twitter_handle,
                    name: influencer.display_name,
                    current_stage: influencer.current_stage,
                    quote_per_post: influencer.quote_per_post,
                    contract_value: influencer.contract_value,
                    next_followup_date: influencer.next_followup_date,
                    next_followup_note: influencer.next_followup_note,
                    risk_flags: influencer.risk_flags,
                  },
                  null,
                  2,
                ) +
                `\n\nMessage timestamp: ${log.contacted_at}\n\n` +
                `New conversation chunk:\n${log.summary}`,
            },
          ],
        },
      ],
    })

    const toolBlock = resp.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolBlock || toolBlock.name !== 'record_extraction') {
      throw new Error('model did not call record_extraction')
    }
    extracted = toolBlock.input as ExtractedFields
  } catch (e) {
    // Surface a generic error; full detail goes to server logs only.
    console.error('[/api/extract] Anthropic call failed', e)
    return NextResponse.json({ error: 'extraction failed' }, { status: 502 })
  }

  // ----- 6. write back -------------------------------------------------
  const { error: writeErr } = await supabase
    .from('communication_logs')
    .update({
      extracted,
      extraction_status: 'ready',
      extraction_model: MODEL,
    })
    .eq('id', logId)

  if (writeErr) {
    console.error('[/api/extract] DB write failed', writeErr)
    return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  }

  return NextResponse.json(
    { status: 'ready', log_id: logId, extracted },
    { status: 200 },
  )
}
