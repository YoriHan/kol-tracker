// Display labels for stored Supabase enum/text values. The *stored* values
// stay Chinese (canonical, written by every existing row + RLS / queries).
// These maps translate them for the user-facing layer only.

import type { Locale } from '../types'
import type { InfluencerStage, DealType, ContactMethod, PaymentStatus, KanbanColumnId } from '@/types/database'

export const STAGE_LABELS: Record<Locale, Record<InfluencerStage, string>> = {
  zh: {
    '待接触': '待接触',
    '已发DM': '已发DM',
    '谈判中': '谈判中',
    '已签约': '已签约',
    '合作中-Draft1': '合作中-Draft1',
    '合作中-Draft2': '合作中-Draft2',
    '待发布': '待发布',
    '已发送': '已发送',
    '已发Invoice': '已发Invoice',
    '已付款': '已付款',
    '完成': '完成',
  },
  en: {
    '待接触': 'To contact',
    '已发DM': 'DM sent',
    '谈判中': 'Negotiating',
    '已签约': 'Signed',
    '合作中-Draft1': 'In progress — Draft 1',
    '合作中-Draft2': 'In progress — Draft 2',
    '待发布': 'Ready to publish',
    '已发送': 'Published',
    '已发Invoice': 'Invoice sent',
    '已付款': 'Paid',
    '完成': 'Done',
  },
}

export const DEAL_TYPE_LABELS: Record<Locale, Record<DealType, string>> = {
  zh: {
    '推文': '推文',
    '视频': '视频',
    'Story': 'Story',
    '直播': '直播',
    '其他': '其他',
  },
  en: {
    '推文': 'Tweet',
    '视频': 'Video',
    'Story': 'Story',
    '直播': 'Livestream',
    '其他': 'Other',
  },
}

export const CONTACT_METHOD_LABELS: Record<Locale, Record<ContactMethod, string>> = {
  zh: {
    'DM': 'DM',
    '邮件': '邮件',
    '电话': '电话',
    '其他': '其他',
  },
  en: {
    'DM': 'DM',
    '邮件': 'Email',
    '电话': 'Phone',
    '其他': 'Other',
  },
}

export const PAYMENT_STATUS_LABELS: Record<Locale, Record<PaymentStatus, string>> = {
  zh: {
    '未开票': '未开票',
    '已开票': '已开票',
    '已付款': '已付款',
  },
  en: {
    '未开票': 'Not invoiced',
    '已开票': 'Invoiced',
    '已付款': 'Paid',
  },
}

export const KANBAN_COLUMN_LABELS: Record<Locale, Record<KanbanColumnId, string>> = {
  zh: {
    outreach: '接触中',
    business: '商务期',
    production: '制作中',
    publishing: '发布收尾',
    finance: '财务',
  },
  en: {
    outreach: 'Outreach',
    business: 'Negotiation',
    production: 'Production',
    publishing: 'Publishing',
    finance: 'Finance',
  },
}

// Categories — stored in DB as Chinese strings; translate display only.
export const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  zh: {
    '美妆': '美妆',
    '时尚': '时尚',
    '科技': '科技',
    '游戏': '游戏',
    '美食': '美食',
    '旅行': '旅行',
    '健身': '健身',
    '生活方式': '生活方式',
    '教育': '教育',
    '金融': '金融',
    '其他': '其他',
  },
  en: {
    '美妆': 'Beauty',
    '时尚': 'Fashion',
    '科技': 'Tech',
    '游戏': 'Gaming',
    '美食': 'Food',
    '旅行': 'Travel',
    '健身': 'Fitness',
    '生活方式': 'Lifestyle',
    '教育': 'Education',
    '金融': 'Finance',
    '其他': 'Other',
  },
}
