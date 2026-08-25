const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMadagascarDateTime(utcString) {
  if (!utcString) return '-';
  const d = new Date(utcString);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  const h = String(local.getHours()).padStart(2, '0');
  const min = String(local.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function displayAge(stored) {
  const value = String(stored || '');
  if (!value) return '-';
  if (!value.includes('|')) return value;
  const [v, type, j] = value.split('|');
  if (type === 'ans') return `${v} ${Number(v) > 1 ? 'ans' : 'an'}`;
  if (type === 'mois') return `${v} mois`;
  if (type === 'mois_jours') return `${v} mois ${j} jour${Number(j) > 1 ? 's' : ''}`;
  if (type === 'jours') return `${v} jour${Number(v) > 1 ? 's' : ''}`;
  return value;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} Ar`;
}

function getLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../public/Logo.png'),
    path.join(__dirname, '../dist/Logo.png'),
  ];

  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!logoPath) return '';

  const bytes = fs.readFileSync(logoPath);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function buildReceiptHtml(record) {
  const treatments = Array.isArray(record.treatments) ? record.treatments : [];
  const logoDataUri = getLogoDataUri();
  const logoHtml = logoDataUri
    ? `<img class="receipt-logo" src="${logoDataUri}" alt="Logo du centre médical" />`
    : '';
  const rows = treatments.length
    ? treatments.map((t) => {
        const total = Number(t.total) || Number(t.unit_price || 0) * Number(t.quantity || 0);
        return `
          <tr>
            <td>${escapeHtml(t.name)}</td>
            <td class="num">${escapeHtml(formatMoney(t.unit_price))}</td>
            <td class="num">${escapeHtml(formatMoney(total))}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td>${escapeHtml(record.traitement || 'Traitement')}</td>
        <td class="num">${escapeHtml(formatMoney(record.cost))}</td>
        <td class="num">${escapeHtml(formatMoney(record.cost))}</td>
      </tr>
    `;

  const date = record.created_at ? formatMadagascarDateTime(record.created_at).slice(0, 10) : formatMadagascarDateTime(new Date()).slice(0, 10);

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Facture</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #16323d; margin: 0; padding: 28px; background: #f4f8f9; }
        .receipt { background: #ffffff; border: 1px solid #c8d9df; border-top: 6px solid #1c96a4; border-radius: 4px; padding: 30px; }
        .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #c8d9df; padding-bottom: 22px; margin-bottom: 26px; }
        .identity { display: flex; align-items: center; gap: 16px; }
        .receipt-logo { width: 140px; max-height: 76px; object-fit: contain; }
        h1 { margin: 0; font-size: 32px; color: #0d7280; letter-spacing: .08em; text-transform: uppercase; }
        h2 { margin: 0 0 8px; font-size: 16px; color: #5f7b84; text-transform: uppercase; letter-spacing: .04em; }
        .badge { font-weight: 700; font-size: 18px; color: #16323d; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 28px; margin-bottom: 28px; padding: 18px; background: #f7fbfc; border-left: 4px solid #1c96a4; }
        .field { border-bottom: 1px solid #dbe8ec; padding-bottom: 9px; }
        .label { color: #5f7b84; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
        .value { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #dbe8ec; padding: 12px 10px; text-align: left; vertical-align: top; }
        th { border-top: 2px solid #1c96a4; background: #f0f8fa; color: #0d7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .num { text-align: right; }
        .total { margin: 24px 0 0 auto; padding: 14px 18px; width: 280px; border-top: 3px solid #1c96a4; background: #f0f8fa; text-align: right; font-size: 20px; font-weight: 800; color: #0d7280; }
        .note { margin-top: 28px; padding-top: 14px; border-top: 1px solid #dbe8ec; color: #5f7b84; font-size: 12px; }
        @page { margin: 16mm; }
      </style>
    </head>
    <body>
      <main class="receipt">
        <div class="top">
          <div class="identity">
            ${logoHtml}
            <div>
              <h1>Facture</h1>
            </div>
          </div>
        </div>

        <section class="grid">
          <div class="field"><div class="label">Patient</div><div class="value">${escapeHtml(record.patient_nom)} ${escapeHtml(record.patient_prenom)}</div></div>
          <div class="field"><div class="label">Date</div><div class="value">${escapeHtml(date)}</div></div>
          <div class="field"><div class="label">Sexe</div><div class="value">${escapeHtml(record.sexe || '-')}</div></div>
          <div class="field"><div class="label">Domicile</div><div class="value">${escapeHtml(record.domicile || '-')}</div></div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Désignation</th>
              <th class="num">Prix unitaire</th>
              <th class="num">Montant</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total">Total payé : ${escapeHtml(formatMoney(record.cost))}</div>
      </main>
    </body>
  </html>`;
}

module.exports = { buildReceiptHtml };
