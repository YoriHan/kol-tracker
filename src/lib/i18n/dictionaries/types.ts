// Dictionary shape — keep zh and en in lock-step.
export interface Dictionary {
  app: {
    name: string
    description: string
  }
  common: {
    cancel: string
    confirm: string
    add: string
    save: string
    saving: string
    close: string
    loading: string
    loadFailed: string
    none: string
    dash: string
    yes: string
    no: string
    clickToEdit: string
    clickToAddLink: string
    languageSwitcher: string
    languageLabel: string
    chinese: string
    english: string
  }
  nav: {
    home: string
    influencers: string
    signOut: string
  }
  login: {
    loginMode: string
    signupMode: string
    email: string
    password: string
    login: string
    signup: string
    processing: string
    switchToSignup: string
    switchToLogin: string
  }
  dashboard: {
    overview: string
    totalCount: string
    newThisWeek: string
    pendingFollowup: string
    completedThisMonth: string
    pendingPayment: string
    stageDistribution: string
  }
  influencers: {
    title: string
    table: string
    kanban: string
    import: string
    export: string
    addInfluencer: string
    addShort: string
    searchPlaceholder: string
    allStages: string
    allCategories: string
    allTags: string
    minFollowers: string
    maxFollowers: string
    overdueOnly: string
    filters: string
    clearFilters: string
    foundCount: string
    totalCount: string
    followersBadge: string
    overdueLabel: string
    noInfluencers: string
    empty: string
    followupOverdue: string
    followupAt: string
    selectedCount: string
    batchChangeStage: string
    batchAssign: string
    clearAssignee: string
    clearSelection: string
    columns: {
      influencer: string
      followers: string
      category: string
      stage: string
      staleness: string
      assignee: string
      lastContact: string
      followup: string
    }
    actions: {
      viewDetail: string
      changeStage: string
    }
    csvHeaders: {
      twitter_handle: string
      display_name: string
      followers_count: string
      category: string
      bio: string
      current_stage: string
      assigned_to: string
      last_contact_date: string
      next_followup_date: string
      deal_type: string
      quote_per_post: string
      contract_value: string
      contract_url: string
      draft1_done: string
      draft1_url: string
      draft2_done: string
      draft2_url: string
      publish_date: string
      post_url: string
      impressions: string
      engagement_rate: string
      clicks: string
      invoice_number: string
      invoice_amount: string
      payment_status: string
      payment_due_date: string
      payment_date: string
      notes: string
      tags: string
      created_at: string
    }
  }
  addDialog: {
    title: string
    handleLabel: string
    handlePlaceholder: string
    parsedAs: string
    displayNameLabel: string
    displayNamePlaceholder: string
    followersLabel: string
    followersPlaceholder: string
    categoryLabel: string
    categoryPlaceholder: string
    notesLabel: string
    notesPlaceholder: string
    handleTooLong: string
    duplicateHandle: string
    submitting: string
    submit: string
  }
  importDialog: {
    title: string
    description: string
    selectFile: string
    foundValid: string
    skipped: string
    only20Preview: string
    importN: string
    importing: string
    success: string
    failed: string
    rowMissingHandle: string
    columns: {
      handle: string
      name: string
      category: string
    }
  }
  detail: {
    saving: string
    followupOverdue: string
    followers: string
    exportPdf: string
    tabs: {
      info: string
      infoShort: string
      finance: string
      performance: string
      logs: string
      activity: string
      attribution: string
    }
    cards: {
      basicInfo: string
      dealTerms: string
      contentProgress: string
      finance: string
      performanceManual: string
      communicationLogs: string
      activityLog: string
      trackingLink: string
      clickTrend: string
      embed: string
    }
    fields: {
      category: string
      followers: string
      assignee: string
      nextFollowup: string
      tags: string
      notes: string
      dealType: string
      quotePerPost: string
      contractValue: string
      contractUrl: string
      paymentStatus: string
      invoiceNumber: string
      invoiceAmount: string
      paymentDueDate: string
      paymentDate: string
      impressions: string
      engagementRate: string
      clicks: string
      slug: string
      trackingShareLink: string
      trackingTargetUrl: string
      lastContact: string
      stage: string
      generatedAt: string
    }
    placeholders: {
      selectCategory: string
      selectDealType: string
      noAssignee: string
      addTagAndEnter: string
      addTag: string
      draft1Url: string
      draft2Url: string
      postUrlAfterPublish: string
      trackingTargetExample: string
      logSummary: string
    }
    progress: {
      publishDate: string
      postUrl: string
    }
    attribution: {
      noSlugYet: string
      generate: string
      clicks: string
      conversions: string
      conversionRate: string
      embedHint: string
    }
    logs: {
      empty: string
      activityEmpty: string
    }
    pdf: {
      title: string
      fieldLabel: string
      valueLabel: string
      sectionDeal: string
      sectionPerformance: string
      trackedClicks: string
      conversions: string
      manualClicks: string
    }
  }
  errors: {
    loadFailedDetail: string
    pageLoadFailed: string
    retry: string
    notFoundTitle: string
    notFoundDescription: string
    backToList: string
  }
  staleness: {
    days: string
    today: string
  }
  editor: {
    bold: string
    italic: string
    bulletList: string
    label: string
  }
  chart: {
    noClickData: string
    clicksLabel: string
  }
}
