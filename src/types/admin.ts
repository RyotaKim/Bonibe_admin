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
  download_url?: string | null
}

export type ProductionReport = {
  id: string
  company_id: string
  location_id: string | null
  production_date: string
  status: string
  notes: string | null
  sync_status: SyncStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ProductionReportLine = {
  id: string
  production_report_id: string
  product_id: string
  plates: number
  pieces_per_plate: number
  expected_pieces: number
  actual_pieces: number
  damages: number
  returns: number
  unknown_loss: number
  balance: number
  status: string
  reason: string | null
  notes: string | null
  created_at: string
}

export type ProductionAllocation = {
  id: string
  production_report_line_id: string
  destination_location_id: string | null
  quantity: number
  created_at: string
}

export type BranchInventorySession = {
  id: string
  company_id: string
  branch_location_id: string
  business_date: string
  status: 'draft' | 'open' | 'closed'
  opened_by: string | null
  opened_at: string | null
  closed_by: string | null
  closed_at: string | null
  remarks: string | null
  cash_sales: number
  expected_cash: number
  actual_cash: number
  cash_remarks: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BranchInventoryLine = {
  id: string
  session_id: string
  product_id: string
  product_name: string
  category: string
  opening_count: number
  delivery_qty: number
  sold_qty: number
  sales_amount: number
  damage_qty: number
  return_qty: number
  mold_qty: number
  transfer_out_qty: number
  expected_ending_count: number
  actual_ending_count: number | null
  variance_qty: number | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export type BranchExpense = {
  id: string
  branch_id: string
  business_date: string
  inventory_session_id: string
  expense_name: string
  amount: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type KitchenInventorySession = {
  id: string
  company_id: string
  kitchen_location_id: string
  business_date: string
  status: 'draft' | 'open' | 'closed'
  opened_by: string | null
  opened_at: string | null
  closed_by: string | null
  closed_at: string | null
  remarks: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type KitchenInventoryLine = {
  id: string
  session_id: string
  product_id: string
  product_name: string
  category: string
  unit_price: number
  previous_remaining_count: number
  opening_spoilage_qty: number
  usable_opening_count: number
  produced_qty: number
  order_allocation_qty: number
  manual_allocation_qty: number
  good_for_qty: number
  sold_out_qty: number
  damage_qty: number
  unknown_loss_qty: number
  expected_ending_count: number
  actual_ending_count: number | null
  variance_qty: number | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export type KitchenExpense = {
  id: string
  kitchen_location_id: string
  business_date: string
  inventory_session_id: string
  expense_name: string
  amount: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BranchLedgerEntry = {
  id: string
  company_id: string
  branch_location_id: string
  ledger_date: string
  shift_label: string | null
  bread_sales: number
  softdrinks: number
  batchoy: number
  short_order: number
  cr: number
  acr: number
  ncr: number
  discount: number
  expenses: number
  returns: number
  end_inventory_value: number
  excess_deficit: number
  remarks: string | null
  sync_status: SyncStatus
  created_by: string | null
  created_at: string
}

export type ClientLedgerEntry = {
  id: string
  company_id: string
  client_location_id: string
  product_id: string | null
  sent_quantity: number
  sold_quantity: number
  return_quantity: number
  damaged_quantity: number
  amount: number
  payment: number
  balance: number
  net_payable: number
  status: string
  notes: string | null
  sync_status: SyncStatus
  created_by: string | null
  created_at: string
}

export type DamageReturnEntry = {
  id: string
  company_id: string
  location_id: string | null
  product_id: string
  entry_type: 'damage' | 'loss' | 'return'
  quantity: number
  unit_value: number
  total_value: number
  reason: string
  notes: string | null
  reconciled: boolean
  sync_status: SyncStatus
  created_by: string | null
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
  profiles: Profile[]
  notices: AdminNotice[]
}

export type StaffData = {
  profiles: Profile[]
  locations: Location[]
  notices: AdminNotice[]
}

export type ReportsData = {
  reports: ReportExport[]
  locations: Location[]
  companies: Company[]
  products: Product[]
  branchInventorySessions: BranchInventorySession[]
  branchInventoryLines: BranchInventoryLine[]
  branchExpenses: BranchExpense[]
  kitchenInventorySessions: KitchenInventorySession[]
  kitchenInventoryLines: KitchenInventoryLine[]
  kitchenExpenses: KitchenExpense[]
  branchLedgerEntries: BranchLedgerEntry[]
  clientLedgerEntries: ClientLedgerEntry[]
  damageReturnEntries: DamageReturnEntry[]
  notices: AdminNotice[]
}

export type SyncData = {
  items: SyncQueueItem[]
  audit: AuditLog[]
  notices: AdminNotice[]
}
