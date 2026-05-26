export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { InfluencersClient } from './influencers-client'
import type { Influencer, Profile } from '@/types/database'

export default async function InfluencersPage() {
  const supabase = await createClient()

  const { data: raw, error } = await supabase
    .from('influencers')
    .select('*, assigned_profile:profiles!influencers_assigned_to_fkey(id, display_name, avatar_url, email)')
    .order('updated_at', { ascending: false })

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url')

  if (error) {
    // SSR error path — rendered before the i18n provider mounts. Bilingual
    // inline so users on either locale aren't left guessing.
    return (
      <div className="p-6 text-red-600">
        加载失败 / Failed to load: {error.message}
      </div>
    )
  }

  const influencers = (raw ?? []) as Influencer[]
  const profiles = (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]

  return (
    <Suspense fallback={<div className="p-6 text-gray-400 text-sm">加载中… / Loading…</div>}>
      <InfluencersClient initialInfluencers={influencers} profiles={profiles} />
    </Suspense>
  )
}
