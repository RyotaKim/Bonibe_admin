import type {
  BranchInventoryLine,
  BranchInventorySession,
  BranchLedgerEntry,
  ClientLedgerEntry,
  DamageReturnEntry,
  KitchenInventoryLine,
  KitchenInventorySession,
  Location,
  Product,
  ReportsData,
} from '../types/admin'

export type GeneratedReportKind =
  | 'branch-daily-production'
  | 'kitchen-daily-production'
  | 'bonibe-daily-production-summary'
  | 'branch-daily-summary'
  | 'branch-weekly-summary'
  | 'client-daily-summary'
  | 'client-weekly-summary'
  | 'production-report'
  | 'damages-losses'

export type GeneratedReportFormat = 'pdf' | 'xlsx'

export type GenerateReportRequest = {
  kind: GeneratedReportKind
  format: GeneratedReportFormat
  locationId: string
  productId?: string
  dateFrom: string
  dateTo: string
}

type ReportTable = {
  title: string
  subtitle: string
  headers: string[]
  rows: Array<Array<string | number>>
  totals?: Array<string | number>
  summary?: Array<[string, string | number]>
  columnWidths?: number[]
}

export const generatedReportKinds: Array<{
  value: GeneratedReportKind
  label: string
}> = [
  { value: 'branch-daily-production', label: 'Branch Daily Report' },
  { value: 'kitchen-daily-production', label: 'Kitchen Daily Report' },
  {
    value: 'bonibe-daily-production-summary',
    label: 'Whole Bonibe Daily Summary',
  },
  { value: 'branch-daily-summary', label: 'Branch Daily Summary' },
  { value: 'branch-weekly-summary', label: 'Branch Weekly Summary' },
  { value: 'client-daily-summary', label: 'Client Daily Summary' },
  { value: 'client-weekly-summary', label: 'Client Weekly Summary' },
  { value: 'production-report', label: 'Production Report' },
  { value: 'damages-losses', label: 'Damages/Losses' },
]

export async function generateReport(
  data: ReportsData,
  request: GenerateReportRequest,
) {
  const table = reportTable(data, request)
  const bytes =
    request.format === 'pdf' ? await buildPdf(table) : await buildWorkbook(table)
  const fileName = reportFileName(data, request)

  downloadBlob(bytes, fileName, mimeType(request.format))

  return { fileName, rowCount: table.rows.length }
}

