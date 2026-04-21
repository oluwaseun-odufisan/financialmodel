import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const PRIMARY = '312783';
const ACCENT = '36A9E1';
const LIGHT_FILL = 'F5F7FA';
const BORDER = '#D9E2EC';
const TEXT = '#17202A';
const MUTED = '#667085';
const SURFACE = '#F8FAFC';

const PAGE_MARGINS = { top: 40, bottom: 46, left: 42, right: 42 };

const nfmt = (value, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? ''
    : Number(value).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const money = (value, digits = 0) => (value === null || value === undefined ? '-' : `NGN ${nfmt(value, digits)}`);
const moneyM = (value, digits = 1) => (value === null || value === undefined ? '-' : `NGN ${nfmt(value / 1e6, digits)}M`);
const pct = (value) => (value === null || value === undefined || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(2)}%`);
const mult = (value) => (value === null || value === undefined || !Number.isFinite(value) ? '-' : `${value.toFixed(2)}x`);
const dash = (value) => (value === null || value === undefined || value === '' ? '-' : String(value));

function pageWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function bodyBottom(doc) {
  return pageBottom(doc) - 24;
}

function newReportPage(doc, options = {}) {
  doc.addPage({
    size: 'A4',
    layout: options.layout || 'portrait',
    margins: PAGE_MARGINS,
  });
}

function drawPageChrome(doc, project, options = {}) {
  const width = pageWidth(doc);
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const bandHeight = 64;

  doc.save();
  doc.roundedRect(left, top, width, bandHeight, 14).fill(`#${PRIMARY}`);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(17).text(options.reportTitle || 'Flour Mills Finance Report', left + 18, top + 15);
  doc.fillColor('#D8E4F3').font('Helvetica').fontSize(9).text(project.projectName, left + 18, top + 36);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(options.sectionTitle || '', left + width - 190, top + 16, { width: 172, align: 'right' });
  doc.fillColor('#D8E4F3').font('Helvetica').fontSize(8.5).text(options.sectionSubtitle || '', left + width - 220, top + 34, { width: 202, align: 'right' });
  doc.restore();

  return top + bandHeight + 24;
}

function addFooter(doc, pageNumber, totalPages, options = {}) {
  const left = doc.page.margins.left;
  const y = doc.page.height - doc.page.margins.bottom - 10;
  const width = pageWidth(doc);
  const generatedLabel = options.generatedAt || `Generated on ${new Date().toLocaleString()}`;
  const brandLabel = options.brand || 'FundCo Capital Managers';
  const variant = options.variant || 'report';

  doc.save();
  doc.moveTo(left, y - 6).lineTo(left + width, y - 6).strokeColor(BORDER).lineWidth(1).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(8);
  if (variant === 'summary') {
    doc.text(`${generatedLabel}  |  ${brandLabel}`, left, y, { width, align: 'center', lineBreak: false });
    doc.restore();
    return;
  }

  doc.text(brandLabel, left, y, { width: 170, lineBreak: false });
  doc.text(generatedLabel, left, y, { width, align: 'center', lineBreak: false });
  if (options.showPageNumber !== false) {
    doc.text(`Page ${pageNumber} of ${totalPages}`, left, y, { width, align: 'right', lineBreak: false });
  }
  doc.restore();
}

function ensureSpace(doc, currentY, neededHeight, headerFactory) {
  if (currentY + neededHeight <= bodyBottom(doc)) return currentY;
  return headerFactory();
}

function createSectionFactory(doc, project, options = {}) {
  let firstPage = true;
  return () => {
    const shouldAddPage = firstPage ? options.startOnNewPage !== false : true;
    if (shouldAddPage) newReportPage(doc, { layout: options.layout || 'portrait' });
    firstPage = false;
    return drawPageChrome(doc, project, options);
  };
}

function drawSectionHeading(doc, y, title, description) {
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(13).text(title, doc.page.margins.left, y);
  y += 18;
  if (description) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(description, doc.page.margins.left, y, { width: pageWidth(doc) });
    y += 18;
  }
  return y;
}

function drawParagraph(doc, y, text, options = {}) {
  const height = doc.heightOfString(text, {
    width: options.width || pageWidth(doc),
    align: options.align || 'left',
  });
  doc.fillColor(options.color || MUTED).font(options.font || 'Helvetica').fontSize(options.size || 9.5).text(
    text,
    options.x || doc.page.margins.left,
    y,
    {
      width: options.width || pageWidth(doc),
      align: options.align || 'left',
    }
  );
  return y + height;
}

function drawMetricGrid(doc, y, items, headerFactory, options = {}) {
  const columns = options.columns || 3;
  const gap = 12;
  const width = pageWidth(doc);
  const boxWidth = (width - gap * (columns - 1)) / columns;
  const boxHeight = options.boxHeight || 68;
  const left = doc.page.margins.left;

  for (let index = 0; index < items.length; index += columns) {
    y = ensureSpace(doc, y, boxHeight + 10, headerFactory);
    const rowItems = items.slice(index, index + columns);

    rowItems.forEach((item, itemIndex) => {
      const x = left + itemIndex * (boxWidth + gap);
      doc.roundedRect(x, y, boxWidth, boxHeight, 12).fillAndStroke('#FFFFFF', BORDER);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(item.label.toUpperCase(), x + 12, y + 12, { width: boxWidth - 24 });
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(13).text(item.value, x + 12, y + 28, { width: boxWidth - 24 });
      if (item.note) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(item.note, x + 12, y + 46, { width: boxWidth - 24 });
      }
    });

    y += boxHeight + 10;
  }

  return y;
}

