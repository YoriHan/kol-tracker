// Auto-generated types matching the Supabase schema
// Run `npx supabase gen types typescript` after connecting your project

export type InfluencerStage =
  | '待接触'
  | '已发DM'
  | '谈判中'
  | '已签约'
  | '合作中-Draft1'
  | '合作中-Draft2'
  | '待发布'
  | '已发送'
  | '已发Invoice'
  | '已付款'
  | '完成'

export type DealType = '推文' | '视频' | 'Story' | '直播' | '其他'
export type ContactMethod = 'DM' | '邮件' | '电话' | '其他'
export type PaymentStatus = '未开票' | '已开票' | '已付款'

// Kanban column groupings
export const KANBAN_COLUMNS = [
  {
    id: 'outreach',
    label: '接触中',
    stages: ['待接触', '已发DM'] as InfluencerStage[],
  },
  {
    id: 'business',
    label: '商务期',
    stages: ['谈判中', '已签约'] as InfluencerStage[],
  },
  {
    id: 'production',
    label: '制作中',
    stages: ['合作中-Draft1', '合作中-Draft2'] as InfluencerStage[],
  },
  {
    id: 'publishing',
    label: '发布收尾',
    stages: ['待发布', '已发送'] as InfluencerStage[],
  },
  {
    id: 'finance',
    label: '财务',
    stages: ['已发Invoice', '已付款', '完成'] as InfluencerStage[],
  },
] as const

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]['id']

// Staleness thresholds (days)
export const STALENESS_THRESHOLDS = {
  warning: 8,   // yellow
  danger: 15,   // red
} as const

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Influencer {
  id: string
  twitter_handle: string
  twitter_id: string | null  // stable numeric Twitter user ID
  display_name: string | null
  avatar_url: string | null
  followers_count: number | null
  category: string | null
  bio: string | null
  notes: string | null
  current_stage: InfluencerStage
  assigned_to: string | null
  stage_entered_at: string
  last_contact_date: string | null
  next_followup_date: string | null
  deal_type: DealType | null
  quote_per_post: number | null
  contract_value: number | null
  contract_url: string | null
  draft1_url: string | null
  draft1_done: boolean
  draft2_url: string | null
  draft2_done: boolean
  publish_date: string | null
  post_url: string | null
  impressions: number | null
  engagement_rate: number | null
  clicks: number | null
  invoice_number: string | null
  invoice_amount: number | null
  payment_status: PaymentStatus
  payment_due_date: string | null
  payment_date: string | null
  created_at: string
  updated_at: string
  // joined
  assigned_profile?: Profile | null
}

export interface CommunicationLog {
  id: string
  influencer_id: string
  user_id: string | null
  contacted_at: string
  method: ContactMethod
  summary: string
  source: 'manual' | 'twitter_api'
  twitter_dm_id: string | null
  created_at: string
  profile?: Profile | null
}

export interface ActivityLog {
  id: string
  influencer_id: string
  user_id: string | null
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  description: string | null
  created_at: string
  profile?: Profile | null
}

// Minimal Database type for Supabase client typing
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      influencers: {
        Row: Influencer
        Insert: Omit<Influencer, 'id' | 'created_at' | 'updated_at' | 'stage_entered_at' | 'assigned_profile'>
        Update: Partial<Omit<Influencer, 'id' | 'created_at' | 'updated_at' | 'assigned_profile'>>
      }
      communication_logs: {
        Row: CommunicationLog
        Insert: Omit<CommunicationLog, 'id' | 'created_at' | 'profile'>
        Update: never
      }
      activity_logs: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at' | 'profile'>
        Update: never
      }
    }
    Enums: {
      influencer_stage: InfluencerStage
      deal_type: DealType
      contact_method: ContactMethod
      payment_status: PaymentStatus
    }
  }
}
