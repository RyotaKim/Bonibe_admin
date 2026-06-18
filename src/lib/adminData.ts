import { createIsolatedSupabaseClient, requireSupabase } from './supabase'
import type {
  AdminNotice,
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
  Product,
  ProductionAllocation,
  ProductionReport,
  ProductionReportLine,
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

type CountResult = {
  count: number
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

async function countRows(
  source: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<CountResult> {
  try {
    const { count, error } = await query

    if (error) {
      return { count: 0, notice: notice(source, error.message) }
    }

    return { count: count ?? 0, notice: null }
  } catch (error) {
    return { count: 0, notice: notice(source, messageFrom(error)) }
  }
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

  const [
    staff,
    products,
    locations,
    openSync,
    reports,
    recentSync,
    recentReports,
    recentAudit,
  ] = await Promise.all([
    countRows(
      'profiles count',
      client.from('profiles').select('*', { count: 'exact', head: true }),
    ),
    countRows(
      'products count',
      client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true),
    ),
    countRows(
      'locations count',
      client
        .from('locations')
        .select('*', { count: 'exact', head: true })
        .eq('active', true),
    ),
    countRows(
      'sync_queue count',
      client
        .from('sync_queue')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'synced'),
    ),
    countRows(
      'report_exports count',
      client.from('report_exports').select('*', { count: 'exact', head: true }),
    ),
    selectList<SyncQueueItem>(
      'recent sync_queue',
      client
        .from('sync_queue')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(6),
    ),
    selectList<ReportExport>(
      'recent report_exports',
      client
        .from('report_exports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(6),
    ),
    selectList<AuditLog>(
      'recent audit_logs',
      client.from('audit_logs').select('*').order('created_at', {
        ascending: false,
      }),
    ),
  ])

  return {
    counts: {
      staff: staff.count,
      activeProducts: products.count,
      activeLocations: locations.count,
      openSync: openSync.count,
      reports: reports.count,
    },
    recentSync: recentSync.data,
    recentReports: recentReports.data,
    recentAudit: recentAudit.data.slice(0, 6),
    notices: collectNotices(
      staff.notice,
      products.notice,
      locations.notice,
      openSync.notice,
      reports.notice,
      recentSync.notice,
      recentReports.notice,
      recentAudit.notice,
    ),
  }
}

export async function fetchStaff(): Promise<StaffData> {
  const client = requireSupabase()

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

  const [companies, locations] = await Promise.all([
    selectList<Company>(
      'companies',
      client.from('companies').select('*').order('company_name'),
    ),
    selectList<Location>(
      'locations',
      client.from('locations').select('*').order('type').order('name'),
    ),
  ])

  return {
    companies: companies.data,
    locations: locations.data,
    notices: collectNotices(companies.notice, locations.notice),
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
    productionReports,
    productionLines,
    productionAllocations,
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
    selectList<ProductionReport>(
      'production_reports',
      client
        .from('production_reports')
        .select('*')
        .order('production_date', { ascending: false })
        .limit(500),
    ),
    selectList<ProductionReportLine>(
      'production_report_lines',
      client.from('production_report_lines').select('*').limit(2000),
    ),
    selectList<ProductionAllocation>(
      'production_allocations',
      client.from('production_allocations').select('*').limit(5000),
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
    productionReports: productionReports.data,
    productionLines: productionLines.data,
    productionAllocations: productionAllocations.data,
    branchLedgerEntries: branchLedgerEntries.data,
    clientLedgerEntries: clientLedgerEntries.data,
    damageReturnEntries: damageReturnEntries.data,
    notices: collectNotices(
      reports.notice,
      locations.notice,
      companies.notice,
      products.notice,
      productionReports.notice,
      productionLines.notice,
      productionAllocations.notice,
      branchLedgerEntries.notice,
      clientLedgerEntries.notice,
      damageReturnEntries.notice,
    ),
  }
}

export async function saveProduct(form: FormData) {
  const client = requireSupabase()
  const id = String(form.get('id') || '').trim()
  const name = String(form.get('name') || '').trim()

  if (!id || !name) {
    throw new Error('Product ID and name are required.')
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
    throw error
  }
}

export async function saveLocation(form: FormData) {
  const client = requireSupabase()
  const id = String(form.get('id') || '').trim()
  const name = String(form.get('name') || '').trim()

  if (!id || !name) {
    throw new Error('Location ID and name are required.')
  }

  const payload = {
    id,
    company_id: String(form.get('company_id') || companyId).trim(),
    name,
    code: String(form.get('code') || id).trim(),
    type: String(form.get('type') || 'branch').trim(),
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

  const payload = {
    id,
    company_id: String(form.get('company_id') || companyId).trim(),
    staff_name: staffName,
    employee_code: String(form.get('employee_code') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    role: appRole,
    assigned_location_id: ownsLocation(appRole) ? assignedLocationId : null,
    active: form.get('active') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await client.from('profiles').upsert(payload)

  if (error) {
    throw createMutationError('Could not save account profile', error)
  }

  if (
    form.get('sync_location_name') === 'on' &&
    ownsLocation(appRole) &&
    assignedLocationId
  ) {
    const { error: locationError } = await client
      .from('locations')
      .update({
        name: staffName,
        type: appRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignedLocationId)

    if (locationError) {
      throw createMutationError('Could not update assigned location', locationError)
    }
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
      throw createMutationError('Could not update account password', passwordError)
    }
  }
}

export async function createStaffAccount(form: FormData) {
  const client = requireSupabase()
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

  if (appRole === 'admin') {
    const authClient = createIsolatedSupabaseClient()
    const { data: authData, error: authError } = await authClient.auth.signUp({
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
      throw createMutationError('Could not create admin auth account', authError)
    }

    const userId = authData.user?.id

    if (!userId) {
      throw new Error(
        'The admin auth account was started, but no user ID was returned.',
      )
    }

    const { error: profileError } = await client.from('profiles').upsert({
      id: userId,
      company_id: company,
      staff_name: staffName,
      employee_code: employeeCode || null,
      email,
      password_hash: null,
      role: appRole,
      assigned_location_id: null,
      active: true,
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      throw createMutationError('Could not create admin profile', profileError)
    }

    const { error: passwordError } = await client.rpc(
      'update_staff_profile_password',
      {
        p_profile_id: userId,
        p_password: password,
      },
    )

    if (passwordError) {
      throw createMutationError('Could not confirm admin password', passwordError)
    }

    return { userId, email, role: appRole }
  }

  const { data, error } = await client.rpc('create_staff_profile_with_location', {
    p_company_id: company,
    p_email: email,
    p_employee_code: employeeCode || null,
    p_password: password,
    p_role: appRole,
    p_staff_name: staffName,
  })

  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        'Database setup needed: run supabase/profile_only_account_creation.sql in the Supabase SQL Editor, then try creating the account again.',
      )
    }

    throw createMutationError('Could not create account profile', error)
  }

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
    throw new Error('You cannot delete the admin account you are signed in with.')
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, assigned_location_id')
    .eq('id', id)
    .maybeSingle()

  if (profileError) {
    throw createMutationError(
      'Could not load account before deleting',
      profileError,
    )
  }

  if (!profile) {
    throw new Error('This account was already deleted or could not be found.')
  }

  const locationId =
    ownsLocation(profile.role as ValidRole) && profile.assigned_location_id
      ? profile.assigned_location_id
      : null

  const { count: sharedLocationCount, error: countError } = locationId
    ? await client
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_location_id', locationId)
        .neq('id', id)
    : { count: 0, error: null }

  if (countError) {
    throw createMutationError(
      'Could not check account workspace ownership',
      countError,
    )
  }

  const { error } = await client.from('profiles').delete().eq('id', id)

  if (error) {
    throw createMutationError('Could not delete account profile', error)
  }

  if (locationId && (sharedLocationCount ?? 0) === 0) {
    const { error: locationDeleteError } = await client
      .from('locations')
      .delete()
      .eq('id', locationId)

    if (locationDeleteError) {
      await client
        .from('locations')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', locationId)
    }
  }
}