function drawTwoColumnSummary(doc, y, blocks, headerFactory) {
  const width = pageWidth(doc);
  const gap = 16;
  const columnWidth = (width - gap) / 2;
  const left = doc.page.margins.left;

  for (let index = 0; index < blocks.length; index += 2) {
    const rowBlocks = blocks.slice(index, index + 2);
    const heights = rowBlocks.map((block) => {
      let height = 52;
      block.rows.forEach((row) => {
        const leftHeight = doc.heightOfString(row.label, { width: columnWidth * 0.45 });
        const rightHeight = doc.heightOfString(row.value, { width: columnWidth * 0.45, align: 'right' });
        height += Math.max(leftHeight, rightHeight) + 10;
      });
      return height + 10;
    });

    const blockHeight = Math.max(...heights, 140);
    y = ensureSpace(doc, y, blockHeight + 12, headerFactory);

    rowBlocks.forEach((block, blockIndex) => {
      const x = left + blockIndex * (columnWidth + gap);
      let cursorY = y + 16;
      doc.roundedRect(x, y, columnWidth, blockHeight, 14).fillAndStroke(SURFACE, BORDER);
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text(block.title, x + 14, cursorY, { width: columnWidth - 28 });
      cursorY += 18;
      if (block.description) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(block.description, x + 14, cursorY, { width: columnWidth - 28 });
        cursorY += 20;
      }

      block.rows.forEach((row) => {
        const labelHeight = doc.heightOfString(row.label, { width: columnWidth * 0.45 });
        const valueHeight = doc.heightOfString(row.value, { width: columnWidth * 0.45, align: 'right' });
        const rowHeight = Math.max(labelHeight, valueHeight);
        doc.strokeColor(BORDER).moveTo(x + 14, cursorY - 4).lineTo(x + columnWidth - 14, cursorY - 4).stroke();
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(row.label, x + 14, cursorY + 2, { width: columnWidth * 0.45 });
        doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9).text(row.value, x + columnWidth * 0.5, cursorY + 2, { width: columnWidth * 0.42, align: 'right' });
        cursorY += rowHeight + 12;
      });
    });

    y += blockHeight + 12;
  }

  return y;
}

function columnWidth(column) {
  return column.width || column.minWidth || 80;
}

function buildColumnChunks(columns, availableWidth, freezeColumns = 1) {
  const frozen = columns.slice(0, freezeColumns);
  const frozenWidth = frozen.reduce((sum, column) => sum + columnWidth(column), 0);
  const remaining = columns.slice(freezeColumns);
  const chunks = [];
  let current = [...frozen];
  let currentWidth = frozenWidth;

  remaining.forEach((column) => {
    const width = columnWidth(column);
    const fits = currentWidth + width <= availableWidth || current.length === frozen.length;
    if (!fits) {
      chunks.push(current);
      current = [...frozen, column];
      currentWidth = frozenWidth + width;
    } else {
      current.push(column);
      currentWidth += width;
    }
  });

  if (current.length) chunks.push(current);
  return chunks;
}

function scaleColumns(columns, availableWidth) {
  const total = columns.reduce((sum, column) => sum + columnWidth(column), 0);
  if (total <= availableWidth) return columns.map((column) => ({ ...column, drawWidth: columnWidth(column) }));

  const scalable = columns.filter((column) => !column.fixed);
  const fixedWidth = columns.filter((column) => column.fixed).reduce((sum, column) => sum + columnWidth(column), 0);
  const scalableWidth = scalable.reduce((sum, column) => sum + columnWidth(column), 0);
  const target = Math.max(availableWidth - fixedWidth, 0);
  const ratio = scalableWidth > 0 ? target / scalableWidth : 1;

  return columns.map((column) => {
    const preferred = columnWidth(column);
    if (column.fixed) return { ...column, drawWidth: preferred };
    return { ...column, drawWidth: Math.max(column.minWidth || 48, preferred * ratio) };
  });
}

function drawTableBlock(doc, startY, columns, rows, headerFactory, options = {}) {
  const left = doc.page.margins.left;
  const cellPaddingX = 6;
  const cellPaddingY = 6;
  let y = startY;

  const drawHeader = () => {
    let x = left;
    const headerHeight = Math.max(
      24,
      ...columns.map((column) => doc.heightOfString(column.label, { width: column.drawWidth - cellPaddingX * 2, align: column.align || 'left' }) + cellPaddingY * 2)
    );
    columns.forEach((column) => {
      doc.rect(x, y, column.drawWidth, headerHeight).fillAndStroke(`#${PRIMARY}`, `#${PRIMARY}`);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(column.label, x + cellPaddingX, y + cellPaddingY, {
        width: column.drawWidth - cellPaddingX * 2,
        align: column.align || 'left',
      });
      x += column.drawWidth;
    });
    y += headerHeight;
  };

  y = ensureSpace(doc, y, 32, headerFactory);
  drawHeader();

  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(
      options.minRowHeight || 22,
      ...columns.map((column, index) =>
        doc.heightOfString(dash(row[index]), {
          width: column.drawWidth - cellPaddingX * 2,
          align: column.align || 'left',
        }) + cellPaddingY * 2
      )
    );

    y = ensureSpace(doc, y, rowHeight, () => {
      const nextY = headerFactory();
      y = nextY;
      drawHeader();
      return y;
    });

    let x = left;
    columns.forEach((column, index) => {
      const fill = rowIndex % 2 === 0 ? '#FFFFFF' : SURFACE;
      doc.rect(x, y, column.drawWidth, rowHeight).fillAndStroke(fill, BORDER);
      doc.fillColor(TEXT).font(column.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(
        dash(row[index]),
        x + cellPaddingX,
        y + cellPaddingY,
        {
          width: column.drawWidth - cellPaddingX * 2,
          align: column.align || 'left',
        }
      );
      x += column.drawWidth;
    });

    y += rowHeight;
  });

  return y + 12;
}

