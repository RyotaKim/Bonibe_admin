import type {
  BranchLedgerEntry,
  ClientLedgerEntry,
  DamageReturnEntry,
  Location,
  Product,
  ProductionAllocation,
  ProductionReport,
  ProductionReportLine,
  ReportsData,
} from '../types/admin'

export type GeneratedReportKind =
  | 'branch-daily-production'
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
}

export const generatedReportKinds: Array<{
  value: GeneratedReportKind
  label: string
}> = [
  { value: 'branch-daily-production', label: 'Branch Daily Production' },
  {
    value: 'bonibe-daily-production-summary',
    label: 'Whole Bonibe Daily Production Summary',
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
  const branches = data.locations.filter((location) => location.type === 'branch')
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
  const branches = data.locations
    .filter((location) => location.type === 'branch')
    .filter((location) => locationMatches(location.id, request.locationId))
  const reports = productionReportsForRequest(data, request)
  const reportIds = new Set(reports.map((report) => report.id))
  const lines = data.productionLines
    .filter((line) => reportIds.has(line.production_report_id))
    .filter((line) => productMatches(line.product_id, request))
  const branchRows = lines
    .flatMap((line) => {
      const report = reports.find((item) => item.id === line.production_report_id)

      return branches
        .map((branch) => {
          const allocated = int(
            sum(
              data.productionAllocations.filter(
                (allocation) =>
                  allocation.production_report_line_id === line.id &&
                  allocation.destination_location_id === branch.id,
              ),
              (allocation) => allocation.quantity,
            ),
          )

          if (allocated <= 0) {
            return null
          }

          return {
            date: dateOnly(report?.production_date),
            branch: branch.name,
            product: productName(data.products, line.product_id),
            plates: line.plates,
            piecesPerPlate: line.pieces_per_plate,
            expected: line.expected_pieces,
            actual: line.actual_pieces,
            allocated,
            damages: line.damages,
            returns: line.returns,
            unknownLoss: line.unknown_loss,
            balance: line.balance,
            status: line.status,
            notes: line.notes ?? line.reason ?? '',
            price: productPrice(data.products, line.product_id),
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
    })
    .sort((a, b) =>
      [a.date, a.branch, a.product].join('|').localeCompare(
        [b.date, b.branch, b.product].join('|'),
      ),
    )

  const singleBranch = request.locationId !== 'all'

  return {
    title: 'Branch Daily Production Report',
    subtitle: subtitle(data, request),
    headers: [
      'Date',
      'Branch',
      'Product',
      'Price',
      'Plates',
      'Pieces/Plate',
      'Expected',
      'Actual',
      'Allocated to Branch',
      'Damages',
      'Returns',
      'Unknown Loss',
      'Balance',
      'Status',
      'Notes',
    ],
    rows: branchRows.map((row) => [
      row.date,
      row.branch,
      row.product,
      money(row.price),
      row.plates,
      row.piecesPerPlate,
      row.expected,
      row.actual,
      row.allocated,
      row.damages,
      row.returns,
      row.unknownLoss,
      row.balance,
      row.status,
      row.notes,
    ]),
    totals: singleBranch
      ? [
          'TOTAL',
          '',
          '',
          '',
          int(sum(branchRows, (row) => row.plates)),
          '',
          int(sum(branchRows, (row) => row.expected)),
          int(sum(branchRows, (row) => row.actual)),
          int(sum(branchRows, (row) => row.allocated)),
          int(sum(branchRows, (row) => row.damages)),
          int(sum(branchRows, (row) => row.returns)),
          int(sum(branchRows, (row) => row.unknownLoss)),
          int(sum(branchRows, (row) => row.balance)),
          '',
          '',
        ]
      : [
          'TOTAL',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          int(sum(branchRows, (row) => row.allocated)),
          '',
          '',
          '',
          '',
          '',
          '',
        ],
  }
}

function bonibeProductionSummaryTable(
  data: ReportsData,
  request: GenerateReportRequest,
): ReportTable {
  const table = productionTable(data, request)

  return {
    ...table,
    title: 'Whole Bonibe Daily Production Summary',
    subtitle: subtitle(data, request),
  }
}

function branchSummaryTable(
  data: ReportsData,
  request: GenerateReportRequest,
  cadence: 'Daily' | 'Weekly',
): ReportTable {
  const rows = data.branchLedgerEntries
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
  const locations = data.locations.filter((location) =>
    ['branch', 'client'].includes(location.type),
  )
  const reports = productionReportsForRequest(data, request)
  const reportIds = new Set(reports.map((report) => report.id))
  const lines = data.productionLines
    .filter((line) => reportIds.has(line.production_report_id))
    .filter((line) => productMatches(line.product_id, request))

  const headers = [
    'Date',
    'Product',
    'Price',
    'Plates',
    'Pieces/Plate',
    'Expected',
    'Actual',
    ...locations.map((location) => location.name),
    'Damages',
    'Returns',
    'Unknown Loss',
    'Balance',
    'Status',
    'Notes',
  ]

  return {
    title: 'Production Report',
    subtitle: subtitle(data, request),
    headers,
    rows: lines.map((line) =>
      productionRow(
        data.products,
        reports,
        locations,
        data.productionAllocations,
        line,
      ),
    ),
    totals: [
      'TOTAL',
      '',
      '',
      int(sum(lines, (line) => line.plates)),
      '',
      int(sum(lines, (line) => line.expected_pieces)),
      int(sum(lines, (line) => line.actual_pieces)),
      ...locations.map((location) =>
        int(
          sumAllocationsForLocation(data.productionAllocations, lines, location.id),
        ),
      ),
      int(sum(lines, (line) => line.damages)),
      int(sum(lines, (line) => line.returns)),
      int(sum(lines, (line) => line.unknown_loss)),
      int(sum(lines, (line) => line.balance)),
      '',
      '',
    ],
  }
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

function productionRow(
  products: Product[],
  reports: ProductionReport[],
  locations: Location[],
  allocations: ProductionAllocation[],
  line: ProductionReportLine,
) {
  const report = reports.find((item) => item.id === line.production_report_id)

  return [
    dateOnly(report?.production_date),
    productName(products, line.product_id),
    money(productPrice(products, line.product_id)),
    line.plates,
    line.pieces_per_plate,
    line.expected_pieces,
    line.actual_pieces,
    ...locations.map((location) =>
      int(
        sum(
          allocations.filter(
            (allocation) =>
              allocation.production_report_line_id === line.id &&
              allocation.destination_location_id === location.id,
          ),
          (allocation) => allocation.quantity,
        ),
      ),
    ),
    line.damages,
    line.returns,
    line.unknown_loss,
    line.balance,
    line.status,
    line.notes ?? line.reason ?? '',
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
  const sheetRows = [
    ['Bonibe Bakeshop'],
    [table.title],
    [table.subtitle],
    [],
    table.headers,
    ...table.rows,
    ...(table.totals ? [table.totals] : []),
  ]
  const zip = new JSZip()

  zip.file('[Content_Types].xml', contentTypesXml())
  zip.folder('_rels')?.file('.rels', rootRelsXml())
  zip.folder('xl')?.file('workbook.xml', workbookXml(table.title))
  zip.folder('xl')?.file('styles.xml', stylesXml())
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', workbookRelsXml())
  zip
    .folder('xl')
    ?.folder('worksheets')
    ?.file('sheet1.xml', worksheetXml(sheetRows))

  return zip.generateAsync({ type: 'arraybuffer' })
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
  <fonts count="1"><font><sz val="11"/><name val="Satoshi"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`
}

function worksheetXml(rows: Array<Array<string | number>>) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.map((row, index) => worksheetRowXml(row, index + 1)).join('')}
  </sheetData>
</worksheet>`
}

function worksheetRowXml(row: Array<string | number>, rowNumber: number) {
  return `<row r="${rowNumber}">${row
    .map((value, index) => worksheetCellXml(value, rowNumber, index))
    .join('')}</row>`
}

function worksheetCellXml(
  value: string | number,
  rowNumber: number,
  columnIndex: number,
) {
  const ref = `${columnName(columnIndex)}${rowNumber}`

  if (typeof value === 'number') {
    return `<c r="${ref}"><v>${value}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`
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

function productPrice(products: Product[], id: string) {
  return Number(products.find((product) => product.id === id)?.unit_price ?? 0)
}

function locationMatches(rowLocationId: string | null, selectedLocationId: string) {
  return selectedLocationId === 'all' || rowLocationId === selectedLocationId
}

function productMatches(productId: string | null, request: Pick<GenerateReportRequest, 'productId'>) {
  return !request.productId || request.productId === 'all' || productId === request.productId
}

function productionReportsForRequest(
  data: ReportsData,
  request: GenerateReportRequest,
) {
  return data.productionReports
    .filter((report) => dateWithin(report.production_date, request))
    .sort((a, b) => a.production_date.localeCompare(b.production_date))
}

function dateWithin(value: string | null | undefined, request: Pick<GenerateReportRequest, 'dateFrom' | 'dateTo'>) {
  const date = dateOnly(value)

  return Boolean(date) && date >= request.dateFrom && date <= request.dateTo
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

function sumAllocationsForLocation(
  allocations: ProductionAllocation[],
  lines: ProductionReportLine[],
  locationId: string,
) {
  const lineIds = new Set(lines.map((line) => line.id))

  return sum(
    allocations.filter(
      (allocation) =>
        lineIds.has(allocation.production_report_line_id) &&
        allocation.destination_location_id === locationId,
    ),
    (allocation) => allocation.quantity,
  )
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
