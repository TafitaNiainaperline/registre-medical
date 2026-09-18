import type { ItemType, StockReportRow } from './types'

export function catalogueReport(rows: StockReportRow[], itemType: ItemType = 'medication') {
  if (itemType !== 'medication' && itemType !== 'act') throw new Error('Type de catalogue invalide.')
  const isAct = itemType === 'act'
  return {
    title: isAct ? 'Actes médicaux' : 'Stock des médicaments',
    filename: isAct ? 'actes_medicaux' : 'stock_medicaments',
    rows: rows.filter((row) => (row.item_type || 'medication') === itemType),
    columns: [
      { header: isAct ? 'Acte médical' : 'Médicament', key: 'name', width: isAct ? 64 : 42, percent: isAct ? 75 : 46, align: 'left' as const },
      { header: 'Prix (Ar)', key: 'price', width: 18, percent: isAct ? 25 : 20, align: 'right' as const },
      ...(!isAct ? [
        { header: 'Unité', key: 'unit', width: 16, percent: 18, align: 'center' as const },
        { header: 'Stock', key: 'stock', width: 14, percent: 16, align: 'center' as const },
      ] : []),
    ],
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char)
}

export function buildCatalogueHtml(rows: StockReportRow[], itemType: ItemType): string {
  const report = catalogueReport(rows, itemType)
  const body = report.rows.map((row) => `<tr>${report.columns.map(({ key, align }) => {
    const value = key === 'price' ? Number(row.price).toLocaleString('fr-FR')
      : key === 'stock' ? (row.stock ?? 'Non suivi')
      : key === 'unit' ? (row.unit || 'comprimé') : row.name
    return `<td class="${align}${key === 'price' || key === 'stock' ? ' numeric' : ''}">${escapeHtml(value)}</td>`
  }).join('')}</tr>`).join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${report.title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #15323b; margin: 0; }
      header { border-top: 5px solid #1c96a4; padding: 24px 0; }
      h1 { font-size: 25px; margin: 0 0 10px; color: #0d7280; }
      p { font-size: 11px; color: #5f7b84; }
      * { box-sizing: border-box; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; }
      th { text-align: left; background: #eaf5f7; color: #0d7280; }
      th, td { padding: 12px 10px; border-bottom: 1px solid #d8e4e8; overflow-wrap: anywhere; vertical-align: middle; line-height: 1.45; }
      tbody tr:nth-child(even) { background: #f5f9fa; }
      tr { break-inside: avoid; } thead { display: table-header-group; }
      .left { text-align: left; } .right { text-align: right; } .center { text-align: center; }
      .numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
      footer { margin-top: 24px; font-size: 10px; color: #5f7b84; }
      @page { margin: 16mm; }
    </style></head><body><header><h1>${report.title}</h1>
    <p>${report.rows.length} élément(s) · Édité le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Indian/Antananarivo' })}</p></header>
    <table><colgroup>${report.columns.map((column) => `<col style="width: ${column.percent}%">`).join('')}</colgroup>
    <thead><tr>${report.columns.map((column) => `<th class="${column.align}">${column.header}</th>`).join('')}</tr></thead>
    <tbody>${body || `<tr><td colspan="${report.columns.length}">Aucun élément dans ce catalogue.</td></tr>`}</tbody></table>
    <footer>Tarifs exprimés en ariary (Ar).</footer></body></html>`
}
