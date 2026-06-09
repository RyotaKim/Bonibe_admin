import { createIsolatedSupabaseClient, requireSupabase } from './supabase'
import type {
  AdminNotice,
  AuditLog,
  CatalogData,
  Company,
  CompositeItem,
  DashboardData,
  Location,
  LocationsData,
  Product,
  Profile,
  ReportExport,
  ReportsData,
  StaffData,
  SyncData,
  SyncQueueItem,
} from '../types/admin'

const companyId = 'bonibe'

const validRoles = ['admin', 'branch', 'kitchen'] as const

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
  return error instanceof Error ? error.message : String(error)
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
  const reports = await selectList<ReportExport>(
    'report_exports',
    client
      .from('report_exports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(100),
  )

  return {
    reports: reports.data,
    notices: collectNotices(reports.notice),
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

  if (!id || !staffName) {
    throw new Error('Auth user ID and staff name are required.')
  }

  const payload = {
    id,
    company_id: String(form.get('company_id') || companyId).trim(),
    staff_name: staffName,
    employee_code: String(form.get('employee_code') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    role: String(form.get('role') || 'branch').trim(),
    assigned_location_id:
      String(form.get('assigned_location_id') || '').trim() || null,
    active: form.get('active') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await client.from('profiles').upsert(payload)

  if (error) {
    throw error
  }
}

export async function createStaffAccount(form: FormData) {
  const client = requireSupabase()
  const authClient = createIsolatedSupabaseClient()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '').trim()
  const staffName = String(form.get('staff_name') || '').trim()
  const employeeCode = String(form.get('employee_code') || '').trim()
  const role = String(form.get('role') || 'branch').trim()
  const assignedLocationId =
    String(form.get('assigned_location_id') || '').trim() || null

  if (!email || !password || !staffName) {
    throw new Error('Email, password, and staff name are required.')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  if (!validRoles.includes(role as (typeof validRoles)[number])) {
    throw new Error('Role must be admin, branch, or kitchen.')
  }

  if (role === 'branch' && !assignedLocationId) {
    throw new Error('Branch accounts require an assigned location.')
  }

  const { data: authData, error: authError } = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        staff_name: staffName,
        employee_code: employeeCode || null,
        role,
      },
    },
  })

  if (authError) {
    throw authError
  }

  const userId = authData.user?.id

  if (!userId) {
    throw new Error(
      'Supabase Auth did not return a user ID. Check Auth signup settings.',
    )
  }

  const { error: profileError } = await client.from('profiles').upsert({
    id: userId,
    company_id: String(form.get('company_id') || companyId).trim(),
    staff_name: staffName,
    employee_code: employeeCode || null,
    email,
    role,
    assigned_location_id: role === 'branch' ? assignedLocationId : null,
    active: true,
    updated_at: new Date().toISOString(),
  })

  if (profileError) {
    throw profileError
  }

  return { userId, email, role }
}
