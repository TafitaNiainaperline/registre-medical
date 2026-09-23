import fs from 'fs'
import path from 'path'
import type { Dispensation, MedicalRecord, Treatment } from './types'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMadagascarDateTime(utcString: string | Date | null | undefined): string {
  if (!utcString) return '-'
  const d = new Date(typeof utcString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(utcString)
    ? `${utcString.replace(' ', 'T')}Z`
    : utcString)
  const offset = 3 * 60
  const local = new Date(d.getTime() + offset * 60 * 1000)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  const h = String(local.getUTCHours()).padStart(2, '0')
  const min = String(local.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function formatMoney(value: number | null | undefined): string {
  return `${Number(value || 0).toLocaleString('fr-FR')} Ar`
}

function numberToFrenchWords(value: number): string {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
  const underHundred = (number: number): string => {
    if (number < 17) return units[number]
    if (number < 20) return `dix-${units[number - 10]}`
    if (number < 70) {
      const tens = ['vingt', 'trente', 'quarante', 'cinquante', 'soixante'][Math.floor(number / 10) - 2]
      const remainder = number % 10
      return remainder ? `${tens}${remainder === 1 ? ' et un' : `-${units[remainder]}`}` : tens
    }
    if (number < 80) return number === 71 ? 'soixante et onze' : `soixante-${underHundred(number - 60)}`
    return number === 80 ? 'quatre-vingts' : `quatre-vingt-${underHundred(number - 80)}`
  }
  const underThousand = (number: number): string => {
    if (number < 100) return underHundred(number)
    const hundreds = Math.floor(number / 100)
    const remainder = number % 100
    const prefix = hundreds === 1 ? 'cent' : `${units[hundreds]} cent`
    return remainder ? `${prefix} ${underHundred(remainder)}` : `${prefix}${hundreds > 1 ? 's' : ''}`
  }
  const integer = Math.max(0, Math.round(Number(value) || 0))
  if (integer < 1000) return underThousand(integer)
  const thousands = Math.floor(integer / 1000)
  const remainder = integer % 1000
  const prefix = thousands === 1 ? 'mille' : `${underThousand(thousands)} mille`
  return remainder ? `${prefix} ${underThousand(remainder)}` : prefix
}

function getLogoDataUri(): string {
  const candidates = [
    path.join(__dirname, '../public/Logo.png'),
    path.join(__dirname, '../dist/Logo.png'),
  ]

  const logoPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!logoPath) return ''

  const bytes = fs.readFileSync(logoPath)
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const mime = isJpeg ? 'image/jpeg' : 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function buildReceiptHtml(record: MedicalRecord): string {
  const treatments: Treatment[] = Array.isArray(record.treatments) ? record.treatments : []
  const rows = treatments.length
    ? treatments.map((t) => {
        const total = Number(t.total) || Number(t.unit_price || 0) * Number(t.quantity || 0)
        return `
          <li class="receipt-item">
            <div class="item-name">${escapeHtml(t.name)}</div>
            <div class="item-detail">${escapeHtml(t.quantity)} × ${escapeHtml(formatMoney(t.unit_price))}</div>
            <div class="item-amount">${escapeHtml(formatMoney(total))}</div>
          </li>
        `
      }).join('')
    : `
      <li class="receipt-item">
        <div class="item-name">${escapeHtml(record.traitement || 'Traitement')}</div>
        <div class="item-amount">${escapeHtml(formatMoney(record.cost))}</div>
      </li>
    `

  const date = formatMadagascarDateTime(record.created_at || new Date())
  const amount = Number(record.cost) || 0
  return buildInvoiceHtml(rows, amount, `<section class="grid">
          <div class="field"><div class="label">Patient</div><div class="value">${escapeHtml(record.patient_nom)} ${escapeHtml(record.patient_prenom)}</div></div>
          <div class="field"><div class="label">Sexe</div><div class="value">${escapeHtml(record.sexe || '-')}</div></div>
          <div class="field"><div class="label">Domicile</div><div class="value">${escapeHtml(record.domicile || '-')}</div></div>
        </section>`, 'Soins et traitements', date)
}

function buildInvoiceHtml(rows: string, amount: number, details: string, sectionTitle: string, date: string): string {
  const logoDataUri = getLogoDataUri()
  const logoHtml = logoDataUri
    ? `<img class="receipt-logo" src="${logoDataUri}" alt="Logo du centre médical" />`
    : ''
  const amountInWords = numberToFrenchWords(amount)

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Facture</title>
      <style>
        * { box-sizing: border-box; }
        html { margin: 0; padding: 0; }
        body { width: 100%; max-width: 80mm; font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.35; color: #000; margin: 0 auto; background: #fff; text-align: center; }
        .receipt { width: 100%; max-width: 64mm; margin: 0 auto; padding: 4mm 2mm 8mm; overflow-wrap: anywhere; word-break: normal; }
        .top { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
        .identity { display: flex; flex-direction: column; align-items: center; width: 100%; }
        .receipt-logo { display: block; margin: 0 auto; width: 48mm; max-width: 100%; height: auto; object-fit: contain; filter: grayscale(1); }
        .receipt-phone { margin: 1mm 0 0; font-size: 8pt; text-align: center; }
        .receipt-date { margin: 1mm 0 0; font-size: 8pt; }
        .receipt-registration { margin: 0.5mm 0 0; font-size: 7pt; text-align: center; }
        h1 { margin: 2mm 0 1mm; font-size: 12pt; letter-spacing: 1px; text-transform: uppercase; text-align: center; }
        .grid { margin: 3mm 0; padding-bottom: 1mm; }
        .field { margin-bottom: 1.5mm; text-align: center; }
        .label { font-size: 8pt; }
        .value { max-width: 100%; font-weight: bold; }
        h2 { margin: 0; padding: 2mm 0; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 9pt; font-weight: bold; }
        .items { list-style: none; margin: 0; padding: 0; }
        .receipt-item { padding: 2.5mm 0; border-bottom: 1px dotted #000; }
        .item-name { font-weight: bold; }
        .item-detail { margin-top: 1mm; font-size: 8pt; }
        .item-amount { margin-top: 1mm; font-size: 9pt; font-weight: bold; }
        .total { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000; text-align: center; font-size: 11pt; font-weight: bold; break-inside: avoid; }
        .amount-words { margin-top: 2mm; font-size: 7.5pt; line-height: 1.5; text-align: center; }
        .amount-words strong { display: block; margin-top: 0.5mm; }
        .responsible-signature { margin-top: 3mm; text-align: center; font-size: 8pt; }
        .responsible-signature span { display: block; height: 8mm; }
        .footer { padding: 2mm 2mm 0; border-top: 1px dashed #000; text-align: center; font-size: 6.5pt; line-height: 1.6; }
        .footer p { margin: 0; }
        .footer .reference { margin-top: 1mm; }
        @page { margin: 0; }
      </style>
    </head>
    <body>
      <main class="receipt">
        <div class="top">
          <div class="identity">
            ${logoHtml}
            <p class="receipt-phone">Tél. : 033 75 983 08</p>
            <p class="receipt-registration">NIF : 4003009731</p>
            <p class="receipt-registration">STAT : 86100232018000141</p>
            <div>
              <h1>Facture</h1>
            </div>
            <p class="receipt-date">Date et heure : ${escapeHtml(date)}</p>
          </div>
        </div>

        ${details}

        <section aria-label="${escapeHtml(sectionTitle)}">
          <h2>${escapeHtml(sectionTitle)}</h2>
          <ul class="items">${rows}</ul>
        </section>

        <div class="total">Total : ${escapeHtml(formatMoney(amount))}</div>
        <div class="amount-words">Arrêtée à la somme de : <strong>${escapeHtml(amountInWords)} ariary</strong></div>
        <div class="responsible-signature"><strong>Responsable</strong><span></span></div>
        <div class="footer"><p>Mba hambinina sy ho salama amin'ny zavatra rehetra anie ianao, tahaka izay anambinana ny fanahinao ihany.</p><p class="reference">III Jon 1:2</p></div>
      </main>
    </body>
  </html>`
}

function buildDispensationReceiptHtml(data: Dispensation | Dispensation[]): string {
  const items = Array.isArray(data) ? data : [data]
  const amount = items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity), 0)
  const rows = items.map((dispensation) => `<li class="receipt-item">
    <div class="item-name">${escapeHtml(dispensation.medication_name)}</div>
    <div class="item-detail">${escapeHtml(dispensation.quantity)} ${escapeHtml(dispensation.unit || 'comprimé')} × ${escapeHtml(formatMoney(dispensation.unit_price))}</div>
    <div class="item-amount">${escapeHtml(formatMoney(Number(dispensation.unit_price || 0) * Number(dispensation.quantity)))}</div>
  </li>`).join('')
  const first = items[0]
  const details = first ? `<section class="grid"><div>Achat n° ${escapeHtml(Math.min(...items.map((item) => item.id)))}</div></section>` : ''
  return buildInvoiceHtml(rows, amount, details, 'Médicaments', formatMadagascarDateTime(first?.created_at))
}

export { buildReceiptHtml, buildDispensationReceiptHtml }