function drawAdaptiveTable(doc, y, columns, rows, headerFactory, options = {}) {
  const availableWidth = pageWidth(doc);
  const freezeColumns = options.freezeColumns ?? 1;
  const chunks = buildColumnChunks(columns, availableWidth, freezeColumns);
  let cursorY = y;

  chunks.forEach((chunk, chunkIndex) => {
    if (chunks.length > 1) {
      cursorY = ensureSpace(doc, cursorY, 28, headerFactory);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(
        `${options.chunkLabel || 'Table segment'} ${chunkIndex + 1} of ${chunks.length}`,
        doc.page.margins.left,
        cursorY
      );
      cursorY += 14;
    }

    const scaledChunk = scaleColumns(chunk, availableWidth);
    const rowSlice = rows.map((row) => {
      const indices = chunk.map((column) => columns.indexOf(column));
      return indices.map((index) => row[index]);
    });

    cursorY = drawTableBlock(doc, cursorY, scaledChunk, rowSlice, headerFactory, options);
  });

  return cursorY;
}

function drawCoverPage(doc, project, options = {}) {
  newReportPage(doc, { layout: 'portrait' });
  const left = doc.page.margins.left;
  const top = 82;
  const width = pageWidth(doc);

  doc.save();
  doc.roundedRect(left, top, width, 118, 18).fill(`#${PRIMARY}`);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('Flour Mills Finance Report', left + 24, top + 24);
  doc.font('Helvetica').fontSize(11).fillColor('#D8E4F3').text(options.coverSubtitle || 'Formal project report pack for internal and external circulation.', left + 24, top + 58, { width: width - 48 });
  doc.restore();

  let y = top + 154;
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(18).text(project.projectName, left, y, { width });
  y += 34;

  const metadata = [
    ['Export Scope', options.scope === 'summary' ? 'Deal Summary' : 'Full Report Pack'],
    ['Prepared For', 'Formal organizational submission'],
    ['Exported By', options.exportedBy || 'System user'],
    ['Generated On', new Date().toLocaleString()],
    ['Last Model Run', project.lastRunAt ? new Date(project.lastRunAt).toLocaleString() : 'Not yet run'],
  ];

  metadata.forEach(([label, value]) => {
    doc.strokeColor(BORDER).moveTo(left, y - 4).lineTo(left + width, y - 4).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(label.toUpperCase(), left, y + 4, { width: 140 });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(10).text(value, left + 150, y + 4, { width: width - 150 });
    y += 26;
  });

  y += 14;
  doc.roundedRect(left, y, width, 94, 14).fillAndStroke(SURFACE, BORDER);
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Report Standard', left + 18, y + 18);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(
    'This export is arranged as a fixed-page report pack with section-aware page orientation, repeated table headers, controlled margins, and wide-table splitting for formal readability.',
    left + 18,
    y + 38,
    { width: width - 36, lineGap: 2 }
  );
}

function drawSummaryFooter(doc, generatedAt) {
  addFooter(doc, 1, 1, {
    showPageNumber: false,
    generatedAt: `Generated on ${generatedAt}`,
    brand: 'FundCo Capital Managers',
    variant: 'summary',
  });
}

function drawKeyValueList(doc, x, y, width, rows) {
  let cursorY = y;
  rows.forEach(([label, value]) => {
    doc.strokeColor(BORDER).moveTo(x, cursorY - 4).lineTo(x + width, cursorY - 4).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label.toUpperCase(), x, cursorY + 3, { width: width * 0.42 });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9).text(value, x + width * 0.45, cursorY + 3, { width: width * 0.55, align: 'right' });
    cursorY += 22;
  });
  return cursorY;
}

function drawCompactTable(doc, x, y, width, columns, rows) {
  const headerHeight = 22;
  const rowHeight = 20;
  let cursorX = x;
  columns.forEach((column) => {
    const drawWidth = width * column.ratio;
    doc.rect(cursorX, y, drawWidth, headerHeight).fillAndStroke(`#${PRIMARY}`, `#${PRIMARY}`);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(column.label, cursorX + 6, y + 7, {
      width: drawWidth - 12,
      align: column.align || 'left',
    });
    cursorX += drawWidth;
  });

  let cursorY = y + headerHeight;
  rows.forEach((row, rowIndex) => {
    cursorX = x;
    columns.forEach((column, index) => {
      const drawWidth = width * column.ratio;
      doc.rect(cursorX, cursorY, drawWidth, rowHeight).fillAndStroke(rowIndex % 2 === 0 ? '#FFFFFF' : SURFACE, BORDER);
      doc.fillColor(TEXT).font('Helvetica').fontSize(8).text(dash(row[index]), cursorX + 6, cursorY + 6, {
        width: drawWidth - 12,
        align: column.align || 'left',
      });
      cursorX += drawWidth;
    });
    cursorY += rowHeight;
  });

  return cursorY;
}

