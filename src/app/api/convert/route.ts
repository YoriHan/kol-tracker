import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/convert is called from the public embed script on third-party landing
 * pages, so it runs with no Supabase session cookie.
 *
 * Why the service-role key (not anon):
 *   - conversion_events has RLS that blocks anon SELECT. The previous
 *     select-then-insert dedupe always saw zero rows under the anon key, so
 *     every request inserted a duplicate.
 *   - The service-role key bypasses RLS and stays server-only. It is read
 *     from `SUPABASE_SERVICE_ROLE_KEY` (NOT a `NEXT_PUBLIC_*` var, which would
 *     bundle it into the client) and never appears in log output.
 *
 * Why upsert + ON CONFLICT (not select-then-insert):
 *   - Two near-simultaneous requests with the same
 *     (kol_slug, session_id, event_type) would both pass a SELECT check.
 *   - Migration `20260527_conversion_events_dedupe_index.sql` adds a unique
 *     index on those three columns. The index is non-partial because
 *     PostgREST/Supabase upsert only emits the column list as the conflict
 *     target — it can't express a partial-index predicate, so a partial
 *     index would fail to match. NULL session_ids stay un-deduped because
 *     Postgres treats NULLs as distinct in unique indexes by default.
 *   - `ignoreDuplicates: true` returns no row on conflict, which we read as
 *     "deduped" without a second round-trip.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service-role env vars missing on /api/convert')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: NextRequest) {
  let body: { slug?: string; event_type?: string; session_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slug, event_type = 'register', session_id } = body
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  let supabase
  try {
    supabase = getServiceClient()
  } catch (err) {
    // Don't leak the env-var name into the client response, but do log it
    // so an operator can see what's missing. The error message is hardcoded
    // and never contains the key value.
    console.error('[/api/convert] service client init failed:', (err as Error).message)
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  const { data: influencer, error: lookupErr } = await supabase
    .from('influencers')
    .select('id')
    .eq('kol_slug', slug)
    .single()
  if (lookupErr || !influencer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (session_id) {
    // Race-free path: rely on the partial unique index for dedupe.
    const { data: inserted, error } = await supabase
      .from('conversion_events')
      .upsert(
        {
          kol_slug: slug,
          influencer_id: influencer.id,
          event_type,
          session_id,
        },
        {
          onConflict: 'kol_slug,session_id,event_type',
          ignoreDuplicates: true,
        }
      )
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[/api/convert] upsert failed:', error.message)
      return NextResponse.json({ error: 'insert failed' }, { status: 500 })
    }
    if (!inserted) return NextResponse.json({ ok: true, deduped: true })
    return NextResponse.json({ ok: true })
  }

  // No session_id → no dedupe possible; insert directly.
  const { error } = await supabase.from('conversion_events').insert({
    kol_slug: slug,
    influencer_id: influencer.id,
    event_type,
    session_id: null,
  })
  if (error) {
    console.error('[/api/convert] insert failed:', error.message)
    return NextResponse.json({ error: 'insert failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Also allow OPTIONS for CORS (embed script from external domain)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
