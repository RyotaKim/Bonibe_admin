import { createIsolatedSupabaseClient, requireSupabase } from './supabase'
import type {
  AdminNotice,
  BranchExpense,
  DashboardBranch,
  DashboardBranchRecord,
  DashboardBranchRecordDetail,
  BranchInventoryLine,
  BranchInventorySession,
  AuditLog,
  BranchLedgerEntry,
  CatalogData,
  ClientLedgerEntry,
  Company,
  CompositeItem,
  DamageReturnEntry,
  DashboardData,
  Location,
  LocationsData,
  KitchenExpense,
  KitchenInventoryLine,
  KitchenInventorySession,
  Product,
  Profile,
  ReportExport,
  ReportsData,
  StaffData,
  SyncData,
  SyncQueueItem,
} from '../types/admin'
import { createMutationError, formatError } from '../utils/errors'

const companyId = 'bonibe'
const reportExportsBucket = 'report-exports'

const validRoles = ['admin', 'branch', 'kitchen'] as const
type ValidRole = (typeof validRoles)[number]

type ResultList<T> = {
  data: T[]
  notice: AdminNotice | null
}

function notice(source: string, message: string): AdminNotice {
  return { source, message }
}

function messageFrom(error: unknown) {
  return formatError(error)
}

async function selectList<T>(
  source: string,
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<ResultList<T>> {
  try {
    const { data, error } = await query

    if (error) {
      return { data: [], notice: notice(source, error.message) }
    }

    return { data: data ?? [], notice: null }
  } catch (error) {
    return { data: [], notice: notice(source, messageFrom(error)) }
  }
}

async function selectMaybeOne<T>(
  source: string,
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await query

  if (error) {
    throw new Error(`${source}: ${error.message}`)
  }

  return data
}

function collectNotices(...items: Array<AdminNotice | null>) {
  return items.filter((item): item is AdminNotice => Boolean(item))
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function ownsLocation(role: ValidRole) {
  return role === 'branch' || role === 'kitchen'
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isMissingRpc(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const item = error as { code?: unknown; message?: unknown }
  const message = typeof item.message === 'string' ? item.message : ''

  return item.code === 'PGRST202' || message.includes('schema cache')
}

function storagePathFrom(value: string | null | undefined) {
  const path = value?.trim()

  if (!path || isWebUrl(path) || path.startsWith('file:')) {
    return null
  }

  return path
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${reportExportsBucket}/`), '')
}

async function withReportDownloadUrls(reports: ReportExport[]) {
  const client = requireSupabase()

  return Promise.all(
    reports.map(async (report) => {
      const directUrl =
        report.file_url && isWebUrl(report.file_url) ? report.file_url : null
      const storagePath =
        storagePathFrom(report.file_url) ?? storagePathFrom(report.local_path)

      if (directUrl || !storagePath) {
        return { ...report, download_url: directUrl }
      }

      const { data } = await client.storage
        .from(reportExportsBucket)
        .createSignedUrl(storagePath, 60 * 60)

      return { ...report, download_url: data?.signedUrl ?? null }
    }),
  )
}

export async function getMyProfile(userId: string) {
  const client = requireSupabase()

  return selectMaybeOne<Profile>(
    'profiles',
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
  )
}

export async function fetchDashboard(): Promise<DashboardData> {
  const client = requireSupabase()

  const [locations, sessions, lines, expenses] = await Promise.all([
    selectList<Location>(
      'locations',
      client.from('locations').select('*').order('type').order('name'),
    ),
    selectList<BranchInventorySession>(
      'branch_inventory_sessions',
      client
        .from('branch_inventory_sessions')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(5000),
    ),
    selectList<BranchInventoryLine>(
      'branch_inventory_lines',
      client.from('branch_inventory_lines').select('*').limit(20000),
    ),
    selectList<BranchExpense>(
      'branch_expenses',
      client
        .from('branch_expenses')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(10000),
    ),
  ])

  const branchLocations = locations.data.filter(
    (location) => location.type === 'branch',
  )
  const activeBranchLocations = branchLocations.filter(
    (location) => location.active,
  )
  const branchNameById = new Map(
    branchLocations.map((location) => [location.id, location.name]),
  )
  const branchActiveById = new Map(
    branchLocations.map((location) => [location.id, location.active]),
  )
  const linesBySession = groupBy(lines.data, (line) => line.session_id)
  const expensesBySession = groupBy(expenses.data, (item) =>
    item.inventory_session_id,
  )
  const branchIds = new Set(
    activeBranchLocations.map((location) => location.id),
  )

  sessions.data.forEach((session) => {
    branchIds.add(session.branch_location_id)
  })

  const branches: DashboardBranch[] = Array.from(branchIds)
    .map((branchId) => ({
      id: branchId,
      name: branchNameById.get(branchId) ?? branchId,
      active: branchActiveById.get(branchId) ?? true,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const records: DashboardBranchRecord[] = sessions.data.map((session) => {
    const sessionLines = linesBySession.get(session.id) ?? []
    const sessionExpenses = expensesBySession.get(session.id) ?? []
    const detail = summarizeBranchSession(sessionLines, sessionExpenses)

    return {
      sessionId: session.id,
      branchId: session.branch_location_id,
      branchName:
        branchNameById.get(session.branch_location_id) ??
        session.branch_location_id,
      businessDate: session.business_date,
      status: session.status,
      sales: detail.manualSales,
      expenses: detail.expenses,
      remarks: session.remarks || session.cash_remarks || null,
      updatedAt: session.updated_at,
      detail,
    }
  })

  return {
    notices: collectNotices(
      locations.notice,
      sessions.notice,
      lines.notice,
      expenses.notice,
    ),
    branches,
    records,
  }
}

function summarizeBranchSession(
  lines: BranchInventoryLine[],
  expenses: BranchExpense[],
): DashboardBranchRecordDetail {
  return {
    openingInventory: sum(lines, (line) => Number(line.opening_count)),
    soldQuantity: sum(lines, (line) => Number(line.sold_qty)),
    manualSales: sum(lines, (line) => Number(line.sales_amount)),
    deliveries: sum(lines, (line) => Number(line.delivery_qty)),
    damages: sum(lines, (line) => Number(line.damage_qty)),
    returns: sum(lines, (line) => Number(line.return_qty)),
    molds: sum(lines, (line) => Number(line.mold_qty)),
    expenses: sum(expenses, (item) => Number(item.amount)),
    endingInventory: sum(lines, (line) =>
      Number(line.actual_ending_count ?? line.expected_ending_count),
    ),
    variance: sum(lines, (line) => Number(line.variance_qty ?? 0)),
    lineCount: lines.length,
  }
}

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  items.forEach((item) => {
    const key = getKey(item)
    const group = grouped.get(key) ?? []
    group.push(item)
    grouped.set(key, group)
  })

  return grouped
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0)
}

export async function fetchStaff(): Promise<StaffData> {
  const client = requireSupabase()

  const { error: backfillError } = await client.rpc('backfill_staff_auth_users')

  if (backfillError && !isMissingRpc(backfillError)) {
    throw createMutationError(
      'Could not repair existing account users',
      backfillError,
    )
  }

  const [profiles, locations] = await Promise.all([
    selectList<Profile>(
      'profiles',
      client.from('profiles').select('*').order('staff_name'),
    ),
    selectList<Location>(
      'locations',
      client.from('locations').select('*').order('type').order('name'),
    ),
  ])

  return {
    profiles: profiles.data,
    locations: locations.data,
    notices: collectNotices(profiles.notice, locations.notice),
  }
}

export async function fetchCatalog(): Promise<CatalogData> {
  const client = requireSupabase()

  const [products, bundles] = await Promise.all([
    selectList<Product>(
      'products',
      client.from('products').select('*').order('category').order('name'),
    ),
    selectList<CompositeItem>(
      'composite_items',
      client.from('composite_items').select('*').order('name'),
    ),
  ])

  return {
    products: products.data,
    bundles: bundles.data,
    notices: collectNotices(products.notice, bundles.notice),
  }
}

export async function fetchLocations(): Promise<LocationsData> {
  const client = requireSupabase()

  const [companies, locations, profiles] = await Promise.all([
    selectList<Company>(
      'companies',
      client.from('companies').select('*').order('company_name'),
    ),
    selectList<Location>(
      'locations',
      client.from('locations').select('*').order('type').order('name'),
    ),
    selectList<Profile>(
      'profiles',
      client.from('profiles').select('*').order('staff_name'),
    ),
  ])

  return {
    companies: companies.data,
    locations: locations.data,
    profiles: profiles.data,
    notices: collectNotices(
      companies.notice,
      locations.notice,
      profiles.notice,
    ),
  }
}

export async function fetchSyncReview(): Promise<SyncData> {
  const client = requireSupabase()

  const [items, audit] = await Promise.all([
    selectList<SyncQueueItem>(
      'sync_queue',
      client
        .from('sync_queue')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100),
    ),
    selectList<AuditLog>(
      'audit_logs',
      client.from('audit_logs').select('*').order('created_at', {
        ascending: false,
      }),
    ),
  ])

  return {
    items: items.data,
    audit: audit.data.slice(0, 80),
    notices: collectNotices(items.notice, audit.notice),
  }
}

export async function fetchReports(): Promise<ReportsData> {
  const client = requireSupabase()
  const [
    reports,
    locations,
    companies,
    products,
    branchInventorySessions,
    branchInventoryLines,
    branchExpenses,
    kitchenInventorySessions,
    kitchenInventoryLines,
    kitchenExpenses,
    branchLedgerEntries,
    clientLedgerEntries,
    damageReturnEntries,
  ] = await Promise.all([
    selectList<ReportExport>(
      'report_exports',
      client
        .from('report_exports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(100),
    ),
    selectList<Location>(
      'locations',
      client.from('locations').select('*').order('type').order('name'),
    ),
    selectList<Company>(
      'companies',
      client.from('companies').select('*').order('company_name'),
    ),
    selectList<Product>(
      'products',
      client.from('products').select('*').order('category').order('name'),
    ),
    selectList<BranchInventorySession>(
      'branch_inventory_sessions',
      client
        .from('branch_inventory_sessions')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(1000),
    ),
    selectList<BranchInventoryLine>(
      'branch_inventory_lines',
      client.from('branch_inventory_lines').select('*').limit(5000),
    ),
    selectList<BranchExpense>(
      'branch_expenses',
      client
        .from('branch_expenses')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(2000),
    ),
    selectList<KitchenInventorySession>(
      'kitchen_inventory_sessions',
      client
        .from('kitchen_inventory_sessions')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(1000),
    ),
    selectList<KitchenInventoryLine>(
      'kitchen_inventory_lines',
      client.from('kitchen_inventory_lines').select('*').limit(5000),
    ),
    selectList<KitchenExpense>(
      'kitchen_expenses',
      client
        .from('kitchen_expenses')
        .select('*')
        .order('business_date', { ascending: false })
        .limit(2000),
    ),
    selectList<BranchLedgerEntry>(
      'branch_ledger_entries',
      client
        .from('branch_ledger_entries')
        .select('*')
        .order('ledger_date', { ascending: false })
        .limit(1000),
    ),
    selectList<ClientLedgerEntry>(
      'client_ledger_entries',
      client
        .from('client_ledger_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
    ),
    selectList<DamageReturnEntry>(
      'damages_returns',
      client
        .from('damages_returns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
    ),
  ])

  return {
    reports: await withReportDownloadUrls(reports.data),
    locations: locations.data,
    companies: companies.data,
    products: products.data,
    branchInventorySessions: branchInventorySessions.data,
    branchInventoryLines: branchInventoryLines.data,
    branchExpenses: branchExpenses.data,
    kitchenInventorySessions: kitchenInventorySessions.data,
    kitchenInventoryLines: kitchenInventoryLines.data,
    kitchenExpenses: kitchenExpenses.data,
    branchLedgerEntries: branchLedgerEntries.data,
    clientLedgerEntries: clientLedgerEntries.data,
    damageReturnEntries: damageReturnEntries.data,
    notices: collectNotices(
      reports.notice,
      locations.notice,
      companies.notice,
      products.notice,
      branchInventorySessions.notice,
      branchInventoryLines.notice,
      branchExpenses.notice,
      kitchenInventorySessions.notice,
      kitchenInventoryLines.notice,
      kitchenExpenses.notice,
      branchLedgerEntries.notice,
      clientLedgerEntries.notice,
      damageReturnEntries.notice,
    ),
  }
}

export async function saveProduct(form: FormData) {
  const client = requireSupabase()
  const name = String(form.get('name') || '').trim()
  const id =
    String(form.get('id') || '').trim() || (await nextProductIdFromName(name))

  if (!id || !name) {
    throw new Error('Product name is required.')
  }

  const payload = {
    id,
    company_id: String(form.get('company_id') || companyId).trim(),
    name,
    category: String(form.get('category') || 'Bread').trim(),
    unit_price: Number(form.get('unit_price') || 0),
    pieces_per_plate: Number(form.get('pieces_per_plate') || 1),
    low_stock_threshold: Number(form.get('low_stock_threshold') || 0),
    bundle_eligible: form.get('bundle_eligible') === 'on',
    active: form.get('active') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await client.from('products').upsert(payload)

  if (error) {
    throw createMutationError('Could not save product', error)
  }
}

export async function deleteProduct(productId: string) {
  const client = requireSupabase()
  const id = productId.trim()

  if (!id) {
    throw new Error('Select a product to delete.')
  }

  const { error } = await client.from('products').delete().eq('id', id)

  if (error) {
    throw createMutationError('Could not delete product', error)
  }
}

async function nextProductIdFromName(name: string) {
  const client = requireSupabase()
  const slug = slugFromName(name)

  if (!slug) {
    return ''
  }

  const { data, error } = await client
    .from('products')
    .select('id')
    .or(`id.eq.${slug},id.like.${slug}_%`)

  if (error) {
    throw createMutationError('Could not prepare product ID', error)
  }

  const existingIds = new Set((data ?? []).map((product) => product.id))

  if (!existingIds.has(slug)) {
    return slug
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${slug}_${suffix}`
    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  return `${slug}_${Date.now()}`
}

function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function saveLocation(form: FormData) {
  const client = requireSupabase()
  const id = String(form.get('id') || '').trim()
  const name = String(form.get('name') || '').trim()
  const type = String(form.get('type') || 'branch').trim()

  if (!id || !name) {
    throw new Error('Location ID and name are required.')
  }

  if (type !== 'kitchen' && type !== 'branch') {
    throw new Error('Location type must be kitchen or branch.')
  }

  const payload = {
    id,
    company_id: String(form.get('company_id') || companyId).trim(),
    name,
    code: String(form.get('code') || id).trim(),
    type,
    address: String(form.get('address') || '').trim() || null,
    contact_person: String(form.get('contact_person') || '').trim() || null,
    active: form.get('active') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await client.from('locations').upsert(payload)

  if (error) {
    throw error
  }
}

export async function saveCompany(form: FormData) {
  const client = requireSupabase()
  const id = String(form.get('id') || companyId).trim()

  const payload = {
    id,
    company_name: String(form.get('company_name') || '').trim(),
    address: String(form.get('address') || '').trim() || null,
    contact_number: String(form.get('contact_number') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    receipt_footer: String(form.get('receipt_footer') || '').trim() || null,
    prepared_by_label:
      String(form.get('prepared_by_label') || '').trim() || 'Prepared by',
    checked_by_label:
      String(form.get('checked_by_label') || '').trim() || 'Checked by',
    manager_verification_label:
      String(form.get('manager_verification_label') || '').trim() ||
      'Manager verification',
    auditor_signature_label:
      String(form.get('auditor_signature_label') || '').trim() ||
      'Auditor signature',
    updated_at: new Date().toISOString(),
  }

  const { error } = await client.from('companies').upsert(payload)

  if (error) {
    throw error
  }
}

export async function saveProfile(form: FormData) {
  const client = requireSupabase()
  const id = String(form.get('id') || '').trim()
  const staffName = String(form.get('staff_name') || '').trim()
  const role = String(form.get('role') || 'branch').trim()
  const newPassword = String(form.get('new_password') || '').trim()
  const confirmPassword = String(form.get('confirm_new_password') || '').trim()
  const assignedLocationId =
    String(form.get('assigned_location_id') || '').trim() || null

  if (!id || !staffName) {
    throw new Error('Account ID and staff name are required.')
  }

  if (!validRoles.includes(role as (typeof validRoles)[number])) {
    throw new Error('Role must be admin, branch, or kitchen.')
  }

  const appRole = role as ValidRole

  if (newPassword || confirmPassword) {
    if (newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters.')
    }

    if (newPassword !== confirmPassword) {
      throw new Error('New password and re-entered password must match.')
    }
  }

  const { error } = await client.rpc('save_staff_profile_account', {
    p_profile_id: id,
    p_company_id: String(form.get('company_id') || companyId).trim(),
    p_staff_name: staffName,
    p_employee_code: String(form.get('employee_code') || '').trim() || null,
    p_email: String(form.get('email') || '').trim() || null,
    p_role: appRole,
    p_assigned_location_id: ownsLocation(appRole) ? assignedLocationId : null,
    p_active: form.get('active') === 'on',
    p_sync_location_name: form.get('sync_location_name') === 'on',
  })

  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        'Database setup needed: run bonibe_admin/supabase/profile_only_account_creation.sql in the Supabase SQL Editor, then try saving the account again.',
      )
    }

    throw createMutationError('Could not save account profile', error)
  }

  if (newPassword) {
    const { error: passwordError } = await client.rpc(
      'update_staff_profile_password',
      {
        p_profile_id: id,
        p_password: newPassword,
      },
    )

    if (passwordError) {
      throw createMutationError(
        'Could not update account password',
        passwordError,
      )
    }
  }
}

export async function createStaffAccount(form: FormData) {
  const client = requireSupabase()
  const isolatedClient = createIsolatedSupabaseClient()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '').trim()
  const confirmPassword = String(form.get('confirm_password') || '').trim()
  const staffName = String(form.get('staff_name') || '').trim()
  const employeeCode = String(form.get('employee_code') || '').trim()
  const role = String(form.get('role') || 'branch').trim()
  const company = String(form.get('company_id') || companyId).trim()

  if (!email || !password || !staffName) {
    throw new Error('Email, password, and account name are required.')
  }

  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.')
  }

  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters.')
  }

  if (password !== confirmPassword) {
    throw new Error('Password and re-entered password must match.')
  }

  if (!validRoles.includes(role as (typeof validRoles)[number])) {
    throw new Error('Role must be admin, branch, or kitchen.')
  }

  const appRole = role as ValidRole

  const { data: authSignup, error: authError } = await isolatedClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        staff_name: staffName,
        employee_code: employeeCode || null,
        role: appRole,
      },
    },
  })

  if (authError) {
    throw createMutationError('Could not create Supabase Auth user', authError)
  }

  const authUserId = authSignup.user?.id
  if (!authUserId) {
    throw new Error(
      'Supabase Auth did not return a user id for the new account.',
    )
  }

  const { data, error } = await client.rpc(
    'create_staff_profile_with_location',
    {
      p_auth_user_id: authUserId,
      p_company_id: company,
      p_email: email,
      p_employee_code: employeeCode || null,
      p_password: password,
      p_role: appRole,
      p_staff_name: staffName,
    },
  )

  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        'Database setup needed: run bonibe_admin/supabase/profile_only_account_creation.sql in the Supabase SQL Editor, then try creating the account again.',
      )
    }

    throw createMutationError('Could not create account profile', error)
  }

  await isolatedClient.auth.signOut()

  return data
}

export async function deleteProfile(profileId: string) {
  const client = requireSupabase()
  const id = profileId.trim()

  if (!id) {
    throw new Error('Select an account to delete.')
  }

  const { data: authData } = await client.auth.getUser()
  if (authData.user?.id === id) {
    throw new Error(
      'You cannot delete the admin account you are signed in with.',
    )
  }

  const { error } = await client.rpc('delete_staff_account', {
    p_profile_id: id,
  })

  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        'Database setup needed: run bonibe_admin/supabase/profile_only_account_creation.sql in the Supabase SQL Editor, then try deleting the account again.',
      )
    }

    throw createMutationError('Could not delete account profile', error)
  }
}
