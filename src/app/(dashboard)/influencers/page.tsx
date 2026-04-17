export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { InfluencersClient } from './influencers-client'
import type { Influencer, Profile } from '@/types/database'

export default async function InfluencersPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw, error } = await supabase
    .from('influencers')
    .select(`
      *,
      assigned_profile:profiles!influencers_assigned_to_fkey (
        id, display_name, avatar_url, email
      )
    `)
    .order('updated_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url')

  if (error) {
    return (
      <div className="p-6 text-red-600">
        加载失败：{error.message}
      </div>
    )
  }

  const influencers = (raw ?? []) as Influencer[]
  const profiles = (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>[]

  return (
    <InfluencersClient
      initialInfluencers={influencers}
      profiles={profiles}
    />
  )
}
