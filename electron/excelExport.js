const ExcelJS = require('exceljs');

function displayAge(stored) {
  const value = String(stored || '');
  if (!value) return '';
  if (!value.includes('|')) return value;
  const [v, type, j] = value.split('|');
  if (type === 'ans') return `${v} ${Number(v) > 1 ? 'ans' : 'an'}`;
  if (type === 'mois') return `${v} mois`;
  if (type === 'mois_jours') return `${v} mois ${j} jour${Number(j) > 1 ? 's' : ''}`;
  if (type === 'jours') return `${v} jour${Number(v) > 1 ? 's' : ''}`;
  return value;
}

function formatMadagascarDate(utcString) {
  if (!utcString) return '';
  const d = new Date(utcString);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

async function writeArchiveExcel({ filePath, year, month, records }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Registre Médical';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Archives ${year}-${pad2(month)}`, {
    properties: { defaultRowHeight: 18 }
  });

  ws.columns = [
    { header: 'N° registre', key: 'registry', width: 12 },
    { header: 'Nom', key: 'nom', width: 18 },
    { header: 'Prénom', key: 'prenom', width: 18 },
    { header: 'Âge', key: 'age', width: 10 },
    { header: 'Sexe', key: 'sexe', width: 8 },
    { header: 'Diagnostic', key: 'diagnostic', width: 26 },
    { header: 'Médicaments', key: 'meds', width: 30 },
    { header: 'Quantités', key: 'qty', width: 12 },
    { header: 'Prix unitaires (Ar)', key: 'unit', width: 16 },
    { header: 'Sous-totaux (Ar)', key: 'line_total', width: 16 },
    { header: 'Coût total (Ar)', key: 'total', width: 14 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Mois', key: 'month', width: 8 },
    { header: 'Année', key: 'year', width: 8 },
    { header: 'Catégorie', key: 'category', width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C96A4' } };
  headerRow.height = 22;

  let grandTotal = 0;

  (records || []).forEach((r) => {
    const meds = Array.isArray(r.treatments) ? r.treatments : [];
    const medsNames = meds.map(m => m.name).join('\n');
    const medsQty = meds.map(m => m.item_type === 'act' ? '' : `${m.quantity}${m.unit ? ` ${m.unit}` : ''}`).join('\n');
    const medsUnit = meds.map(m => `${m.unit_price}`).join('\n');
    const medsLineTotal = meds.map(m => `${(Number(m.total) || (Number(m.unit_price) * Number(m.quantity)))}`).join('\n');
    const computedFromMeds = meds.reduce((s, m) => s + (Number(m.total) || (Number(m.unit_price) * Number(m.quantity))), 0);
    const total = meds.length ? computedFromMeds : (Number(r.cost) || 0);
    grandTotal += total;

    const createdAt = r.created_at ? formatMadagascarDate(r.created_at) : '';
    const registryNumber = String(r.registry_number || '').match(/(\d+)$/);
    const displayRegistry = registryNumber ? String(registryNumber[1]).padStart(3, '0') : '-';

    const row = ws.addRow({
      registry: displayRegistry,
      nom: r.patient_nom || '',
      prenom: r.patient_prenom || '',
      age: displayAge(r.age),
      sexe: r.sexe || '',
      diagnostic: r.diagnostic || '',
      meds: medsNames || (r.traitement || ''),
      qty: medsQty,
      unit: medsUnit,
      line_total: medsLineTotal,
      total,
      date: createdAt,
      month: Number(r.archive_month) || month,
      year: Number(r.archive_year) || year,
      category: r.category || '',
    });

    row.alignment = { vertical: 'top', wrapText: true };
  });

  ws.addRow({});
  const totalRow = ws.addRow({
    diagnostic: 'TOTAL GÉNÉRAL',
    total: grandTotal
  });
  totalRow.font = { bold: true };
  totalRow.getCell('diagnostic').alignment = { horizontal: 'right' };

  // Borders
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE6EFF2' } },
        left: { style: 'thin', color: { argb: 'FFE6EFF2' } },
        bottom: { style: 'thin', color: { argb: 'FFE6EFF2' } },
        right: { style: 'thin', color: { argb: 'FFE6EFF2' } },
      };
      if (rowNumber > 1) {
        cell.alignment = cell.alignment || {};
      }
    });
  });

  await wb.xlsx.writeFile(filePath);
}

async function writeStockExcel({
  filePath,
  medications
}) {

  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Stock');

  ws.columns = [
    { header: 'Nom', key: 'name', width: 30 },
    { header: 'Prix', key: 'price', width: 15 },
    { header: 'Unité', key: 'unit', width: 15 },
    { header: 'Stock', key: 'stock', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
  ];

  medications.forEach((m) => {
    ws.addRow({
      name: m.name,
      price: m.price,
      unit: m.unit,
      stock: m.stock,
      description: m.description || ''
    });
  });

  await wb.xlsx.writeFile(filePath);
}

module.exports = { writeArchiveExcel, writeStockExcel };
