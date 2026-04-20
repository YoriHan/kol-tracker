export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { InfluencerDetail } from './influencer-detail'
import type { Influencer, CommunicationLog, ActivityLog, Profile } from '@/types/database'

export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch influencer without FK join hint to avoid PostgREST ambiguity
  const infRes = await supabase
    .from('influencers')
    .select('*')
    .eq('id', id)
    .single()

  if (infRes.error || !infRes.data) {
    console.error('[detail] influencer fetch error:', infRes.error)
    notFound()
  }

  // Fetch assigned profile separately if set
  let assignedProfile: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'> | null = null
  if (infRes.data.assigned_to) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .eq('id', infRes.data.assigned_to)
      .single()
    assignedProfile = data ?? null
  }

  const [commRes, actRes, profRes] = await Promise.all([
    supabase
      .from('communication_logs')
      .select('*')
      .eq('influencer_id', id)
      .order('contacted_at', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('*')
      .eq('influencer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url'),
  ])

  const influencer = {
    ...infRes.data,
    assigned_profile: assignedProfile,
  } as unknown as Influencer

  return (
    <InfluencerDetail
      influencer={influencer}
      communicationLogs={(commRes.data ?? []) as unknown as CommunicationLog[]}
      activityLogs={(actRes.data ?? []) as unknown as ActivityLog[]}
      profiles={(profRes.data ?? []) as Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]}
    />
  )
}
