import JSZip from 'jszip';
import { generatePresentationNarrative } from './aiService.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;
const EMU = 9525;

export const PRESENTATION_PRESETS = [
  {
    id: 'fundco-classic',
    name: 'FundCo Classic',
    description: 'Formal finance presentation using FundCo purple, blue accents, and clear institutional layouts.',
    colors: { primary: '312783', accent: '36A9E1', gold: 'C99700', teal: '0F766E', plum: '6D28D9', dark: '111827', muted: '667085', bg: 'FFFFFF', panel: 'F5F7FA', line: 'D7DEE7', success: '047857', risk: 'B42318', palette: ['312783', '36A9E1', '0F766E', 'C99700', '6D28D9', '475569'] },
  },
  {
    id: 'boardroom-slate',
    name: 'Boardroom Slate',
    description: 'Executive board style with restrained slate tones and strong metric hierarchy.',
    colors: { primary: '1F2937', accent: '0F766E', gold: 'B7791F', teal: '0891B2', plum: '475569', dark: '111827', muted: '64748B', bg: 'FFFFFF', panel: 'F8FAFC', line: 'CBD5E1', success: '047857', risk: 'B42318', palette: ['1F2937', '0F766E', '0891B2', 'B7791F', '64748B', '334155'] },
  },
  {
    id: 'sovereign-clean',
    name: 'Sovereign Clean',
    description: 'Government and lender friendly layout with conservative blues and wide spacing.',
    colors: { primary: '1D4ED8', accent: '0EA5E9', gold: 'CA8A04', teal: '0F766E', plum: '4338CA', dark: '0F172A', muted: '64748B', bg: 'FFFFFF', panel: 'F1F5F9', line: 'CBD5E1', success: '166534', risk: 'B91C1C', palette: ['1D4ED8', '0EA5E9', '0F766E', 'CA8A04', '4338CA', '64748B'] },
  },
  {
    id: 'energy-modern',
    name: 'Energy Modern',
    description: 'Clean energy presentation style with green accents and practical technical framing.',
    colors: { primary: '14532D', accent: '22C55E', gold: 'A16207', teal: '0F766E', plum: '365314', dark: '102A1B', muted: '64748B', bg: 'FFFFFF', panel: 'F0FDF4', line: 'BBF7D0', success: '15803D', risk: 'C2410C', palette: ['14532D', '22C55E', '0F766E', 'A16207', '65A30D', '475569'] },
  },
  {
    id: 'capital-markets',
    name: 'Capital Markets',
    description: 'Investment banking style with navy base, gold accent, and dense but disciplined layouts.',
    colors: { primary: '0B1F3A', accent: 'B8860B', gold: 'D4AF37', teal: '155E75', plum: '4C1D95', dark: '0B1220', muted: '64748B', bg: 'FFFFFF', panel: 'F8FAFC', line: 'CBD5E1', success: '047857', risk: 'B42318', palette: ['0B1F3A', 'B8860B', '155E75', '4C1D95', '64748B', '92400E'] },
  },
];

function getPreset(id) {
  return PRESENTATION_PRESETS.find((preset) => preset.id === id) || PRESENTATION_PRESETS[0];
}

