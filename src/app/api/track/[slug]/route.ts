import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Look up influencer by slug (anon policy allows this for kol_slug IS NOT NULL)
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, tracking_url')
    .eq('kol_slug', slug)
    .single()

  if (!influencer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Hash the IP for privacy
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)

  // Record click (public INSERT policy)
  await supabase.from('click_events').insert({
    kol_slug: slug,
    influencer_id: influencer.id,
    ip_hash: ipHash,
    user_agent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
    referrer: request.headers.get('referer')?.slice(0, 500) ?? null,
  })

  // Redirect to destination with ?ref= appended
  const destination = influencer.tracking_url ||
    process.env.NEXT_PUBLIC_DEFAULT_TRACKING_URL ||
    '/'
  const sep = destination.includes('?') ? '&' : '?'
  return NextResponse.redirect(`${destination}${sep}ref=${encodeURIComponent(slug)}`)
}