function buildSummaryPdf(doc, project, options) {
  const result = project.result;
  const generatedAt = new Date().toLocaleString();
  const left = PAGE_MARGINS.left;
  const top = PAGE_MARGINS.top;
  const width = 595.28 - PAGE_MARGINS.left - PAGE_MARGINS.right;

  newReportPage(doc, { layout: 'portrait' });

  doc.save();
  doc.roundedRect(left, top, width, 74, 14).fill(`#${PRIMARY}`);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(19).text('Deal Summary', left + 18, top + 18);
  doc.fillColor('#D8E4F3').font('Helvetica').fontSize(10).text(project.projectName, left + 18, top + 42);
  doc.restore();

  let y = top + 98;
  const metricWidth = (width - 24) / 2;
  const metrics = [
    ['Total Capex', money(result.kpis.totalCapex)],
    ['Target Tariff', `NGN ${nfmt(result.kpis.targetTariff, 2)} / kWh`],
    ['Project IRR', pct(result.kpis.projectIRR)],
    ['Equity IRR', pct(result.kpis.equityIRR)],
    ['Average DSCR', mult(result.kpis.avgDSCR)],
    ['Payback Year', dash(result.kpis.paybackYear)],
  ];

  for (let index = 0; index < metrics.length; index += 2) {
    const row = metrics.slice(index, index + 2);
    row.forEach((item, itemIndex) => {
      const x = left + itemIndex * (metricWidth + 24);
      doc.roundedRect(x, y, metricWidth, 54, 10).fillAndStroke('#FFFFFF', BORDER);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(item[0].toUpperCase(), x + 12, y + 11, { width: metricWidth - 24 });
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(12).text(item[1], x + 12, y + 28, { width: metricWidth - 24 });
    });
    y += 66;
  }

  const panelTop = y + 4;
  const panelWidth = (width - 18) / 2;
  doc.roundedRect(left, panelTop, panelWidth, 154, 12).fillAndStroke(SURFACE, BORDER);
  doc.roundedRect(left + panelWidth + 18, panelTop, panelWidth, 154, 12).fillAndStroke(SURFACE, BORDER);

  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Project Overview', left + 14, panelTop + 14);
  drawKeyValueList(doc, left + 14, panelTop + 38, panelWidth - 28, [
    ['Project Name', project.projectName],
    ['System Capacity', `${nfmt(result.kpis.systemCapacityKWp)} kWp`],
    ['Battery Capacity', `${nfmt(result.kpis.batteryCapacityKWh)} kWh`],
    ['Inverter Capacity', `${nfmt(result.kpis.inverterCapacityKW)} kW`],
    ['Break-even Tariff', `NGN ${nfmt(result.kpis.breakevenTariff, 2)} / kWh`],
  ]);

  const rightX = left + panelWidth + 18;
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Document Control', rightX + 14, panelTop + 14);
  drawKeyValueList(doc, rightX + 14, panelTop + 38, panelWidth - 28, [
    ['Template', project.template === 'blank' ? 'Blank model' : 'Flour Mills preset'],
    ['Last Model Run', project.lastRunAt ? new Date(project.lastRunAt).toLocaleString() : 'Not yet run'],
    ['Exported By', options.exportedBy || 'System user'],
    ['Prepared For', 'Formal organizational submission'],
    ['Report Scope', 'Deal Summary'],
  ]);

  y = panelTop + 176;
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Scenario Comparison', left, y);
  y += 16;

  const scenarioRows = (result.sensitivity || []).slice(0, 5).map((scenario) => [
    scenario.scenario,
    pct(scenario.projectIRR),
    pct(scenario.equityIRR),
    mult(scenario.avgDSCR),
    dash(scenario.paybackYear),
  ]);

  drawCompactTable(doc, left, y, width, [
    { label: 'Scenario', ratio: 0.34 },
    { label: 'Project IRR', ratio: 0.16, align: 'right' },
    { label: 'Equity IRR', ratio: 0.16, align: 'right' },
    { label: 'Avg DSCR', ratio: 0.16, align: 'right' },
    { label: 'Payback', ratio: 0.18, align: 'right' },
  ], scenarioRows);

  drawSummaryFooter(doc, generatedAt);
}