export async function generateAllReports(
  data: ReportsData,
  request: Omit<GenerateReportRequest, 'kind' | 'format' | 'locationId'>,
) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const branches = reportableBranchLocations(data)
  const clients = data.locations.filter((location) => location.type === 'client')
  const formats: GeneratedReportFormat[] = ['pdf', 'xlsx']

  for (const location of branches) {
    for (const kind of ['branch-daily-summary', 'branch-weekly-summary'] as const) {
      for (const format of formats) {
        await addToZip(zip, data, { ...request, kind, format, locationId: location.id })
      }
    }
  }

  for (const location of clients) {
    for (const kind of ['client-daily-summary', 'client-weekly-summary'] as const) {
      for (const format of formats) {
        await addToZip(zip, data, { ...request, kind, format, locationId: location.id })
      }
    }
  }

  for (const kind of ['production-report', 'damages-losses'] as const) {
    for (const format of formats) {
      await addToZip(zip, data, { ...request, kind, format, locationId: 'all' })
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const fileName = `bonibe-report-pack-${request.dateFrom}-to-${request.dateTo}.zip`
  downloadBlob(content, fileName, 'application/zip')

  return { fileName }
}

async function addToZip(
  zip: {
    file: (path: string, data: Blob | ArrayBuffer) => void
  },
  data: ReportsData,
  request: GenerateReportRequest,
) {
  const table = reportTable(data, request)
  const bytes =
    request.format === 'pdf' ? await buildPdf(table) : await buildWorkbook(table)
  const fileName = reportFileName(data, request)

  zip.file(fileName, bytes)
}

function reportTable(data: ReportsData, request: GenerateReportRequest): ReportTable {
  return {
    'branch-daily-production': () => branchProductionTable(data, request),
    'kitchen-daily-production': () => kitchenProductionTable(data, request),
    'bonibe-daily-production-summary': () =>
      bonibeProductionSummaryTable(data, request),
    'branch-daily-summary': () => branchSummaryTable(data, request, 'Daily'),
    'branch-weekly-summary': () => branchSummaryTable(data, request, 'Weekly'),
    'client-daily-summary': () => clientSummaryTable(data, request, 'Daily'),
    'client-weekly-summary': () => clientSummaryTable(data, request, 'Weekly'),
    'production-report': () => productionTable(data, request),
    'damages-losses': () => damagesTable(data, request),
  }[request.kind]()
}

function branchProductionTable(
  data: ReportsData,
  request: GenerateReportRequest,
): ReportTable {
  const sessions = branchInventorySessionsForRequest(data, request)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const lines = data.branchInventoryLines
    .filter((line) => sessionsById.has(line.session_id))
    .filter((line) => productMatches(line.product_id, request))

  return {
    title: 'Branch Daily Report',
    subtitle: subtitle(data, request),
    headers: [
      'Date',
      'Branch',
      'Product',
      'Category',
      'Opening',
      'Deliveries',
      'Sold',
      'Sales Amount',
      'Damages',
      'Returns',
      'Molds',
      'Transfer Out',
      'Expected End',
      'Actual Count',
      'Variance',
      'Remarks',
    ],
    summary: [
      ['Rows', lines.length],
      ['Total Sales', money(sum(lines, (line) => Number(line.sales_amount)))],
      ['Total Deliveries', int(sum(lines, (line) => line.delivery_qty))],
      ['Total Sold', int(sum(lines, (line) => line.sold_qty))],
      ['Total Damages', int(sum(lines, (line) => line.damage_qty))],
      ['Total Molds', int(sum(lines, (line) => line.mold_qty))],
      ['Total Transfer Out', int(sum(lines, (line) => line.transfer_out_qty))],
      ['Total Variance', int(sum(lines, (line) => line.variance_qty ?? 0))],
    ],
    columnWidths: [13, 22, 24, 15, 11, 12, 10, 14, 10, 10, 10, 14, 14, 13, 11, 28],
    rows: lines.map((line) =>
      branchInventoryRow(data.locations, sessionsById, line),
    ),
    totals: [
      'TOTAL',
      '',
      '',
      '',
      int(sum(lines, (line) => line.opening_count)),
      int(sum(lines, (line) => line.delivery_qty)),
      int(sum(lines, (line) => line.sold_qty)),
      money(sum(lines, (line) => Number(line.sales_amount))),
      int(sum(lines, (line) => line.damage_qty)),
      int(sum(lines, (line) => line.return_qty)),
      int(sum(lines, (line) => line.mold_qty)),
      int(sum(lines, (line) => line.transfer_out_qty)),
      int(sum(lines, (line) => line.expected_ending_count)),
      int(sum(lines, (line) => line.actual_ending_count ?? 0)),
      int(sum(lines, (line) => line.variance_qty ?? 0)),
      '',
    ],
  }
}

function kitchenProductionTable(
  data: ReportsData,
  request: GenerateReportRequest,
): ReportTable {
  const sessions = kitchenInventorySessionsForRequest(data, request)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const lines = data.kitchenInventoryLines
    .filter((line) => sessionsById.has(line.session_id))
    .filter((line) => productMatches(line.product_id, request))

  return {
    title: 'Kitchen Daily Report',
    subtitle: subtitle(data, request),
    headers: [
      'Date',
      'Kitchen',
      'Bread',
      'Category',
      'PRC',
      'PRMG',
      'Production',
      'Branch Allocated',
      'SPR',
      'GF',
      'S/O',
      'DMG',
      'UNK',
      'RMG',
      'Expected Ending',
      'Actual Count',
      'Variance',
      'Peso Value',
      'Status',
      'Remarks',
    ],
    summary: [
      ['Rows', lines.length],
      ['Total Produced', int(sum(lines, (line) => line.produced_qty))],
      ['Branch Allocated', int(sum(lines, (line) => line.order_allocation_qty))],
      ['Total RMG', int(sum(lines, (line) => kitchenRemaining(line)))],
      ['Total DMG', int(sum(lines, (line) => line.damage_qty))],
      ['Total UNK', int(sum(lines, (line) => line.unknown_loss_qty))],
      ['Total Variance', int(sum(lines, (line) => kitchenVariance(line)))],
      ['Total Peso Value', money(sum(lines, (line) => kitchenProducedValue(line)))],
    ],
    columnWidths: [
      13, 20, 24, 15, 10, 10, 13, 16, 10, 10, 10, 10, 10, 10, 15, 13, 11, 14, 13, 28,
    ],
    rows: lines.map((line) =>
      kitchenInventoryRow(data.locations, sessionsById, line),
    ),
    totals: [
      'TOTAL',
      '',
      '',
      '',
      '',
      int(sum(lines, (line) => line.previous_remaining_count)),
      int(sum(lines, (line) => line.produced_qty)),
      int(sum(lines, (line) => line.order_allocation_qty)),
      int(sum(lines, (line) => line.manual_allocation_qty)),
      int(sum(lines, (line) => line.good_for_qty)),
      int(sum(lines, (line) => line.sold_out_qty)),
      int(sum(lines, (line) => line.damage_qty)),
      int(sum(lines, (line) => line.unknown_loss_qty)),
      int(sum(lines, (line) => kitchenRemaining(line))),
      int(sum(lines, (line) => line.expected_ending_count)),
      int(sum(lines, (line) => line.actual_ending_count ?? 0)),
      int(sum(lines, (line) => kitchenVariance(line))),
      money(sum(lines, (line) => kitchenProducedValue(line))),
      '',
      '',
    ],
  }
}

function bonibeProductionSummaryTable(
  data: ReportsData,
  request: GenerateReportRequest,
): ReportTable {
  const rows = wholeBonibeRows(data, request)

  return {
    title: 'Whole Bonibe Daily Summary',
    subtitle: subtitle(data, request),
    headers: [
      'Date',
      'Source',
      'Location',
      'Product',
      'Category',
      'In / Produced',
      'Out / Sold',
      'Remaining',
      'Damage',
      'Unknown / Molds',
      'Variance',
      'Peso Value',
      'Status',
      'Remarks',
    ],
    summary: [
      ['Rows', rows.length],
      ['Total In / Produced', int(sum(rows, (row) => Number(row[5])))],
      ['Total Out / Sold', int(sum(rows, (row) => Number(row[6])))],
      ['Total Remaining', int(sum(rows, (row) => Number(row[7])))],
      ['Total Damage', int(sum(rows, (row) => Number(row[8])))],
      ['Unknown / Molds', int(sum(rows, (row) => Number(row[9])))],
      ['Total Variance', int(sum(rows, (row) => Number(row[10])))],
      ['Total Peso Value', money(sum(rows, (row) => Number(row[11])))],
    ],
    columnWidths: [13, 12, 22, 24, 15, 15, 13, 12, 11, 15, 11, 14, 13, 28],
    rows,
    totals: wholeBonibeTotals(data, request),
  }
}

function branchSummaryTable(
  data: ReportsData,
  request: GenerateReportRequest,
  cadence: 'Daily' | 'Weekly',
): ReportTable {
  const branchLocationIds = reportableBranchLocationIds(data)
  const rows = data.branchLedgerEntries
    .filter((entry) => branchLocationIds.has(entry.branch_location_id))
    .filter((entry) => locationMatches(entry.branch_location_id, request.locationId))
    .filter((entry) => dateWithin(entry.ledger_date, request))
    .sort((a, b) => a.ledger_date.localeCompare(b.ledger_date))

  const headers = [
    'Date',
    'Branch',
    'Shift',
    'Bread Sales',
    'Softdrinks',
    'Batchoy',
    'Short Order',
    'Discount',
    'Expenses',
    'Returns',
    'Net Sales',
    'End Inventory',
    'Excess/Deficit',
    'Remarks',
  ]

  return {
    title: `${cadence} Branch Summary`,
    subtitle: subtitle(data, request),
    headers,
    rows: rows.map((entry) => branchRow(data.locations, entry)),
    totals: [
      'TOTAL',
      '',
      '',
      money(sum(rows, (entry) => entry.bread_sales)),
      money(sum(rows, (entry) => entry.softdrinks)),
      money(sum(rows, (entry) => entry.batchoy)),
      money(sum(rows, (entry) => entry.short_order)),
      money(sum(rows, (entry) => entry.discount)),
      money(sum(rows, (entry) => entry.expenses)),
      money(sum(rows, (entry) => entry.returns)),
      money(sum(rows, branchNetSales)),
      money(sum(rows, (entry) => entry.end_inventory_value)),
      money(sum(rows, (entry) => entry.excess_deficit)),
      '',
    ],
  }
}

function clientSummaryTable(
  data: ReportsData,
  request: GenerateReportRequest,
  cadence: 'Daily' | 'Weekly',
): ReportTable {
  const rows = data.clientLedgerEntries
    .filter((entry) => locationMatches(entry.client_location_id, request.locationId))
    .filter((entry) => dateWithin(entry.created_at, request))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const headers = [
    'Date',
    'Client',
    'Product',
    'Sent',
    'Sold',
    'Returned',
    'Damaged',
    'Amount',
    'Payment',
    'Balance',
    'Net Payable',
    'Status',
    'Notes',
  ]

  return {
    title: `${cadence} Client Summary`,
    subtitle: subtitle(data, request),
    headers,
    rows: rows.map((entry) => clientRow(data.locations, data.products, entry)),
    totals: [
      'TOTAL',
      '',
      '',
      int(sum(rows, (entry) => entry.sent_quantity)),
      int(sum(rows, (entry) => entry.sold_quantity)),
      int(sum(rows, (entry) => entry.return_quantity)),
      int(sum(rows, (entry) => entry.damaged_quantity)),
      money(sum(rows, (entry) => entry.amount)),
      money(sum(rows, (entry) => entry.payment)),
      money(sum(rows, (entry) => entry.balance)),
      money(sum(rows, (entry) => entry.net_payable)),
      '',
      '',
    ],
  }
}

function productionTable(
  data: ReportsData,
  request: GenerateReportRequest,
): ReportTable {
  return kitchenProductionTable(data, request)
}

function damagesTable(data: ReportsData, request: GenerateReportRequest): ReportTable {
  const rows = data.damageReturnEntries
    .filter((entry) => locationMatches(entry.location_id, request.locationId))
    .filter((entry) => dateWithin(entry.created_at, request))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const headers = [
    'Date',
    'Location',
    'Type',
    'Product',
    'Quantity',
    'Unit Value',
    'Total Value',
    'Reason',
    'Notes',
  ]

  return {
    title: 'Damages/Losses',
    subtitle: subtitle(data, request),
    headers,
    rows: rows.map((entry) => damageRow(data.locations, data.products, entry)),
    totals: [
      'TOTAL',
      '',
      '',
      '',
      int(sum(rows, (entry) => entry.quantity)),
      '',
      money(sum(rows, (entry) => Number(entry.total_value ?? 0))),
      '',
      '',
    ],
  }
}

function branchRow(locations: Location[], entry: BranchLedgerEntry) {
  return [
    dateOnly(entry.ledger_date),
    locationName(locations, entry.branch_location_id),
    entry.shift_label ?? '',
    money(entry.bread_sales),
    money(entry.softdrinks),
    money(entry.batchoy),
    money(entry.short_order),
    money(entry.discount),
    money(entry.expenses),
    money(entry.returns),
    money(branchNetSales(entry)),
    money(entry.end_inventory_value),
    money(entry.excess_deficit),
    entry.remarks ?? '',
  ]
}

function clientRow(
  locations: Location[],
  products: Product[],
  entry: ClientLedgerEntry,
) {
  return [
    dateOnly(entry.created_at),
    locationName(locations, entry.client_location_id),
    productName(products, entry.product_id),
    entry.sent_quantity,
    entry.sold_quantity,
    entry.return_quantity,
    entry.damaged_quantity,
    money(entry.amount),
    money(entry.payment),
    money(entry.balance),
    money(entry.net_payable),
    entry.status,
    entry.notes ?? '',
  ]
}

function branchInventoryRow(
  locations: Location[],
  sessionsById: Map<string, BranchInventorySession>,
  line: BranchInventoryLine,
) {
  const session = sessionsById.get(line.session_id)

  return [
    dateOnly(session?.business_date),
    locationName(locations, session?.branch_location_id),
    line.product_name,
    line.category,
    line.opening_count,
    line.delivery_qty,
    line.sold_qty,
    money(Number(line.sales_amount)),
    line.damage_qty,
    line.return_qty,
    line.mold_qty,
    line.transfer_out_qty,
    line.expected_ending_count,
    line.actual_ending_count ?? '',
    branchVariance(line),
    line.remarks ?? '',
  ]
}

function kitchenInventoryRow(
  locations: Location[],
  sessionsById: Map<string, KitchenInventorySession>,
  line: KitchenInventoryLine,
) {
  const session = sessionsById.get(line.session_id)

  return [
    dateOnly(session?.business_date),
    locationName(locations, session?.kitchen_location_id),
    line.product_name,
    line.category,
    money(Number(line.unit_price)),
    line.previous_remaining_count,
    line.produced_qty,
    line.order_allocation_qty,
    line.manual_allocation_qty,
    line.good_for_qty,
    line.sold_out_qty,
    line.damage_qty,
    line.unknown_loss_qty,
    kitchenRemaining(line),
    line.expected_ending_count,
    line.actual_ending_count ?? '',
    kitchenVariance(line),
    money(kitchenProducedValue(line)),
    kitchenStatus(line),
    line.remarks ?? '',
  ]
}

function wholeBonibeRows(
  data: ReportsData,
  request: GenerateReportRequest,
) {
  const branchSessions = branchInventorySessionsForRequest(data, {
    ...request,
    locationId: 'all',
  })
  const branchSessionsById = new Map(
    branchSessions.map((session) => [session.id, session]),
  )
  const branchRows = data.branchInventoryLines
    .filter((line) => branchSessionsById.has(line.session_id))
    .filter((line) => productMatches(line.product_id, request))
    .map((line) => {
      const session = branchSessionsById.get(line.session_id)

      return [
        dateOnly(session?.business_date),
        'Branch',
        locationName(data.locations, session?.branch_location_id),
        line.product_name,
        line.category,
        line.delivery_qty,
        line.sold_qty,
        branchRemaining(line),
        line.damage_qty,
        line.mold_qty,
        branchVariance(line),
        money(Number(line.sales_amount)),
        branchStatus(line),
        line.remarks ?? '',
      ]
    })

  const kitchenSessions = kitchenInventorySessionsForRequest(data, {
    ...request,
    locationId: 'all',
  })
  const kitchenSessionsById = new Map(
    kitchenSessions.map((session) => [session.id, session]),
  )
  const kitchenRows = data.kitchenInventoryLines
    .filter((line) => kitchenSessionsById.has(line.session_id))
    .filter((line) => productMatches(line.product_id, request))
    .map((line) => {
      const session = kitchenSessionsById.get(line.session_id)

      return [
        dateOnly(session?.business_date),
        'Kitchen',
        locationName(data.locations, session?.kitchen_location_id),
        line.product_name,
        line.category,
        line.produced_qty,
        line.order_allocation_qty + line.manual_allocation_qty,
        kitchenRemaining(line),
        line.damage_qty,
        line.unknown_loss_qty,
        kitchenVariance(line),
        money(kitchenProducedValue(line)),
        kitchenStatus(line),
        line.remarks ?? '',
      ]
    })

  return [...kitchenRows, ...branchRows].sort((left, right) =>
    String(left[0]).localeCompare(String(right[0])) ||
    String(left[1]).localeCompare(String(right[1])) ||
    String(left[2]).localeCompare(String(right[2])) ||
    String(left[3]).localeCompare(String(right[3])),
  )
}

function wholeBonibeTotals(data: ReportsData, request: GenerateReportRequest) {
  const rows = wholeBonibeRows(data, request)

  return [
    'TOTAL',
    '',
    '',
    '',
    '',
    int(sum(rows, (row) => Number(row[5]))),
    int(sum(rows, (row) => Number(row[6]))),
    int(sum(rows, (row) => Number(row[7]))),
    int(sum(rows, (row) => Number(row[8]))),
    int(sum(rows, (row) => Number(row[9]))),
    int(sum(rows, (row) => Number(row[10]))),
    money(sum(rows, (row) => Number(row[11]))),
    '',
    '',
  ]
}

function damageRow(
  locations: Location[],
  products: Product[],
  entry: DamageReturnEntry,
) {
  return [
    dateOnly(entry.created_at),
    locationName(locations, entry.location_id),
    entry.entry_type,
    productName(products, entry.product_id),
    entry.quantity,
    money(entry.unit_value),
    money(Number(entry.total_value ?? 0)),
    entry.reason,
    entry.notes ?? '',
  ]
}

async function buildPdf(table: ReportTable) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ orientation: table.headers.length > 9 ? 'landscape' : 'portrait' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Bonibe Bakeshop', 14, 14)
  doc.setFontSize(12)
  doc.text(table.title, 14, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(table.subtitle, 14, 29)

  autoTable(doc, {
    head: [table.headers],
    body: table.totals ? [...table.rows, table.totals] : table.rows,
    startY: 36,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [31, 109, 67] },
    alternateRowStyles: { fillColor: [247, 250, 244] },
  })

  return doc.output('blob')
}

