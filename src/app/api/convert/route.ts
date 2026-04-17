import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: { slug?: string; event_type?: string; session_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slug, event_type = 'register', session_id } = body
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Look up influencer
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id')
    .eq('kol_slug', slug)
    .single()

  if (!influencer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Dedup by session_id
  if (session_id) {
    const { data: existing } = await supabase
      .from('conversion_events')
      .select('id')
      .eq('kol_slug', slug)
      .eq('session_id', session_id)
      .eq('event_type', event_type)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, deduped: true })
  }

  await supabase.from('conversion_events').insert({
    kol_slug: slug,
    influencer_id: influencer.id,
    event_type,
    session_id: session_id ?? null,
  })

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