function buildFullPdf(doc, project, options) {
  const result = project.result;
  const assumptions = project.assumption || {};
  const financials = result.financials;
  const depreciation = result.depreciation;

  drawCoverPage(doc, project, {
    scope: 'full',
    exportedBy: options.exportedBy,
    coverSubtitle: 'Comprehensive report pack including assumptions, schedules, statements, and monthly extracts.',
  });

  const portraitHeader = createSectionFactory(doc, project, {
    reportTitle: 'Flour Mills Finance Report',
    sectionTitle: 'Full Report Pack',
    sectionSubtitle: 'Executive and schedule detail',
    layout: 'portrait',
  });

  let y = portraitHeader();
  y = drawSectionHeading(doc, y, 'Executive Summary', 'Headline project economics and coverage metrics.');
  y = drawMetricGrid(
    doc,
    y,
    [
      { label: 'Total Capex', value: money(result.kpis.totalCapex), note: 'Modeled total project investment' },
      { label: 'Target Tariff', value: `NGN ${nfmt(result.kpis.targetTariff, 2)} / kWh`, note: 'Commercial tariff assumption' },
      { label: 'Break-even Tariff', value: `NGN ${nfmt(result.kpis.breakevenTariff, 2)} / kWh`, note: 'Cost recovery level' },
      { label: 'Project IRR', value: pct(result.kpis.projectIRR), note: 'Unlevered return' },
      { label: 'Equity IRR', value: pct(result.kpis.equityIRR), note: 'Levered return' },
      { label: 'Average DSCR', value: mult(result.kpis.avgDSCR), note: 'Average annual coverage' },
      { label: 'Minimum DSCR', value: mult(result.kpis.minDSCR), note: 'Lowest annual coverage' },
      { label: 'Project NPV', value: money(result.kpis.projectNPV), note: 'Net present value' },
      { label: 'Payback Year', value: dash(result.kpis.paybackYear), note: 'First positive cumulative year' },
    ],
    portraitHeader,
    { columns: 3 }
  );

  y = drawSectionHeading(doc, y + 4, 'Deal Context', 'Reference information for formal review and document control.');
  y = drawTwoColumnSummary(
    doc,
    y,
    [
      {
        title: 'Project Context',
        description: 'Operating and equipment position.',
        rows: [
          { label: 'Project Name', value: project.projectName },
          { label: 'Location', value: assumptions.location?.siteName || assumptions.location?.state || 'Not specified' },
          { label: 'System Capacity', value: `${nfmt(result.kpis.systemCapacityKWp)} kWp` },
          { label: 'Battery Capacity', value: `${nfmt(result.kpis.batteryCapacityKWh)} kWh` },
          { label: 'Inverter Capacity', value: `${nfmt(result.kpis.inverterCapacityKW)} kW` },
        ],
      },
      {
        title: 'Document Control',
        description: 'Export traceability and model accountability.',
        rows: [
          { label: 'Template', value: project.template === 'blank' ? 'Blank model' : 'Flour Mills preset' },
          { label: 'Last Model Run', value: project.lastRunAt ? new Date(project.lastRunAt).toLocaleString() : 'Not yet run' },
          { label: 'Exported By', value: options.exportedBy || 'System user' },
          { label: 'Debt Ratio', value: `${nfmt((result.kpis.debtEquityRatio || 0) * 100, 0)}%` },
          { label: 'Equity Ratio', value: `${nfmt((1 - (result.kpis.debtEquityRatio || 0)) * 100, 0)}%` },
        ],
      },
    ],
    portraitHeader
  );

  y = drawSectionHeading(doc, y + 2, 'Assumptions Snapshot', 'Selected assumptions carried into the current model run.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Parameter', width: 220, minWidth: 180, fixed: true },
      { label: 'Value', width: 278, minWidth: 220 },
    ],
    [
      ['Project Name', assumptions.projectName || project.projectName],
      ['Location', assumptions.location?.siteName || assumptions.location?.state || 'Not specified'],
      ['System Capacity', `${nfmt(result.kpis.systemCapacityKWp)} kWp`],
      ['Battery Capacity', `${nfmt(result.kpis.batteryCapacityKWh)} kWh`],
      ['Inverter Capacity', `${nfmt(result.kpis.inverterCapacityKW)} kW`],
      ['Debt Ratio', `${nfmt((result.kpis.debtEquityRatio || 0) * 100, 0)}%`],
      ['Equity Ratio', `${nfmt((1 - (result.kpis.debtEquityRatio || 0)) * 100, 0)}%`],
    ],
    portraitHeader,
    { freezeColumns: 1 }
  );

  y = drawSectionHeading(doc, y + 2, 'BOQ Summary', 'Capital allocation by category, including modeled adders.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Category', width: 270, minWidth: 200, fixed: true },
      { label: 'Cost (NGN)', width: 140, minWidth: 120, align: 'right' },
      { label: 'Cost (NGN Millions)', width: 140, minWidth: 120, align: 'right' },
    ],
    [
      ...Object.entries(assumptions.boq || {}).map(([key, value]) => [key, nfmt(value), nfmt(value / 1e6, 1)]),
      ['Sub-total', nfmt(result.capex.subTotal), nfmt(result.capex.subTotal / 1e6, 1)],
      ['VAT', nfmt(result.capex.vat), nfmt(result.capex.vat / 1e6, 1)],
      ['Contingency', nfmt(result.capex.contingency), nfmt(result.capex.contingency / 1e6, 1)],
      ['Management', nfmt(result.capex.management), nfmt(result.capex.management / 1e6, 1)],
      ['Total Capex', nfmt(result.capex.totalCapex), nfmt(result.capex.totalCapex / 1e6, 1)],
    ],
    portraitHeader,
    { freezeColumns: 1 }
  );

  const landscapeHeader = createSectionFactory(doc, project, {
    reportTitle: 'Flour Mills Finance Report',
    sectionTitle: 'Statements and Schedules',
    sectionSubtitle: 'Wide-table pack',
    layout: 'landscape',
  });

  y = landscapeHeader();
  y = drawSectionHeading(doc, y, 'Sensitivity Analysis', 'Scenario comparison formatted on landscape pages to preserve readability.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Scenario', width: 158, minWidth: 130, fixed: true },
      { label: 'Target Tariff', width: 90, minWidth: 74, align: 'right' },
      { label: 'Project IRR', width: 90, minWidth: 74, align: 'right' },
      { label: 'Equity IRR', width: 90, minWidth: 74, align: 'right' },
      { label: 'Project NPV', width: 108, minWidth: 86, align: 'right' },
      { label: 'Avg DSCR', width: 82, minWidth: 66, align: 'right' },
      { label: 'Min DSCR', width: 82, minWidth: 66, align: 'right' },
      { label: 'Payback', width: 72, minWidth: 58, align: 'right' },
    ],
    (result.sensitivity || []).map((scenario) => [
      scenario.scenario,
      nfmt(scenario.targetTariff, 2),
      pct(scenario.projectIRR),
      pct(scenario.equityIRR),
      nfmt(scenario.projectNPV),
      mult(scenario.avgDSCR),
      mult(scenario.minDSCR),
      dash(scenario.paybackYear),
    ]),
    landscapeHeader,
    { freezeColumns: 1 }
  );

  y = drawSectionHeading(doc, y + 2, 'Income Statement (NGN Millions)', 'Year-by-year statement outputs from the modeled annual roll-up.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Line Item', width: 180, minWidth: 146, fixed: true },
      ...financials.years.map((year) => ({ label: String(year), width: 62, minWidth: 56, align: 'right' })),
    ],
    [
      ['Revenue', ...financials.incomeStatement.revenue.map((value) => nfmt(value / 1e6, 1))],
      ['Opex', ...financials.incomeStatement.opex.map((value) => nfmt(value / 1e6, 1))],
      ['EBITDA', ...financials.incomeStatement.ebitda.map((value) => nfmt(value / 1e6, 1))],
      ['Depreciation', ...financials.incomeStatement.depreciation.map((value) => nfmt(value / 1e6, 1))],
      ['EBIT', ...financials.incomeStatement.ebit.map((value) => nfmt(value / 1e6, 1))],
      ['Interest Expense', ...financials.incomeStatement.interestExpense.map((value) => nfmt(value / 1e6, 1))],
      ['Profit Before Tax', ...financials.incomeStatement.profitBeforeTax.map((value) => nfmt(value / 1e6, 1))],
      ['Tax', ...financials.incomeStatement.tax.map((value) => nfmt(value / 1e6, 1))],
      ['Profit After Tax', ...financials.incomeStatement.profitAfterTax.map((value) => nfmt(value / 1e6, 1))],
    ],
    landscapeHeader,
    { freezeColumns: 1, chunkLabel: 'Income statement part' }
  );

  y = drawSectionHeading(doc, y + 2, 'DSCR Schedule', 'Coverage schedule with repeated headers across page breaks.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Year', width: 70, minWidth: 62, fixed: true },
      { label: 'EBITDA', width: 120, minWidth: 90, align: 'right' },
      { label: 'Debt Service', width: 120, minWidth: 90, align: 'right' },
      { label: 'DSCR', width: 84, minWidth: 70, align: 'right' },
      { label: 'Status', width: 110, minWidth: 84 },
    ],
    financials.years.map((year, index) => {
      const dscr = result.kpis.dscrByYear?.[index];
      return [
        year,
        nfmt(financials.incomeStatement.ebitda[index], 0),
        nfmt(-(financials.cashFlow.principalRepayments[index] + financials.cashFlow.interestPaid[index]), 0),
        mult(dscr),
        dscr === null || dscr === undefined ? '-' : dscr >= 1.4 ? 'Strong' : dscr >= 1.2 ? 'Adequate' : 'Breach',
      ];
    }),
    landscapeHeader,
    { freezeColumns: 1 }
  );

  y = drawSectionHeading(doc, y + 2, 'Depreciation Schedule (NGN Millions)', 'Wide depreciation schedules are kept readable through landscape layout and controlled splitting.');
  y = drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Year', width: 66, minWidth: 58, fixed: true },
      ...depreciation.categories.map((category) => ({ label: category.label, width: 88, minWidth: 74, align: 'right' })),
      { label: 'Total', width: 82, minWidth: 70, align: 'right' },
    ],
    depreciation.years.map((year, index) => {
      let total = 0;
      const values = depreciation.categories.map((category) => {
        const amount = depreciation.schedules[category.key].depreciation[index] || 0;
        total += amount;
        return nfmt(amount / 1e6, 1);
      });
      return [year, ...values, nfmt(total / 1e6, 1)];
    }),
    landscapeHeader,
    { freezeColumns: 1, chunkLabel: 'Depreciation table part' }
  );

  y = drawSectionHeading(doc, y + 2, 'Monthly Calculation Extract', 'Monthly periods are exported in repeated fixed-column segments so no values are cut off.');
  drawAdaptiveTable(
    doc,
    y,
    [
      { label: 'Month', width: 52, minWidth: 46, align: 'right', fixed: true },
      { label: 'Start', width: 82, minWidth: 72 },
      { label: 'End', width: 82, minWidth: 72 },
      { label: 'Phase', width: 70, minWidth: 64 },
      { label: 'Revenue', width: 88, minWidth: 78, align: 'right' },
      { label: 'Opex', width: 88, minWidth: 78, align: 'right' },
      { label: 'Capex', width: 88, minWidth: 78, align: 'right' },
      { label: 'Bridge Draw', width: 92, minWidth: 82, align: 'right' },
      { label: 'Senior Draw', width: 92, minWidth: 82, align: 'right' },
      { label: 'Equity Draw', width: 92, minWidth: 82, align: 'right' },
    ],
    result.timeline.map((period, index) => [
      period.counter,
      period.startDate.slice(0, 10),
      period.endDate.slice(0, 10),
      period.description,
      nfmt(result.monthly.rev.totalRevenue[index], 0),
      nfmt(result.monthly.cost.totalOperatingCost[index], 0),
      nfmt(result.monthly.capexMonthly.totalCapex[index], 0),
      nfmt(result.monthly.bridge.drawdown[index], 0),
      nfmt(result.monthly.senior.drawdown[index], 0),
      nfmt(result.monthly.equity.drawdown[index], 0),
    ]),
    landscapeHeader,
    { freezeColumns: 2, chunkLabel: 'Monthly schedule part', minRowHeight: 20 }
  );
}