async function buildWorkbook(table: ReportTable) {
  const { default: JSZip } = await import('jszip')
  const workbookRows = workbookRowsFor(table)
  const headerRowNumber =
    workbookRows.findIndex((row) => row.kind === 'header') + 1
  const totalRowNumber =
    workbookRows.findIndex((row) => row.kind === 'total') + 1 || undefined
  const columnCount = Math.max(
    table.headers.length,
    ...workbookRows.map((row) => row.cells.length),
  )
  const columnWidths = table.columnWidths ?? inferredColumnWidths(table)
  const zip = new JSZip()

  zip.file('[Content_Types].xml', contentTypesXml())
  zip.folder('_rels')?.file('.rels', rootRelsXml())
  zip.folder('xl')?.file('workbook.xml', workbookXml(table.title))
  zip.folder('xl')?.file('styles.xml', stylesXml())
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', workbookRelsXml())
  zip
    .folder('xl')
    ?.folder('worksheets')
    ?.file(
      'sheet1.xml',
      worksheetXml(workbookRows, {
        columnCount,
        columnWidths,
        headerRowNumber,
        totalRowNumber,
      }),
    )

  return zip.generateAsync({ type: 'arraybuffer' })
}

type WorkbookRowKind =
  | 'title'
  | 'subtitle'
  | 'meta'
  | 'section'
  | 'summary'
  | 'blank'
  | 'header'
  | 'data'
  | 'total'

