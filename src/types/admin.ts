export type AppRole = 'kitchen' | 'branch' | 'admin'
export type LocationType = 'kitchen' | 'branch' | 'client'
export type SyncStatus = 'queued' | 'syncing' | 'synced' | 'failed'

export type Profile = {
  id: string
  company_id: string
  staff_name: string
  employee_code: string | null
  email: string | null
  role: AppRole
  assigned_location_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Company = {
  id: string
  company_name: string
  logo_url: string | null
  address: string | null
  contact_number: string | null
  email: string | null
  receipt_footer: string | null
  prepared_by_label: string
  checked_by_label: string
  manager_verification_label: string
  auditor_signature_label: string
  created_at: string
  updated_at: string
}

export type Location = {
  id: string
  company_id: string
  name: string
  code: string
  type: LocationType
  address: string | null
  contact_person: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  company_id: string
  name: string
  category: string
  unit_price: number
  pieces_per_plate: number
  low_stock_threshold: number
  bundle_eligible: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export type CompositeItem = {
  id: string
  company_id: string
  name: string
  bundle_price: number
  active: boolean
  created_at: string
  updated_at: string
}

export type SyncQueueItem = {
  id: string
  company_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string | null
  payload: Record<string, unknown>
  status: SyncStatus
  attempts: number
  last_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ReportExport = {
  id: string
  company_id: string | null
  report_type: string
  format: 'pdf' | 'xlsx' | 'csv'
  filters_json: Record<string, unknown>
  location_id: string | null
  product_id: string | null
  date_from: string | null
  date_to: string | null
  file_name: string
  local_path: string | null
  file_url: string | null
  generated_by: string | null
  generated_at: string
  origin: string
  sync_status: SyncStatus
  created_at: string
}

export type AuditLog = {
  id: string
  company_id: string | null
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

export type AdminNotice = {
  source: string
  message: string
}

export type DashboardData = {
  counts: {
    staff: number
    activeProducts: number
    activeLocations: number
    openSync: number
    reports: number
  }
  recentSync: SyncQueueItem[]
  recentReports: ReportExport[]
  recentAudit: AuditLog[]
  notices: AdminNotice[]
}

export type CatalogData = {
  products: Product[]
  bundles: CompositeItem[]
  notices: AdminNotice[]
}

export type LocationsData = {
  companies: Company[]
  locations: Location[]
  notices: AdminNotice[]
}

export type StaffData = {
  profiles: Profile[]
  locations: Location[]
  notices: AdminNotice[]
}

export type ReportsData = {
  reports: ReportExport[]
  notices: AdminNotice[]
}

export type SyncData = {
  items: SyncQueueItem[]
  audit: AuditLog[]
  notices: AdminNotice[]
}