export async function buildExcelWorkbook(project) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Flour Mills Financial System';
  workbook.created = new Date();
  const result = project.result;
  if (!result) throw new Error('Project has not been run yet.');
  const assumption = project.assumption;

  {
    const ws = workbook.addWorksheet('Deal Summary');
    ws.columns = [{ width: 38 }, { width: 24 }];
    const header = ws.addRow([project.projectName]);
    header.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    header.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    ws.mergeCells('A1:B1');
    header.height = 26;
    ws.addRow([]);

    [
      ['Total Capex (NGN)', nfmt(result.kpis.totalCapex)],
      ['Target Tariff (NGN/kWh)', nfmt(result.kpis.targetTariff, 2)],
      ['Break-even Tariff', nfmt(result.kpis.breakevenTariff, 2)],
      ['Project IRR', pct(result.kpis.projectIRR)],
      ['Equity IRR', pct(result.kpis.equityIRR)],
      ['NPV @ discount rate', nfmt(result.kpis.projectNPV)],
      ['Average DSCR', mult(result.kpis.avgDSCR)],
      ['Minimum DSCR', mult(result.kpis.minDSCR)],
      ['Payback Year', dash(result.kpis.paybackYear)],
      ['System PV Capacity (kWp)', nfmt(result.kpis.systemCapacityKWp)],
      ['Battery Capacity (kWh)', nfmt(result.kpis.batteryCapacityKWh)],
      ['Inverter Capacity (kW)', nfmt(result.kpis.inverterCapacityKW)],
      ['Debt : Equity', `${(result.kpis.debtEquityRatio * 100).toFixed(0)} : ${((1 - result.kpis.debtEquityRatio) * 100).toFixed(0)}`],
    ].forEach((rowData) => {
      const row = ws.addRow(rowData);
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_FILL}` } };
    });
  }

  {
    const ws = workbook.addWorksheet('Assumptions');
    ws.columns = [{ width: 36 }, { width: 20 }];
    const flatten = (obj, prefix = '') => {
      const out = [];
      for (const [key, value] of Object.entries(obj || {})) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...flatten(value, fullKey));
        else out.push([fullKey, typeof value === 'number' ? value : String(value)]);
      }
      return out;
    };
    const header = ws.addRow(['Parameter', 'Value']);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    });
    flatten(assumption).forEach((row) => ws.addRow(row));
  }

  {
    const ws = workbook.addWorksheet('BOQ');
    ws.columns = [{ width: 40 }, { width: 22 }];
    const header = ws.addRow(['Category', 'Cost (NGN)']);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    });
    Object.entries(assumption.boq || {}).forEach(([key, value]) => ws.addRow([key, nfmt(value)]));
    ws.addRow([]);
    ws.addRow(['Sub-total', nfmt(result.capex.subTotal)]).getCell(1).font = { bold: true };
    ws.addRow(['VAT', nfmt(result.capex.vat)]);
    ws.addRow(['Contingency', nfmt(result.capex.contingency)]);
    ws.addRow(['Management', nfmt(result.capex.management)]);
    const total = ws.addRow(['Total Capex', nfmt(result.capex.totalCapex)]);
    total.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_FILL}` } };
    });
  }

  {
    const ws = workbook.addWorksheet('M.Calculation');
    const m = result.monthly;
    const columns = [
      'Month', 'Start', 'End', 'Days', 'Phase',
      'Solar kWh', 'Commercial Energy', 'Anchor Tariff', 'Commercial Tariff',
      'Total Revenue', 'Diesel Cost', 'Gen O&M', 'Total Opex',
      'Capex', 'Bridge Draw', 'Bridge Int', 'Bridge Prin', 'Senior Draw', 'Senior Int', 'Senior Prin',
      'Equity Draw',
    ];
    ws.columns = columns.map((column, index) => ({ width: index === 0 ? 8 : index < 5 ? 12 : 16 }));
    const header = ws.addRow(columns);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    });
    for (let i = 0; i < result.timeline.length; i += 1) {
      const t = result.timeline[i];
      ws.addRow([
        t.counter,
        t.startDate.slice(0, 10),
        t.endDate.slice(0, 10),
        t.daysInPeriod,
        t.description,
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

  {
    const ws = workbook.addWorksheet('Depreciation');
    const d = result.depreciation;
    const header = ['Year', ...d.categories.map((category) => category.label), 'Total'];
    ws.columns = header.map(() => ({ width: 18 }));
    const row = ws.addRow(header);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    });
    for (let i = 0; i < d.years.length; i += 1) {
      const values = [d.years[i]];
      let total = 0;
      d.categories.forEach((category) => {
        const dep = d.schedules[category.key].depreciation[i];
        values.push(Math.round(dep));
        total += dep;
      });
      values.push(Math.round(total));
      ws.addRow(values);
    }
  }

  {
    const ws = workbook.addWorksheet('Financials');
    const f = result.financials;
    const header = ws.addRow(['', ...f.years]);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    });
    const add = (label, arr, bold = false) => {
      const row = ws.addRow([label, ...arr.map((value) => Math.round(value))]);
      if (bold) row.getCell(1).font = { bold: true };
    };
    ws.addRow(['Income Statement']).getCell(1).font = { bold: true, color: { argb: `FF${PRIMARY}` } };
    add('Revenue', f.incomeStatement.revenue);
    add('Opex', f.incomeStatement.opex);
    add('EBITDA', f.incomeStatement.ebitda, true);
    add('Depreciation', f.incomeStatement.depreciation);
    add('EBIT', f.incomeStatement.ebit, true);
    add('Interest Expense', f.incomeStatement.interestExpense);
    add('PBT', f.incomeStatement.profitBeforeTax, true);
    add('Tax', f.incomeStatement.tax);
    add('PAT', f.incomeStatement.profitAfterTax, true);
    ws.addRow([]);
    ws.addRow(['Balance Sheet']).getCell(1).font = { bold: true, color: { argb: `FF${PRIMARY}` } };
    add('Net Non-Current Assets', f.balanceSheet.netNonCurrentAssets);
    add('Cash', f.balanceSheet.cash);
    add('Total Assets', f.balanceSheet.totalAssets, true);
    add('Senior Debt', f.balanceSheet.seniorDebt);
    add('Share Capital', f.balanceSheet.shareCapital);
    add('Retained Earnings', f.balanceSheet.retainedEarningsBS);
    add('Total Equity', f.balanceSheet.totalEquity, true);
    ws.addRow([]);
    ws.addRow(['Cash Flow Statement']).getCell(1).font = { bold: true, color: { argb: `FF${PRIMARY}` } };
    add('Cash from Ops', f.cashFlow.netCashFromOperations);
    add('Cash from Investing', f.cashFlow.netCashFromInvesting);
    add('Cash from Financing', f.cashFlow.netCashFromFinancing);
    add('Net Change', f.cashFlow.netChangeInCash, true);
    add('Ending Cash', f.cashFlow.endingCash, true);
  }

  {
    const ws = workbook.addWorksheet('KPIs');
    ws.columns = [{ width: 32 }, { width: 24 }];
    [
      ['Metric', 'Value'],
      ['Total Capex (NGN)', nfmt(result.kpis.totalCapex)],
      ['Target Tariff (NGN/kWh)', result.kpis.targetTariff],
      ['Break-even Tariff', nfmt(result.kpis.breakevenTariff, 2)],
      ['Project IRR', pct(result.kpis.projectIRR)],
      ['Equity IRR', pct(result.kpis.equityIRR)],
      ['Project NPV', nfmt(result.kpis.projectNPV)],
      ['Avg DSCR', mult(result.kpis.avgDSCR)],
      ['Min DSCR', mult(result.kpis.minDSCR)],
      ['Payback Year', dash(result.kpis.paybackYear)],
    ].forEach((rowData, index) => {
      const row = ws.addRow(rowData);
      if (index === 0) {
        row.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
        });
      }
    });
  }

  return workbook;
}

export function buildPdfStream(project, res, options = {}) {
  const result = project.result;
  if (!result) throw new Error('Project has not been run yet.');

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: 'A4',
    margin: 42,
    bufferPages: true,
  });
  doc.info = {
    Title: `${project.projectName || 'Project'} ${options.scope === 'summary' ? 'Deal Summary' : 'Full Report'}`,
    Author: 'FundCo Capital Managers',
    Subject: 'Financial model export',
    Creator: 'Flour Mills Financial System',
    Producer: 'Flour Mills Financial System',
    CreationDate: new Date(),
  };
  doc.pipe(res);

  if (options.scope === 'summary') buildSummaryPdf(doc, project, options);
  else buildFullPdf(doc, project, options);

  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const contentPageTotal = options.scope === 'summary' ? totalPages : Math.max(totalPages - 1, 0);
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    if (options.scope === 'summary') {
      continue;
    }
    if (index > range.start) {
      addFooter(doc, index - range.start, contentPageTotal, {
        generatedAt: `Generated on ${new Date().toLocaleString()}`,
        brand: 'FundCo Capital Managers',
      });
    }
  }

  doc.end();
}