type WorkbookRow = {
  cells: Array<string | number>
  kind: WorkbookRowKind
}

function workbookRowsFor(table: ReportTable): WorkbookRow[] {
  const rows: WorkbookRow[] = [
    { kind: 'title', cells: ['Bonibe Bakeshop'] },
    { kind: 'subtitle', cells: [table.title] },
    { kind: 'meta', cells: [table.subtitle] },
    { kind: 'blank', cells: [] },
  ]

  if (table.summary?.length) {
    rows.push({ kind: 'section', cells: ['Daily Summary'] })
    for (const chunk of chunks(table.summary, 3)) {
      rows.push({
        kind: 'summary',
        cells: chunk.flatMap(([label, value]) => [label, value]),
      })
    }
    rows.push({ kind: 'blank', cells: [] })
  }

  rows.push({ kind: 'header', cells: table.headers })
  rows.push(...table.rows.map((cells) => ({ kind: 'data' as const, cells })))

  if (table.totals) {
    rows.push({ kind: 'total', cells: table.totals })
  }

  return rows
}

function chunks<T>(items: T[], size: number) {
  const grouped: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    grouped.push(items.slice(index, index + size))
  }

  return grouped
}

function inferredColumnWidths(table: ReportTable) {
  return table.headers.map((header, index) => {
    const samples = [header, ...table.rows.slice(0, 40).map((row) => row[index])]
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value).length)
    const width = Math.max(10, Math.min(30, Math.max(...samples, 10) + 2))

    return width
  })
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function workbookXml(sheetName: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="5">
    <font><sz val="11"/><name val="Satoshi"/></font>
    <font><b/><sz val="18"/><color rgb="FF123524"/><name val="Satoshi"/></font>
    <font><b/><sz val="13"/><color rgb="FF123524"/><name val="Satoshi"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Satoshi"/></font>
    <font><b/><sz val="11"/><color rgb="FF123524"/><name val="Satoshi"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF14532D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF6E3"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF5D6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border/>
    <border>
      <left style="thin"><color rgb="FFD9E7CF"/></left>
      <right style="thin"><color rgb="FFD9E7CF"/></right>
      <top style="thin"><color rgb="FFD9E7CF"/></top>
      <bottom style="thin"><color rgb="FFD9E7CF"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`
}

function worksheetXml(
  rows: WorkbookRow[],
  options: {
    columnCount: number
    columnWidths: number[]
    headerRowNumber: number
    totalRowNumber?: number
  },
) {
  const lastColumn = columnName(options.columnCount - 1)
  const lastRow = rows.length
  const dataEndRow = options.totalRowNumber
    ? Math.max(options.headerRowNumber, options.totalRowNumber - 1)
    : lastRow

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="${options.headerRowNumber}" topLeftCell="A${options.headerRowNumber + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  ${columnsXml(options.columnWidths, options.columnCount)}
  <sheetData>
    ${rows.map((row, index) => worksheetRowXml(row, index + 1)).join('')}
  </sheetData>
  <autoFilter ref="A${options.headerRowNumber}:${lastColumn}${dataEndRow}"/>
  <mergeCells count="3">
    <mergeCell ref="A1:${lastColumn}1"/>
    <mergeCell ref="A2:${lastColumn}2"/>
    <mergeCell ref="A3:${lastColumn}3"/>
  </mergeCells>
</worksheet>`
}