function paletteColor(ctx, index) {
  const palette = ctx.c.palette || [ctx.c.primary, ctx.c.accent, ctx.c.success, ctx.c.gold, ctx.c.teal, ctx.c.risk];
  return palette[index % palette.length] || ctx.c.primary;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function fmtNumber(value, decimals = 0) {
  if (!Number.isFinite(Number(value))) return '-';
  return Number(value).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return '-';
  return `NGN ${fmtNumber(Number(value) / 1e6, decimals)}M`;
}

function fmtPct(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${(Number(value) * 100).toFixed(decimals)}%`;
}

function fmtMultiple(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(decimals)}x`;
}

function pctValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) * 100 : 0;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanXmlText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u20a6/g, 'NGN')
    .replace(/[•–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

function clipText(value, maxChars = 120) {
  const text = cleanXmlText(value)
    .replace(/[\u2022\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ');
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 60 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

function normalizeSlide(slide = {}) {
  return {
    ...slide,
    title: clipText(slide.title, 74),
    subtitle: clipText(slide.subtitle, 118),
    narrative: clipText(slide.narrative, 260),
    bullets: Array.isArray(slide.bullets)
      ? slide.bullets.slice(0, 5).map((bullet) => clipText(bullet, 118)).filter(Boolean)
      : [],
  };
}

function x(px) {
  return Math.round(px * EMU);
}

function y(px) {
  return Math.round(px * EMU);
}

function getProjectData(project) {
  const result = project.result || {};
  const kpis = result.kpis || {};
  const financials = result.financials || {};
  const assumption = project.assumption || {};
  const years = financials.years || [];
  const income = financials.incomeStatement || {};
  const cash = financials.cashFlow || {};
  const sensitivity = result.sensitivity || [];

  return {
    projectName: project.projectName || assumption.projectName || 'Project Finance Model',
    lastRunAt: project.lastRunAt || result.computedAt || new Date().toISOString(),
    kpis,
    years,
    sensitivity,
    system: {
      capacity: kpis.systemCapacityKWp,
      battery: kpis.batteryCapacityKWh,
      inverter: kpis.inverterCapacityKW,
      location: assumption.location?.state || assumption.location?.site || '',
      tenor: assumption.financing?.tenorYears,
      debtEquity: `${fmtNumber((assumption.financing?.debtRatio || 0.9) * 100, 0)}:${fmtNumber((assumption.financing?.equityRatio || 0.1) * 100, 0)}`,
    },
    annual: years.map((year, index) => ({
      year,
      revenue: safeNumber(income.revenue?.[index]),
      ebitda: safeNumber(income.ebitda?.[index]),
      pat: safeNumber(income.profitAfterTax?.[index]),
      dscr: kpis.dscrByYear?.[index] ?? null,
      debtService: -(safeNumber(cash.principalRepayments?.[index]) + safeNumber(cash.interestPaid?.[index])),
      endingCash: safeNumber(cash.endingCash?.[index]),
    })),
  };
}

function defaultSlides(project, audience = 'Investment Committee') {
  const data = getProjectData(project);
  const { kpis } = data;
  const strongestScenario = [...data.sensitivity].sort((a, b) => safeNumber(b.projectIRR) - safeNumber(a.projectIRR))[0];
  const weakestScenario = [...data.sensitivity].sort((a, b) => safeNumber(a.projectIRR) - safeNumber(b.projectIRR))[0];

  return [
    {
      id: 'cover',
      type: 'cover',
      title: `${data.projectName} Finance Presentation`,
      subtitle: `${audience} review pack`,
      narrative: 'Prepared from the latest model run and structured for formal review.',
      bullets: [],
      required: true,
    },
    {
      id: 'agenda',
      type: 'agenda',
      title: 'Presentation Roadmap',
      subtitle: 'A decision-focused sequence from project context to recommendation.',
      narrative: 'The presentation moves from project overview and commercial economics to credit strength, sensitivity, risks, and decision points.',
      bullets: ['Project overview and technical scope', 'Commercial economics and model outputs', 'Debt service coverage and downside resilience', 'Sensitivity, risk allocation, and recommendation'],
    },
    {
      id: 'investment-thesis',
      type: 'thesis',
      title: 'Investment Thesis',
      subtitle: 'The model indicates a commercially attractive energy infrastructure case.',
      narrative: `The current case shows a project IRR of ${fmtPct(kpis.projectIRR, 1)}, equity IRR of ${fmtPct(kpis.equityIRR, 1)}, and average DSCR of ${fmtMultiple(kpis.avgDSCR)}. These outputs indicate a strong base case subject to final diligence on cost, tariff, commissioning, and collection assumptions.`,
      bullets: ['Strong modeled return profile under the current assumptions', 'Debt coverage remains above the benchmark on an average basis', 'Commercial tariff is the principal value driver', 'Sensitivity should focus on tariff, capex, operating cost, and commissioning risk'],
    },
    {
      id: 'project-snapshot',
      type: 'kpiSnapshot',
      title: 'Project Snapshot',
      subtitle: 'Core project parameters and headline outputs.',
      narrative: 'The snapshot consolidates the technical configuration, commercial tariff, investment cost, and bankability metrics needed for an executive review.',
      bullets: [],
    },
    {
      id: 'technical-scope',
      type: 'projectScope',
      title: 'Technical and Commercial Scope',
      subtitle: 'Installed capacity, storage configuration, and financing structure.',
      narrative: 'The project is structured as a solar and battery backed power solution with model outputs driven by installed capacity, usable generation, tariff assumptions, and the debt-equity profile.',
      bullets: [`System capacity: ${fmtNumber(kpis.systemCapacityKWp, 0)} kWp`, `Battery capacity: ${fmtNumber(kpis.batteryCapacityKWh, 0)} kWh`, `Inverter capacity: ${fmtNumber(kpis.inverterCapacityKW, 0)} kW`, `Debt-equity structure: ${data.system.debtEquity}`],
    },
    {
      id: 'economics',
      type: 'economics',
      title: 'Commercial Economics',
      subtitle: 'Return, value creation, tariff, and payback view.',
      narrative: `The modeled target tariff is NGN ${fmtNumber(kpis.targetTariff, 2)} per kWh versus a break-even tariff of NGN ${fmtNumber(kpis.breakevenTariff, 2)} per kWh. The spread supports the return profile and payback year of ${kpis.paybackYear || '-'}.`,
      bullets: ['Target tariff and break-even tariff should be reviewed against contract terms', 'NPV and IRR are sensitive to escalation, cost, and generation assumptions', 'Payback timing provides a practical management lens beyond IRR'],
    },
    {
      id: 'operating-profile',
      type: 'operatingProfile',
      title: 'Operating Performance Profile',
      subtitle: 'Revenue, EBITDA, and profit after tax across the forecast period.',
      narrative: 'The operating profile shows whether modeled revenue growth converts into earnings and net profitability over the projection period.',
      bullets: [],
    },
    {
      id: 'coverage',
      type: 'coverage',
      title: 'Debt Service Coverage',
      subtitle: 'Annual DSCR and debt service capacity.',
      narrative: `Average DSCR is ${fmtMultiple(kpis.avgDSCR)}, with minimum DSCR of ${fmtMultiple(kpis.minDSCR)}. This page should be used to assess covenant strength and downside debt capacity.`,
      bullets: ['Minimum DSCR is the most important lender-facing coverage metric', 'Years below management threshold should be reviewed against reserve and cure options', 'Coverage should be tested under tariff, generation, and cost downside scenarios'],
    },
    {
      id: 'sensitivity',
      type: 'sensitivity',
      title: 'Scenario and Sensitivity Review',
      subtitle: 'Base, upside, and downside cases from the model output.',
      narrative: `The sensitivity table compares modeled outcomes under alternate assumptions. The strongest case is ${strongestScenario?.scenario || '-'} and the weakest case is ${weakestScenario?.scenario || '-'} based on project IRR.`,
      bullets: [],
    },
    {
      id: 'risk',
      type: 'risks',
      title: 'Key Risks and Mitigants',
      subtitle: 'Issues requiring management attention before submission or approval.',
      narrative: 'The key diligence focus should remain on assumptions that directly affect tariff sustainability, cost control, commissioning, energy output, and debt service resilience.',
      bullets: ['Capex overrun: require firm supplier quotations, contingency, and procurement controls', 'Tariff pressure: validate customer affordability and contract indexation', 'Generation shortfall: verify irradiation, degradation, and availability assumptions', 'Debt coverage risk: maintain reserves and review downside covenant headroom'],
    },
    {
      id: 'recommendation',
      type: 'recommendation',
      title: 'Recommendation and Next Steps',
      subtitle: 'Decision path for management, lenders, or investment committee.',
      narrative: 'Based on the latest model run, the project can proceed to final diligence subject to validation of technical, commercial, financing, and contractual assumptions.',
      bullets: ['Approve the base case for detailed review', 'Validate capex, tariff, generation, and debt assumptions with supporting evidence', 'Run final downside cases before formal submission', 'Prepare lender or investment committee pack using the approved assumptions'],
    },
    {
      id: 'appendix',
      type: 'appendix',
      title: 'Appendix: Annual Financial Summary',
      subtitle: 'Selected yearly outputs from the model.',
      narrative: 'The appendix provides the forecast data behind the presentation charts and headline metrics.',
      bullets: [],
    },
  ];
}

function mergeAiSlides(baseSlides, aiSlides = []) {
  if (!Array.isArray(aiSlides)) return baseSlides;
  const byId = new Map(aiSlides.map((slide) => [slide.id, slide]));
  return baseSlides.map((slide) => {
    const ai = byId.get(slide.id);
    if (!ai) return slide;
    return {
      ...slide,
      title: clipText(ai.title || slide.title, 74),
      subtitle: clipText(ai.subtitle || slide.subtitle, 118),
      narrative: clipText(ai.narrative || slide.narrative, 260),
      bullets: Array.isArray(ai.bullets) && ai.bullets.length > 0 ? ai.bullets.slice(0, 5).map((bullet) => clipText(bullet, 118)) : slide.bullets,
    };
  });
}

export async function buildPresentationDraft(project, options = {}) {
  const audience = options.audience || 'Investment Committee';
  const preset = getPreset(options.presetId);
  const baseSlides = defaultSlides(project, audience);
  let slides = baseSlides;
  let aiAssisted = false;

  if (options.useAi !== false) {
    try {
      const aiResult = await generatePresentationNarrative({
        project,
        audience,
        slideOutline: baseSlides.map(({ id, type, title, subtitle, narrative, bullets }) => ({ id, type, title, subtitle, narrative, bullets })),
      });
      slides = mergeAiSlides(baseSlides, aiResult.slides);
      aiAssisted = true;
    } catch (error) {
      console.warn('[presentation/ai-draft-fallback]', error.message);
    }
  }

  return {
    preset,
    audience,
    aiAssisted,
    generatedAt: new Date().toISOString(),
    slides: slides.map(normalizeSlide),
  };
}

function xmlParagraph(text, style = {}) {
  const size = Math.round((style.size || 20) * 100);
  const color = style.color || '111827';
  const bold = style.bold ? ' b="1"' : '';
  const lineSpacing = style.lineSpacing ? `<a:lnSpc><a:spcPct val="${Math.round(style.lineSpacing * 1000)}"/></a:lnSpc>` : '';
  return `<a:p><a:pPr algn="${style.align || 'l'}">${lineSpacing}</a:pPr><a:r><a:rPr lang="en-US" sz="${size}"${bold}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${style.font || 'Aptos'}"/></a:rPr><a:t>${esc(cleanXmlText(text))}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`;
}

function textShape(id, name, left, top, width, height, text, style = {}) {
  const paragraphs = Array.isArray(text) ? text : String(text || '').split('\n');
  const autofit = style.autofit === false ? '' : '<a:normAutofit fontScale="85000" lnSpcReduction="20000"/>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x(left)}" y="${y(top)}"/><a:ext cx="${x(width)}" cy="${y(height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${style.anchor || 't'}" lIns="${x(style.insetX || 0)}" rIns="${x(style.insetX || 0)}" tIns="${y(style.insetY || 0)}" bIns="${y(style.insetY || 0)}">${autofit}</a:bodyPr><a:lstStyle/>${paragraphs.map((line) => xmlParagraph(line, style)).join('')}</p:txBody></p:sp>`;
}

function rectShape(id, name, left, top, width, height, fill, line = null, radius = false) {
  const lineXml = line ? `<a:ln w="${Math.round((line.width || 1) * 12700)}"><a:solidFill><a:srgbClr val="${line.color}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x(left)}" y="${y(top)}"/><a:ext cx="${x(width)}" cy="${y(height)}"/></a:xfrm><a:prstGeom prst="${radius ? 'roundRect' : 'rect'}"><a:avLst/></a:prstGeom>${fillXml}${lineXml}</p:spPr></p:sp>`;
}

function lineShape(id, name, x1, y1, x2, y2, color, width = 2) {
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (horizontal) {
    return rectShape(id, name, Math.min(x1, x2), Math.min(y1, y2) - width / 2, Math.max(Math.abs(x2 - x1), 1), width, color);
  }
  return rectShape(id, name, Math.min(x1, x2) - width / 2, Math.min(y1, y2), width, Math.max(Math.abs(y2 - y1), 1), color);
}

function metricCard(ctx, left, top, width, label, value, note = '') {
  const { c } = ctx;
  const id = ctx.nextId();
  return [
    rectShape(id, 'Metric card', left, top, width, 96, c.panel, { color: c.line, width: 1 }, true),
    textShape(ctx.nextId(), 'Metric label', left + 16, top + 13, width - 32, 22, clipText(label, 34), { size: 10, color: c.muted, bold: true }),
    textShape(ctx.nextId(), 'Metric value', left + 16, top + 37, width - 32, 32, clipText(value, 34), { size: 21, color: c.dark, bold: true }),
    textShape(ctx.nextId(), 'Metric note', left + 16, top + 69, width - 32, 18, clipText(note, 52), { size: 9, color: c.muted }),
  ].join('');
}

function bulletBlock(ctx, bullets, left, top, width, color = null) {
  return (bullets || []).slice(0, 5).map((bullet, index) => {
    const yPos = top + index * 44;
    return [
      rectShape(ctx.nextId(), 'Bullet marker', left, yPos + 8, 9, 9, color || ctx.c.accent, null, true),
      textShape(ctx.nextId(), 'Bullet text', left + 24, yPos, width - 24, 36, clipText(bullet, 118), { size: 15, color: ctx.c.dark, lineSpacing: 90 }),
    ].join('');
  }).join('');
}

function tableBlock(ctx, left, top, width, rows, columns) {
  const rowH = 34;
  const colW = columns.map((col) => col.width || width / columns.length);
  let xml = '';
  rows.forEach((row, r) => {
    let cursor = left;
    columns.forEach((col, ci) => {
      const fill = r === 0 ? ctx.c.primary : r % 2 === 0 ? ctx.c.panel : ctx.c.bg;
      const textColor = r === 0 ? 'FFFFFF' : ctx.c.dark;
      xml += rectShape(ctx.nextId(), 'Table cell', cursor, top + r * rowH, colW[ci], rowH, fill, { color: ctx.c.line, width: 0.75 });
      xml += textShape(ctx.nextId(), 'Table text', cursor + 8, top + r * rowH + 8, colW[ci] - 16, rowH - 10, clipText(row[col.key] ?? '', col.maxChars || 34), { size: r === 0 ? 9.5 : 10.5, color: textColor, bold: r === 0, align: col.align || 'l' });
      cursor += colW[ci];
    });
  });
  return xml;
}

function barChart(ctx, left, top, width, height, data, options = {}) {
  const chartData = data.slice(0, options.maxItems || 8);
  const values = chartData.map((d) => safeNumber(d.value));
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const chartTop = top + 24;
  const chartBottom = top + height - 46;
  const chartHeight = chartBottom - chartTop;
  const gap = 8;
  const barW = Math.max(14, (width - 48 - gap * (chartData.length - 1)) / Math.max(chartData.length, 1));
  let xml = rectShape(ctx.nextId(), 'Chart panel', left, top, width, height, ctx.c.panel, { color: ctx.c.line, width: 1 }, true);
  xml += textShape(ctx.nextId(), 'Chart title', left + 16, top + 10, width - 32, 24, clipText(options.title || '', 58), { size: 13, color: ctx.c.dark, bold: true });
  xml += lineShape(ctx.nextId(), 'Chart axis', left + 24, chartBottom, left + width - 16, chartBottom, ctx.c.line, 1);
  chartData.forEach((item, index) => {
    const value = safeNumber(item.value);
    const barH = Math.max(4, Math.abs(value) / max * (chartHeight - 10));
    const xPos = left + 24 + index * (barW + gap);
    const yPos = chartBottom - barH;
    xml += rectShape(ctx.nextId(), 'Chart bar', xPos, yPos, barW, barH, item.color || paletteColor(ctx, index), null, true);
    xml += textShape(ctx.nextId(), 'Chart value', xPos - 10, yPos - 20, barW + 20, 16, clipText(item.display || fmtNumber(value, 1), 14), { size: 8, color: ctx.c.muted, align: 'ctr' });
    xml += textShape(ctx.nextId(), 'Chart label', xPos - 12, chartBottom + 6, barW + 24, 30, clipText(item.label, 18), { size: 7.5, color: ctx.c.muted, align: 'ctr', lineSpacing: 85 });
  });
  return xml;
}

function addHeader(ctx, slide, index) {
  if (slide.type === 'cover') return '';
  return [
    textShape(ctx.nextId(), 'Header project', 58, 26, 530, 28, ctx.projectName, { size: 12, color: ctx.c.muted, bold: true }),
    textShape(ctx.nextId(), 'Header section', 930, 26, 290, 28, `Slide ${index + 1}`, { size: 11, color: ctx.c.muted, align: 'r' }),
    lineShape(ctx.nextId(), 'Header rule', 58, 60, 1220, 60, ctx.c.line, 1),
  ].join('');
}

function addTitle(ctx, slide) {
  return [
    textShape(ctx.nextId(), 'Slide title', 58, 78, 800, 48, clipText(slide.title, 74), { size: 26, color: ctx.c.dark, bold: true }),
    textShape(ctx.nextId(), 'Slide subtitle', 60, 126, 840, 44, clipText(slide.subtitle || slide.narrative || '', 118), { size: 13.5, color: ctx.c.muted, lineSpacing: 90 }),
  ].join('');
}

function addFooter(ctx) {
  return [
    lineShape(ctx.nextId(), 'Footer rule', 58, 672, 1220, 672, ctx.c.line, 0.75),
    textShape(ctx.nextId(), 'Footer generated', 58, 684, 420, 18, `Generated ${new Date().toLocaleDateString('en-GB')}`, { size: 9, color: ctx.c.muted }),
    textShape(ctx.nextId(), 'Footer brand', 880, 684, 340, 18, 'FundCo Capital Managers', { size: 9, color: ctx.c.muted, align: 'r' }),
  ].join('');
}

function slideBody(ctx, slide) {
  const data = ctx.data;
  const k = data.kpis;
  if (slide.type === 'cover') {
    return [
      rectShape(ctx.nextId(), 'Cover band', 0, 0, 450, 720, ctx.c.primary),
      rectShape(ctx.nextId(), 'Cover accent', 450, 0, 26, 720, ctx.c.accent),
      textShape(ctx.nextId(), 'Cover kicker', 62, 76, 320, 30, 'PROJECT FINANCE MODEL', { size: 13, color: 'FFFFFF', bold: true }),
      textShape(ctx.nextId(), 'Cover title', 62, 138, 340, 180, slide.title, { size: 33, color: 'FFFFFF', bold: true }),
      textShape(ctx.nextId(), 'Cover subtitle', 64, 332, 320, 62, slide.subtitle, { size: 17, color: 'FFFFFF' }),
      textShape(ctx.nextId(), 'Cover footer', 64, 632, 320, 30, 'FundCo Capital Managers', { size: 13, color: 'FFFFFF', bold: true }),
      metricCard(ctx, 545, 122, 290, 'Project IRR', fmtPct(k.projectIRR, 1), 'unlevered return'),
      metricCard(ctx, 875, 122, 290, 'Equity IRR', fmtPct(k.equityIRR, 1), 'sponsor return'),
      metricCard(ctx, 545, 256, 290, 'Total Capex', fmtCurrency(k.totalCapex, 1), 'investment cost'),
      metricCard(ctx, 875, 256, 290, 'Average DSCR', fmtMultiple(k.avgDSCR), 'coverage strength'),
      textShape(ctx.nextId(), 'Cover narrative', 545, 430, 620, 92, slide.narrative, { size: 18, color: ctx.c.dark }),
    ].join('');
  }

  if (slide.type === 'agenda' || slide.type === 'thesis' || slide.type === 'risks' || slide.type === 'recommendation') {
    return [
      addTitle(ctx, slide),
      rectShape(ctx.nextId(), 'Narrative panel', 58, 190, 500, 390, ctx.c.panel, { color: ctx.c.line, width: 1 }, true),
      textShape(ctx.nextId(), 'Narrative', 86, 220, 444, 120, slide.narrative, { size: 17, color: ctx.c.dark }),
      bulletBlock(ctx, slide.bullets, 86, 368, 430),
      rectShape(ctx.nextId(), 'Right accent panel', 620, 190, 560, 390, ctx.c.primary, null, true),
      rectShape(ctx.nextId(), 'Right accent strip', 620, 190, 18, 390, ctx.c.accent, null, true),
      rectShape(ctx.nextId(), 'Right gold rule', 660, 464, 150, 7, ctx.c.gold || ctx.c.accent, null, true),
      textShape(ctx.nextId(), 'Right big number', 660, 235, 250, 48, fmtPct(k.projectIRR, 1), { size: 36, color: 'FFFFFF', bold: true }),
      textShape(ctx.nextId(), 'Right big label', 665, 288, 280, 26, 'Project IRR', { size: 13, color: 'FFFFFF' }),
      textShape(ctx.nextId(), 'Right dscr', 660, 360, 230, 44, fmtMultiple(k.avgDSCR), { size: 31, color: 'FFFFFF', bold: true }),
      textShape(ctx.nextId(), 'Right dscr label', 665, 407, 280, 26, 'Average DSCR', { size: 13, color: 'FFFFFF' }),
      textShape(ctx.nextId(), 'Right note', 660, 494, 450, 48, `Target tariff NGN ${fmtNumber(k.targetTariff, 2)} / kWh`, { size: 18, color: 'FFFFFF' }),
    ].join('');
  }

  if (slide.type === 'kpiSnapshot') {
    return [
      addTitle(ctx, slide),
      metricCard(ctx, 58, 200, 250, 'Total Capex', fmtCurrency(k.totalCapex, 1), 'including modelled costs'),
      metricCard(ctx, 334, 200, 250, 'Target Tariff', `NGN ${fmtNumber(k.targetTariff, 2)}`, 'per kWh'),
      metricCard(ctx, 610, 200, 250, 'Project IRR', fmtPct(k.projectIRR, 1), 'unlevered'),
      metricCard(ctx, 886, 200, 250, 'Equity IRR', fmtPct(k.equityIRR, 1), 'levered'),
      metricCard(ctx, 58, 334, 250, 'Project NPV', fmtCurrency(k.projectNPV, 1), 'model output'),
      metricCard(ctx, 334, 334, 250, 'Average DSCR', fmtMultiple(k.avgDSCR), `minimum ${fmtMultiple(k.minDSCR)}`),
      metricCard(ctx, 610, 334, 250, 'Payback Year', String(k.paybackYear || '-'), 'first recovery year'),
      metricCard(ctx, 886, 334, 250, 'System Capacity', `${fmtNumber(k.systemCapacityKWp, 0)} kWp`, 'solar PV'),
      textShape(ctx.nextId(), 'Snapshot note', 60, 500, 1060, 52, slide.narrative, { size: 17, color: ctx.c.dark }),
    ].join('');
  }

  if (slide.type === 'projectScope' || slide.type === 'economics') {
    const chartData = [
      { label: 'Project IRR', value: pctValue(k.projectIRR), display: fmtPct(k.projectIRR, 1), color: paletteColor(ctx, 0) },
      { label: 'Equity IRR', value: pctValue(k.equityIRR), display: fmtPct(k.equityIRR, 1), color: paletteColor(ctx, 1) },
      { label: 'Avg DSCR', value: safeNumber(k.avgDSCR) * 30, display: fmtMultiple(k.avgDSCR), color: paletteColor(ctx, 2) },
      { label: 'Min DSCR', value: safeNumber(k.minDSCR) * 30, display: fmtMultiple(k.minDSCR), color: ctx.c.risk },
    ];
    return [
      addTitle(ctx, slide),
      rectShape(ctx.nextId(), 'Narrative panel', 58, 190, 430, 390, ctx.c.panel, { color: ctx.c.line, width: 1 }, true),
      textShape(ctx.nextId(), 'Narrative', 86, 218, 374, 84, slide.narrative, { size: 16, color: ctx.c.dark }),
      bulletBlock(ctx, slide.bullets, 86, 328, 360),
      barChart(ctx, 535, 190, 610, 390, chartData, { title: 'Return and coverage indicators' }),
    ].join('');
  }

  if (slide.type === 'operatingProfile') {
    const chartData = data.annual.slice(0, 10).map((row, index) => ({ label: String(row.year), value: row.ebitda / 1e6, display: fmtNumber(row.ebitda / 1e6, 0), color: paletteColor(ctx, index) }));
    const revenueRows = [{ year: 'Year', revenue: 'Revenue', ebitda: 'EBITDA', pat: 'PAT' }, ...data.annual.slice(0, 6).map((row) => ({ year: row.year, revenue: fmtCurrency(row.revenue, 0), ebitda: fmtCurrency(row.ebitda, 0), pat: fmtCurrency(row.pat, 0) }))];
    return [
      addTitle(ctx, slide),
      barChart(ctx, 58, 188, 620, 390, chartData, { title: 'EBITDA profile (NGN millions)' }),
      tableBlock(ctx, 720, 190, 470, revenueRows, [{ key: 'year', width: 78 }, { key: 'revenue', width: 130 }, { key: 'ebitda', width: 130 }, { key: 'pat', width: 132 }]),
    ].join('');
  }

  if (slide.type === 'coverage') {
    const chartData = data.annual.slice(0, 10).map((row) => ({ label: String(row.year), value: safeNumber(row.dscr), display: row.dscr == null ? '-' : fmtMultiple(row.dscr), color: safeNumber(row.dscr) >= 1.2 ? ctx.c.primary : ctx.c.risk }));
    return [
      addTitle(ctx, slide),
      barChart(ctx, 58, 188, 720, 390, chartData, { title: 'Annual DSCR' }),
      rectShape(ctx.nextId(), 'Coverage panel', 830, 188, 330, 390, ctx.c.panel, { color: ctx.c.line, width: 1 }, true),
      textShape(ctx.nextId(), 'Coverage title', 858, 222, 270, 26, 'Credit interpretation', { size: 18, color: ctx.c.dark, bold: true }),
      textShape(ctx.nextId(), 'Coverage note', 858, 262, 270, 90, slide.narrative, { size: 15, color: ctx.c.dark }),
      bulletBlock(ctx, slide.bullets, 858, 390, 250, ctx.c.risk),
    ].join('');
  }

  if (slide.type === 'sensitivity') {
    const rows = [{ scenario: 'Scenario', projectIRR: 'Project IRR', equityIRR: 'Equity IRR', avgDSCR: 'Avg DSCR', npv: 'Project NPV' }, ...data.sensitivity.slice(0, 8).map((row) => ({ scenario: row.scenario, projectIRR: fmtPct(row.projectIRR, 1), equityIRR: fmtPct(row.equityIRR, 1), avgDSCR: fmtMultiple(row.avgDSCR), npv: fmtCurrency(row.projectNPV, 0) }))];
    const chartData = data.sensitivity.slice(0, 6).map((row, index) => ({ label: row.scenario, value: pctValue(row.projectIRR), display: fmtPct(row.projectIRR, 1), color: paletteColor(ctx, index) }));
    return [
      addTitle(ctx, slide),
      tableBlock(ctx, 58, 188, 710, rows, [{ key: 'scenario', width: 210 }, { key: 'projectIRR', width: 120 }, { key: 'equityIRR', width: 120 }, { key: 'avgDSCR', width: 110 }, { key: 'npv', width: 150 }]),
      barChart(ctx, 815, 188, 360, 390, chartData, { title: 'Project IRR by scenario' }),
    ].join('');
  }

  if (slide.type === 'appendix') {
    const rows = [{ year: 'Year', revenue: 'Revenue', ebitda: 'EBITDA', dscr: 'DSCR', cash: 'Ending Cash' }, ...data.annual.slice(0, 10).map((row) => ({ year: row.year, revenue: fmtCurrency(row.revenue, 0), ebitda: fmtCurrency(row.ebitda, 0), dscr: row.dscr == null ? '-' : fmtMultiple(row.dscr), cash: fmtCurrency(row.endingCash, 0) }))];
    return [
      addTitle(ctx, slide),
      tableBlock(ctx, 58, 188, 1090, rows, [{ key: 'year', width: 110 }, { key: 'revenue', width: 245 }, { key: 'ebitda', width: 245 }, { key: 'dscr', width: 170 }, { key: 'cash', width: 320 }]),
    ].join('');
  }

  return [
    addTitle(ctx, slide),
    textShape(ctx.nextId(), 'Narrative', 70, 210, 1060, 100, slide.narrative, { size: 18, color: ctx.c.dark }),
    bulletBlock(ctx, slide.bullets, 86, 350, 900),
  ].join('');
}

function buildSlideXml(project, slide, index, preset) {
  let id = 10;
  const ctx = {
    c: preset.colors,
    data: getProjectData(project),
    projectName: project.projectName,
    nextId: () => id++,
  };
  const shapes = [addHeader(ctx, slide, index), slideBody(ctx, slide), addFooter(ctx)].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${preset.colors.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function contentTypes(slideCount) {
  const slides = Array.from({ length: slideCount }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${slides}</Types>`;
}

function presentationXml(slideCount) {
  const slideIds = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

function presentationRels(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}</Relationships>`;
}

function themeXml(preset) {
  const c = preset.colors;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${esc(preset.name)}"><a:themeElements><a:clrScheme name="${esc(preset.name)}"><a:dk1><a:srgbClr val="${c.dark}"/></a:dk1><a:lt1><a:srgbClr val="${c.bg}"/></a:lt1><a:dk2><a:srgbClr val="${c.primary}"/></a:dk2><a:lt2><a:srgbClr val="${c.panel}"/></a:lt2><a:accent1><a:srgbClr val="${c.primary}"/></a:accent1><a:accent2><a:srgbClr val="${c.accent}"/></a:accent2><a:accent3><a:srgbClr val="${c.success}"/></a:accent3><a:accent4><a:srgbClr val="${c.risk}"/></a:accent4><a:accent5><a:srgbClr val="${c.muted}"/></a:accent5><a:accent6><a:srgbClr val="${c.line}"/></a:accent6><a:hlink><a:srgbClr val="${c.accent}"/></a:hlink><a:folHlink><a:srgbClr val="${c.primary}"/></a:folHlink></a:clrScheme><a:fontScheme name="FundCo"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="FundCo"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="90000"/><a:satMod val="105000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"><a:lumMod val="95000"/></a:schemeClr></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="90000"/></a:schemeClr></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
const MASTER_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
const LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const LAYOUT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

function coreProps(project) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(project.projectName)} Finance Presentation</dc:title><dc:creator>FundCo Capital Managers</dc:creator><cp:lastModifiedBy>FundCo Capital Managers</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appProps(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>FundCo Finance</Application><PresentationFormat>Wide</PresentationFormat><Slides>${slideCount}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><Company>FundCo Capital Managers</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>`;
}

export async function buildPresentationPptx(project, options = {}) {
  const preset = getPreset(options.presetId);
  const slides = (options.slides || defaultSlides(project, options.audience))
    .filter((slide) => slide.included !== false)
    .map(normalizeSlide);
  const zip = new JSZip();

  zip.file('[Content_Types].xml', contentTypes(slides.length));
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('docProps/core.xml', coreProps(project));
  zip.file('docProps/app.xml', appProps(slides.length));
  zip.file('ppt/presentation.xml', presentationXml(slides.length));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels(slides.length));
  zip.file('ppt/theme/theme1.xml', themeXml(preset));
  zip.file('ppt/slideMasters/slideMaster1.xml', MASTER_XML);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', MASTER_RELS);
  zip.file('ppt/slideLayouts/slideLayout1.xml', LAYOUT_XML);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', LAYOUT_RELS);

  slides.forEach((slide, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, buildSlideXml(project, slide, index, preset));
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
  });

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
