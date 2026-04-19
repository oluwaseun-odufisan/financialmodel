/* =============================================================================
 * Export service — generates downloadable .xlsx and .pdf from the model result.
 * =========================================================================== */
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const PRIMARY = '312783';
const ACCENT  = '36a9e1';

const nfmt = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '' : Number(v).toLocaleString(undefined, {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });

const pfmt = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '' : (v * 100).toFixed(2) + '%');

/* -------------------------------------------------------------------------- */
/*  Excel export                                                              */
/* -------------------------------------------------------------------------- */
export async function buildExcelWorkbook(project) {
  // ... (Excel code unchanged - no issues reported)
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Flour Mills Financial System';
  wb.created = new Date();
  const result = project.result;
  if (!result) throw new Error('Project has not been run yet.');
  const a = project.assumption;
  /* ---- Sheet 1: Deal Summary ---- */
  {
    const ws = wb.addWorksheet('Deal Summary');
    ws.columns = [{ width: 38 }, { width: 24 }];
    const header = ws.addRow([project.projectName]);
    header.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    header.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } };
    ws.mergeCells('A1:B1'); header.height = 26;
    ws.addRow([]);
    const rows = [
      ['Total Capex (NGN)',          nfmt(result.kpis.totalCapex)],
      ['Target Tariff (NGN/kWh)',    nfmt(result.kpis.targetTariff, 2)],
      ['Break-even Tariff',          nfmt(result.kpis.breakevenTariff, 2)],
      ['Project IRR',                pfmt(result.kpis.projectIRR)],
      ['Equity IRR',                 pfmt(result.kpis.equityIRR)],
      ['NPV @ discount rate',        nfmt(result.kpis.projectNPV)],
      ['Average DSCR',               result.kpis.avgDSCR ? result.kpis.avgDSCR.toFixed(2) + 'x' : 'N/A'],
      ['Minimum DSCR',               result.kpis.minDSCR ? result.kpis.minDSCR.toFixed(2) + 'x' : 'N/A'],
      ['Payback Year',               result.kpis.paybackYear || 'N/A'],
      ['System PV Capacity (kWp)',   nfmt(result.kpis.systemCapacityKWp)],
      ['Battery Capacity (kWh)',     nfmt(result.kpis.batteryCapacityKWh)],
      ['Inverter Capacity (kW)',     nfmt(result.kpis.inverterCapacityKW)],
      ['Debt : Equity',              `${(result.kpis.debtEquityRatio*100).toFixed(0)} : ${((1-result.kpis.debtEquityRatio)*100).toFixed(0)}`],
    ];
    rows.forEach(r => {
      const row = ws.addRow(r);
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
    });
  }
  /* ---- Sheet 2: Assumptions (flat key-value) ---- */
  {
    const ws = wb.addWorksheet('Assumptions');
    ws.columns = [{ width: 36 }, { width: 20 }];
    const flatten = (o, prefix = '') => {
      const out = [];
      for (const [k, v] of Object.entries(o || {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, key));
        else out.push([key, typeof v === 'number' ? v : String(v)]);
      }
      return out;
    };
    const head = ws.addRow(['Parameter', 'Value']);
    head.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    flatten(a).forEach(r => ws.addRow(r));
  }
  /* ---- Sheet 3: BOQ ---- */
  {
    const ws = wb.addWorksheet('BOQ');
    ws.columns = [{ width: 40 }, { width: 22 }];
    const h = ws.addRow(['Category', 'Cost (NGN)']);
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    const boq = a.boq || {};
    Object.entries(boq).forEach(([k, v]) => ws.addRow([k, nfmt(v)]));
    ws.addRow([]);
    const cap = result.capex;
    ws.addRow(['Sub-total', nfmt(cap.subTotal)]).getCell(1).font = { bold: true };
    ws.addRow(['VAT',       nfmt(cap.vat)]);
    ws.addRow(['Contingency', nfmt(cap.contingency)]);
    ws.addRow(['Management', nfmt(cap.management)]);
    const tot = ws.addRow(['Total Capex', nfmt(cap.totalCapex)]);
    tot.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; });
  }
  /* ---- Sheet 4: Monthly Calculation ---- */
  {
    const ws = wb.addWorksheet('M.Calculation');
    const m = result.monthly;
    const cols = ['Month', 'Start', 'End', 'Days', 'Phase',
      'Solar kWh', 'Commercial Energy', 'Anchor Tariff', 'Commercial Tariff',
      'Total Revenue', 'Diesel Cost', 'Gen O&M', 'Total Opex',
      'Capex', 'Bridge Draw', 'Bridge Int', 'Bridge Prin', 'Senior Draw', 'Senior Int', 'Senior Prin',
      'Equity Draw'];
    ws.columns = cols.map((c, i) => ({ width: i === 0 ? 8 : i < 5 ? 12 : 16 }));
    const h = ws.addRow(cols);
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    for (let i = 0; i < result.timeline.length; i++) {
      const t = result.timeline[i];
      ws.addRow([
        t.counter, t.startDate.slice(0, 10), t.endDate.slice(0, 10), t.daysInPeriod, t.description,
        Math.round(m.rev.solarEnergyKwh[i]),
        Math.round(m.rev.commercialEnergy[i]),
        Number(m.rev.anchorTariff[i].toFixed(2)),
        Number(m.rev.commercialTariff[i].toFixed(2)),
        Math.round(m.rev.totalRevenue[i]),
        Math.round(m.cost.dieselTotalCost[i]),
        Math.round(m.cost.generatorOMTotal[i]),
        Math.round(m.cost.totalOperatingCost[i]),
        Math.round(m.capexMonthly.totalCapex[i]),
        Math.round(m.bridge.drawdown[i]),
        Math.round(m.bridge.interestPayment[i]),
        Math.round(m.bridge.principalRepayment[i]),
        Math.round(m.senior.drawdown[i]),
        Math.round(m.senior.interestPayment[i]),
        Math.round(m.senior.principalRepayment[i]),
        Math.round(m.equity.drawdown[i]),
      ]);
    }
  }
  /* ---- Sheet 5: Depreciation ---- */
  {
    const ws = wb.addWorksheet('Depreciation');
    const d = result.depreciation;
    const header = ['Year', ...d.categories.map(c => c.label), 'Total'];
    ws.columns = header.map(() => ({ width: 18 }));
    const h = ws.addRow(header);
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    for (let i = 0; i < d.years.length; i++) {
      const row = [d.years[i]];
      let tot = 0;
      for (const c of d.categories) {
        const v = d.schedules[c.key].depreciation[i];
        row.push(Math.round(v));
        tot += v;
      }
      row.push(Math.round(tot));
      ws.addRow(row);
    }
  }
  /* ---- Sheet 6: Financials ---- */
  {
    const ws = wb.addWorksheet('Financials');
    const f = result.financials;
    const yearRow = ['', ...f.years];
    const header = ws.addRow(yearRow);
    header.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    const add = (label, arr, bold = false) => {
      const r = ws.addRow([label, ...arr.map(v => Math.round(v))]);
      if (bold) r.getCell(1).font = { bold: true };
    };
    ws.addRow(['Income Statement']).getCell(1).font = { bold: true, color: { argb: 'FF' + PRIMARY } };
    add('Revenue', f.incomeStatement.revenue);
    add('Opex',    f.incomeStatement.opex);
    add('EBITDA',  f.incomeStatement.ebitda, true);
    add('Depreciation', f.incomeStatement.depreciation);
    add('EBIT',    f.incomeStatement.ebit, true);
    add('Interest Expense', f.incomeStatement.interestExpense);
    add('PBT',     f.incomeStatement.profitBeforeTax, true);
    add('Tax',     f.incomeStatement.tax);
    add('PAT',     f.incomeStatement.profitAfterTax, true);
    ws.addRow([]);
    ws.addRow(['Balance Sheet']).getCell(1).font = { bold: true, color: { argb: 'FF' + PRIMARY } };
    add('Net Non-Current Assets', f.balanceSheet.netNonCurrentAssets);
    add('Cash', f.balanceSheet.cash);
    add('Total Assets', f.balanceSheet.totalAssets, true);
    add('Senior Debt', f.balanceSheet.seniorDebt);
    add('Share Capital', f.balanceSheet.shareCapital);
    add('Retained Earnings', f.balanceSheet.retainedEarningsBS);
    add('Total Equity', f.balanceSheet.totalEquity, true);
    ws.addRow([]);
    ws.addRow(['Cash Flow Statement']).getCell(1).font = { bold: true, color: { argb: 'FF' + PRIMARY } };
    add('Cash from Ops', f.cashFlow.netCashFromOperations);
    add('Cash from Investing', f.cashFlow.netCashFromInvesting);
    add('Cash from Financing', f.cashFlow.netCashFromFinancing);
    add('Net Change', f.cashFlow.netChangeInCash, true);
    add('Ending Cash', f.cashFlow.endingCash, true);
  }
  /* ---- Sheet 7: KPIs ---- */
  {
    const ws = wb.addWorksheet('KPIs');
    ws.columns = [{ width: 32 }, { width: 24 }];
    const rows = [
      ['Metric', 'Value'],
      ['Total Capex (NGN)',        nfmt(result.kpis.totalCapex)],
      ['Target Tariff (NGN/kWh)',  result.kpis.targetTariff],
      ['Break-even Tariff',        nfmt(result.kpis.breakevenTariff, 2)],
      ['Project IRR',              pfmt(result.kpis.projectIRR)],
      ['Equity IRR',               pfmt(result.kpis.equityIRR)],
      ['Project NPV',              nfmt(result.kpis.projectNPV)],
      ['Avg DSCR',                 result.kpis.avgDSCR?.toFixed(2)],
      ['Min DSCR',                 result.kpis.minDSCR?.toFixed(2)],
      ['Payback Year',             result.kpis.paybackYear || 'N/A'],
    ];
    rows.forEach((r, i) => {
      const row = ws.addRow(r);
      if (i === 0) row.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } }; });
    });
  }
  return wb;
}