function columnsXml(widths: number[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const width = widths[index] ?? 14

    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  })

  return `<cols>${columns.join('')}</cols>`
}

function worksheetRowXml(row: WorkbookRow, rowNumber: number) {
  const rowAttributes =
    row.kind === 'title'
      ? ' ht="24" customHeight="1"'
      : row.kind === 'header'
        ? ' ht="22" customHeight="1"'
        : ''

  return `<row r="${rowNumber}"${rowAttributes}>${row.cells
    .map((value, index) => worksheetCellXml(value, row, rowNumber, index))
    .join('')}</row>`
}

function worksheetCellXml(
  value: string | number,
  row: WorkbookRow,
  rowNumber: number,
  columnIndex: number,
) {
  const ref = `${columnName(columnIndex)}${rowNumber}`
  const style = workbookStyleFor(row, value, columnIndex)

  if (typeof value === 'number' || isMoneyString(value)) {
    return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`
  }

  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`
}

function workbookStyleFor(
  row: WorkbookRow,
  value: string | number,
  columnIndex: number,
) {
  const moneyValue = isMoneyString(value)

  if (row.kind === 'title') {
    return 1
  }
  if (row.kind === 'subtitle' || row.kind === 'meta') {
    return 2
  }
  if (row.kind === 'section') {
    return 3
  }
  if (row.kind === 'summary') {
    return columnIndex % 2 === 0 ? 3 : moneyValue ? 7 : 4
  }
  if (row.kind === 'header') {
    return 5
  }
  if (row.kind === 'total') {
    return moneyValue ? 8 : 6
  }

  return moneyValue ? 7 : 0
}

function isMoneyString(value: string | number) {
  return typeof value === 'string' && /^-?\d+\.\d{2}$/.test(value)
}

function columnName(index: number) {
  let column = ''
  let value = index + 1

  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }

  return column
}

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function reportFileName(data: ReportsData, request: GenerateReportRequest) {
  const label = generatedReportKinds.find((kind) => kind.value === request.kind)
    ?.label ?? request.kind
  const location = request.locationId === 'all'
    ? 'all-locations'
    : locationName(data.locations, request.locationId)

  return `${slug(label)}-${slug(location)}-${request.dateFrom}-to-${request.dateTo}.${request.format}`
}

