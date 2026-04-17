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

  const [infRes, commRes, actRes, profRes] = await Promise.all([
    supabase
      .from('influencers')
      .select('*, assigned_profile:profiles!influencers_assigned_to_fkey(id, display_name, email, avatar_url)')
      .eq('id', id)
      .single(),
    supabase
      .from('communication_logs')
      .select('*, profile:profiles(id, display_name, email, avatar_url)')
      .eq('influencer_id', id)
      .order('contacted_at', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('*, profile:profiles(id, display_name, email, avatar_url)')
      .eq('influencer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url'),
  ])

  if (infRes.error || !infRes.data) notFound()

  return (
    <InfluencerDetail
      influencer={infRes.data as unknown as Influencer}
      communicationLogs={(commRes.data ?? []) as unknown as CommunicationLog[]}
      activityLogs={(actRes.data ?? []) as unknown as ActivityLog[]}
      profiles={(profRes.data ?? []) as Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]}
    />
  )
}