/* -------------------------------------------------------------------------- */
/*  PDF export                                                                */
/* -------------------------------------------------------------------------- */
export function buildPdfStream(project, res) {
  const result = project.result;
  if (!result) throw new Error('Project has not been run yet.');

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill('#' + PRIMARY);
  doc.fillColor('#FFFFFF').fontSize(20).text('Project Finance Model', 48, 28, { continued: false });
  doc.fontSize(12).text(project.projectName, 48, 54);
  doc.fillColor('#111827').fontSize(10);

  let y = 110;

  const h2 = (text) => { 
    doc.fillColor('#' + PRIMARY).fontSize(14).text(text, 48, y); 
    y += 22; 
    doc.fillColor('#111827').fontSize(10); 
  };

  const kv = (k, v) => {
    doc.fillColor('#6b7280').text(k, 48, y, { width: 260 });
    doc.fillColor('#111827').text(String(v ?? '—'), 308, y, { width: 240 });
    y += 16;
  };

  h2('Executive Summary');
  kv('Total Capex (NGN)',    nfmt(result.kpis.totalCapex));
  kv('Target Tariff',        `${result.kpis.targetTariff} NGN/kWh`);
  kv('Break-even Tariff',    `${nfmt(result.kpis.breakevenTariff, 2)} NGN/kWh`);
  kv('Project IRR',          pfmt(result.kpis.projectIRR));
  kv('Equity IRR',           pfmt(result.kpis.equityIRR));
  kv('Avg DSCR',             result.kpis.avgDSCR?.toFixed(2) + 'x');
  kv('Min DSCR',             result.kpis.minDSCR?.toFixed(2) + 'x');
  kv('Payback Year',         result.kpis.paybackYear || 'N/A');
  y += 8;

  h2('Income Statement (NGN Millions)');
  const f = result.financials;
  doc.fontSize(9);
  const cols = ['Year', 'Revenue', 'EBITDA', 'EBIT', 'PAT'];
  const colW = [60, 100, 100, 100, 100];
  let x = 48;
  cols.forEach((c, i) => { 
    doc.fillColor('#FFFFFF').rect(x, y, colW[i], 18).fill('#' + PRIMARY);
    doc.fillColor('#FFFFFF').text(c, x + 6, y + 4, { width: colW[i] - 12 }); 
    x += colW[i]; 
  });
  y += 22;
  doc.fillColor('#111827');

  for (let i = 0; i < f.years.length; i++) {
    x = 48;
    if (y > doc.page.height - 60) { 
      doc.addPage(); 
      y = 60; 
    }
    const row = [
      f.years[i],
      (f.incomeStatement.revenue[i] / 1e6).toFixed(1),
      (f.incomeStatement.ebitda[i]  / 1e6).toFixed(1),
      (f.incomeStatement.ebit[i]    / 1e6).toFixed(1),
      (f.incomeStatement.profitAfterTax[i] / 1e6).toFixed(1),
    ];
    row.forEach((c, j) => { 
      doc.text(String(c), x + 6, y + 2, { width: colW[j] - 12 }); 
      x += colW[j]; 
    });
    y += 16;
  }

  y += 14;
  if (y > doc.page.height - 140) { 
    doc.addPage(); 
    y = 60; 
  }

  h2('Financing Structure');
  const dPct = (result.kpis.debtEquityRatio * 100).toFixed(0);
  const ePct = ((1 - result.kpis.debtEquityRatio) * 100).toFixed(0);
  kv('Senior Debt %',        `${dPct}%`);
  kv('Equity %',             `${ePct}%`);
  kv('Project NPV (NGN)',    nfmt(result.kpis.projectNPV));
  kv('Total Revenue (life)', nfmt(result.kpis.totalRevenueLifetime));
  kv('Total Opex (life)',    nfmt(-result.kpis.totalOpexLifetime));

  // === FIXED FOOTER ===
  // The original footer was placed at `doc.page.height - 30`, which is INSIDE the bottom margin (margin = 48).
  // pdfkit's text() automatically adds a new page when the starting Y is beyond `page.height - margins.bottom`.
  // This is why the footer was appearing on its own blank new page.
  //
  // Fix: Temporarily shrink the bottom margin for this final text call only.
  // This lets us keep the exact same visual position you wanted while preventing the unwanted page break.
  doc.page.margins.bottom = 0;   // allows drawing right to the edge for the footer only

  doc.fontSize(8).fillColor('#6b7280').text(
    `Generated ${new Date().toLocaleString()} — FundCo Financial System`,
    48, 
    doc.page.height - 30, 
    { 
      width: doc.page.width - 96, 
      align: 'center' 
    }
  );

  doc.end();
}