function subtitle(data: ReportsData, request: GenerateReportRequest) {
  const location = request.locationId === 'all'
    ? allLocationLabel(request.kind)
    : locationName(data.locations, request.locationId)
  const product =
    request.productId && request.productId !== 'all'
      ? ` | ${productName(data.products, request.productId)}`
      : ''
  const date =
    request.dateFrom === request.dateTo
      ? request.dateFrom
      : `${request.dateFrom} to ${request.dateTo}`

  return `${location} | ${date}${product}`
}

function allLocationLabel(kind: GeneratedReportKind) {
  if (kind === 'bonibe-daily-production-summary') {
    return 'Whole Bonibe'
  }

  if (kind.startsWith('branch')) {
    return 'All branches'
  }

  if (kind.startsWith('client')) {
    return 'All clients'
  }

  return 'All branches and clients'
}

function locationName(locations: Location[], id: string | null | undefined) {
  return locations.find((location) => location.id === id)?.name ?? id ?? 'All'
}

function productName(products: Product[], id: string | null | undefined) {
  return products.find((product) => product.id === id)?.name ?? id ?? ''
}

function locationMatches(rowLocationId: string | null, selectedLocationId: string) {
  return selectedLocationId === 'all' || rowLocationId === selectedLocationId
}

function productMatches(productId: string | null, request: Pick<GenerateReportRequest, 'productId'>) {
  return !request.productId || request.productId === 'all' || productId === request.productId
}

