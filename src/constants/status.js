export const CampaignStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

export const RecipientStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
}

export const CAMPAIGN_STATUSES = Object.values(CampaignStatus)
export const RECIPIENT_STATUSES = Object.values(RecipientStatus)