function branchInventorySessionsForRequest(
  data: ReportsData,
  request: GenerateReportRequest,
) {
  const branchLocationIds = reportableBranchLocationIds(data)

  return data.branchInventorySessions
    .filter((session) => branchLocationIds.has(session.branch_location_id))
    .filter((session) => locationMatches(session.branch_location_id, request.locationId))
    .filter((session) => dateWithin(session.business_date, request))
    .sort((a, b) =>
      [a.business_date, locationName(data.locations, a.branch_location_id)].join('|').localeCompare(
        [b.business_date, locationName(data.locations, b.branch_location_id)].join('|'),
      ),
    )
}

function reportableBranchLocations(data: ReportsData) {
  const branchLocationIds = reportableBranchLocationIds(data)

  return data.locations.filter((location) => branchLocationIds.has(location.id))
}

function reportableBranchLocationIds(data: ReportsData) {
  const assignedBranchLocationIds = new Set(
    data.profiles
      .filter(
        (profile) =>
          profile.active &&
          profile.role === 'branch' &&
          Boolean(profile.assigned_location_id),
      )
      .map((profile) => profile.assigned_location_id as string),
  )

  return new Set(
    data.locations
      .filter(
        (location) =>
          location.type === 'branch' &&
          location.active &&
          assignedBranchLocationIds.has(location.id),
      )
      .map((location) => location.id),
  )
}

function kitchenInventorySessionsForRequest(
  data: ReportsData,
  request: GenerateReportRequest,
) {
  return data.kitchenInventorySessions
    .filter((session) => locationMatches(session.kitchen_location_id, request.locationId))
    .filter((session) => dateWithin(session.business_date, request))
    .sort((a, b) =>
      [a.business_date, locationName(data.locations, a.kitchen_location_id)].join('|').localeCompare(
        [b.business_date, locationName(data.locations, b.kitchen_location_id)].join('|'),
      ),
    )
}

function dateWithin(value: string | null | undefined, request: Pick<GenerateReportRequest, 'dateFrom' | 'dateTo'>) {
  const date = dateOnly(value)

  return Boolean(date) && date >= request.dateFrom && date <= request.dateTo
}

function branchRemaining(line: BranchInventoryLine) {
  return line.actual_ending_count ?? line.expected_ending_count
}

function branchVariance(line: BranchInventoryLine) {
  return line.variance_qty ?? branchRemaining(line) - line.expected_ending_count
}

function branchStatus(line: BranchInventoryLine) {
  if (branchVariance(line) !== 0) {
    return 'Variance'
  }
  if (line.damage_qty > 0) {
    return 'Damage'
  }
  if (line.mold_qty > 0) {
    return 'Molds'
  }
  if (branchRemaining(line) > 0) {
    return 'Remaining'
  }
  return 'Balanced'
}

function kitchenRemaining(line: KitchenInventoryLine) {
  return line.actual_ending_count ?? line.expected_ending_count
}

function kitchenVariance(line: KitchenInventoryLine) {
  return line.variance_qty ?? kitchenRemaining(line) - line.expected_ending_count
}

function kitchenProducedValue(line: KitchenInventoryLine) {
  return Number(line.produced_qty) * Number(line.unit_price)
}

function kitchenStatus(line: KitchenInventoryLine) {
  if (kitchenVariance(line) !== 0) {
    return 'Variance'
  }
  if (line.damage_qty > 0) {
    return 'Damage'
  }
  if (line.unknown_loss_qty > 0) {
    return 'Unknown'
  }
  if (line.sold_out_qty > 0) {
    return 'Sold Out'
  }
  if (kitchenRemaining(line) > 0) {
    return 'Remaining'
  }
  return 'Balanced'
}

function dateOnly(value: string | null | undefined) {
  return value?.slice(0, 10) ?? ''
}

function branchNetSales(entry: BranchLedgerEntry) {
  return (
    Number(entry.bread_sales) +
    Number(entry.softdrinks) +
    Number(entry.batchoy) +
    Number(entry.short_order) -
    Number(entry.discount)
  )
}

function sum<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + Number(selector(row) ?? 0), 0)
}

function money(value: number) {
  return Number(value || 0).toFixed(2)
}

function int(value: number) {
  return Math.round(Number(value || 0))
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mimeType(format: GeneratedReportFormat) {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

function downloadBlob(
  content: Blob | ArrayBuffer,
  fileName: string,
  type: string,
) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
