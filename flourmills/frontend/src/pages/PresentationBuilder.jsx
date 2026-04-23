import { useEffect, useMemo, useState } from 'react';
import { Clock3, Download, Eye, Loader2, PencilLine, Presentation, RefreshCw, X } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext.jsx';
import { api } from '../lib/api.js';
import { cn, fmtMillions, fmtMultiplier, fmtNumber, fmtPct } from '../lib/utils.js';
import { Badge, Button } from '../components/ui/Primitives.jsx';

const DEFAULT_PRESETS = [
  { id: 'fundco-classic', name: 'FundCo Classic', description: 'Formal FundCo purple and blue institutional style.' },
  { id: 'boardroom-slate', name: 'Boardroom Slate', description: 'Restrained boardroom style for senior management.' },
  { id: 'sovereign-clean', name: 'Sovereign Clean', description: 'Government and lender friendly blue layout.' },
  { id: 'energy-modern', name: 'Energy Modern', description: 'Clean energy style with green accents.' },
  { id: 'capital-markets', name: 'Capital Markets', description: 'Navy and gold investment banking style.' },
];

const AUDIENCES = ['Investment Committee', 'Board Review', 'Lender Submission', 'Management Review', 'Client Proposal'];

function friendlyPresentationError(error) {
  if (error?.status === 404 || /404/.test(error?.message || '')) {
    return '';
  }
  return error?.message || 'Presentation request failed';
}

function Section({ children, className }) {
  return <section className={cn('rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-card', className)}>{children}</section>;
}

function HeaderBlock({ title, description, action }) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] px-6 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Generate Presentation</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function KpiStrip({ kpis }) {
  const items = [
    { label: 'Total Capex', value: fmtMillions(kpis.totalCapex, 1) },
    { label: 'Target Tariff', value: `NGN ${fmtNumber(kpis.targetTariff, 2)} / kWh` },
    { label: 'Project IRR', value: fmtPct(kpis.projectIRR, 1) },
    { label: 'Equity IRR', value: fmtPct(kpis.equityIRR, 1) },
    { label: 'Average DSCR', value: fmtMultiplier(kpis.avgDSCR) },
    { label: 'Project NPV', value: fmtMillions(kpis.projectNPV, 1) },
  ];

  return (
    <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--surface)] px-5 py-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-main)]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function PresetCard({ preset, selected, onSelect }) {
  const colors = preset.colors || {};
  const palette = colors.palette || [colors.primary || '312783', colors.accent || '36A9E1', colors.gold || 'C99700', colors.teal || '0F766E'];
  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      className={cn(
        'border-b border-[var(--border-soft)] px-4 py-4 text-left transition-colors last:border-b-0',
        selected ? 'bg-primary-50' : 'hover:bg-[var(--surface-muted)]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-main)]">{preset.name}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{preset.description}</div>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-full border border-[var(--border-soft)]">
          {palette.slice(0, 4).map((color, index) => (
            <span key={`${preset.id}-${color}-${index}`} className="h-5 w-5" style={{ backgroundColor: `#${color}` }} />
          ))}
        </div>
      </div>
    </button>
  );
}

function HistoryList({ history, activeId, busy, onRefresh, onOpen }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-main)]">Presentation History</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Reopen previous drafts and exported versions.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </Button>
      </div>
      <div className="max-h-[360px] overflow-auto">
        {history.length === 0 && (
          <div className="px-6 py-7 text-sm leading-6 text-[var(--text-muted)]">
            No presentation history yet. Generated drafts will be saved here for quick access.
          </div>
        )}
        {history.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className={cn(
              'flex w-full items-start justify-between gap-4 border-b border-[var(--border-soft)] px-6 py-4 text-left last:border-b-0 hover:bg-[var(--surface-muted)]',
              activeId === item.id && 'bg-primary-50'
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--text-main)]">{item.title}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                <span>{item.presetName}</span>
                <span>{item.audience}</span>
                <span>{item.slideCount} slides</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Badge variant={item.status === 'exported' ? 'success' : 'neutral'}>{item.status}</Badge>
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlideEditor({ slide, index, onChange }) {
  const bulletsText = (slide.bullets || []).join('\n');
  const update = (patch) => onChange({ ...slide, ...patch });

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Slide {index + 1}</div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{slide.title}</div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={slide.included !== false}
            disabled={slide.required}
            onChange={(event) => update({ included: event.target.checked })}
          />
          Include
        </label>
      </div>
      <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Title</span>
          <input
            value={slide.title || ''}
            onChange={(event) => update({ title: event.target.value })}
            className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm text-[var(--text-main)] outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Subtitle</span>
          <input
            value={slide.subtitle || ''}
            onChange={(event) => update({ subtitle: event.target.value })}
            className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm text-[var(--text-main)] outline-none"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Narrative</span>
          <textarea
            value={slide.narrative || ''}
            onChange={(event) => update({ narrative: event.target.value })}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 text-[var(--text-main)] outline-none"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Bullets, one per line</span>
          <textarea
            value={bulletsText}
            onChange={(event) => update({ bullets: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
            rows={4}
            className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 text-[var(--text-main)] outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function getPresetColors(preset) {
  const colors = preset?.colors || {};
  return {
    primary: `#${colors.primary || '312783'}`,
    accent: `#${colors.accent || '36A9E1'}`,
    gold: `#${colors.gold || 'C99700'}`,
    dark: `#${colors.dark || '111827'}`,
    muted: `#${colors.muted || '667085'}`,
    panel: `#${colors.panel || 'F5F7FA'}`,
    line: `#${colors.line || 'D7DEE7'}`,
    bg: `#${colors.bg || 'FFFFFF'}`,
    success: `#${colors.success || '047857'}`,
    risk: `#${colors.risk || 'B42318'}`,
    palette: (colors.palette || ['312783', '36A9E1', '0F766E', 'C99700', '6D28D9']).map((color) => `#${color}`),
  };
}

function trimCopy(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 50 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

function PreviewMetric({ label, value, colors }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: colors.line, background: colors.panel }}>
      <div className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: colors.muted }}>{label}</div>
      <div className="mt-2 truncate text-lg font-semibold" style={{ color: colors.dark }}>{value}</div>
    </div>
  );
}

function PreviewBars({ title, data, colors }) {
  const values = data.map((item) => Math.abs(Number(item.value) || 0));
  const max = Math.max(...values, 1);
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: colors.line, background: colors.panel }}>
      <div className="text-sm font-semibold" style={{ color: colors.dark }}>{title}</div>
      <div className="mt-5 flex h-[210px] items-end gap-3 border-b" style={{ borderColor: colors.line }}>
        {data.slice(0, 8).map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="text-[10px] font-semibold" style={{ color: colors.muted }}>{item.display}</div>
            <div
              className="w-full max-w-[44px] rounded-t-md"
              style={{
                height: `${Math.max(8, ((Math.abs(Number(item.value) || 0) / max) * 165))}px`,
                background: item.color || colors.palette[index % colors.palette.length],
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 8)}, minmax(0, 1fr))` }}>
        {data.slice(0, 8).map((item, index) => (
          <div key={`${item.label}-label-${index}`} className="truncate text-center text-[10px]" style={{ color: colors.muted }}>{item.label}</div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({ rows, columns, colors }) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: colors.line }}>
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid" style={{ gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' ') }}>
          {columns.map((col) => (
            <div
              key={`${rowIndex}-${col.key}`}
              className="truncate border-b border-r px-3 py-2 text-[11px] last:border-r-0"
              style={{
                borderColor: colors.line,
                background: rowIndex === 0 ? colors.primary : rowIndex % 2 === 0 ? colors.panel : colors.bg,
                color: rowIndex === 0 ? '#fff' : colors.dark,
                fontWeight: rowIndex === 0 ? 700 : 500,
                textAlign: col.align || 'left',
              }}
            >
              {row[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SlidePreview({ slide, index, current, preset }) {
  const colors = getPresetColors(preset);
  const k = current?.result?.kpis || {};
  const annual = current?.result?.financials?.years?.map((year, i) => ({
    year,
    revenue: current?.result?.financials?.incomeStatement?.revenue?.[i] || 0,
    ebitda: current?.result?.financials?.incomeStatement?.ebitda?.[i] || 0,
    pat: current?.result?.financials?.incomeStatement?.profitAfterTax?.[i] || 0,
    dscr: current?.result?.kpis?.dscrByYear?.[i] ?? null,
    cash: current?.result?.financials?.cashFlow?.endingCash?.[i] || 0,
  })) || [];
  const sensitivity = current?.result?.sensitivity || [];
  const projectName = current?.projectName || 'Project Finance Model';

  const headlineMetrics = [
    { label: 'Project IRR', value: fmtPct(k.projectIRR, 1) },
    { label: 'Equity IRR', value: fmtPct(k.equityIRR, 1) },
    { label: 'Total Capex', value: fmtMillions(k.totalCapex, 1) },
    { label: 'Average DSCR', value: fmtMultiplier(k.avgDSCR) },
  ];

  const returnData = [
    { label: 'Project IRR', value: (Number(k.projectIRR) || 0) * 100, display: fmtPct(k.projectIRR, 1) },
    { label: 'Equity IRR', value: (Number(k.equityIRR) || 0) * 100, display: fmtPct(k.equityIRR, 1) },
    { label: 'Avg DSCR', value: (Number(k.avgDSCR) || 0) * 30, display: fmtMultiplier(k.avgDSCR) },
    { label: 'Min DSCR', value: (Number(k.minDSCR) || 0) * 30, display: fmtMultiplier(k.minDSCR), color: colors.risk },
  ];

  const renderContent = () => {
    if (slide.type === 'cover') {
      return (
        <div className="grid min-h-[560px] grid-cols-[38%_1fr]">
          <div className="flex min-h-[560px] flex-col justify-between px-10 py-10 text-white" style={{ background: colors.primary }}>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Project Finance Model</div>
              <h2 className="mt-8 text-[34px] font-semibold leading-tight">{trimCopy(slide.title, 70)}</h2>
              <p className="mt-5 text-base leading-7 opacity-90">{trimCopy(slide.subtitle, 100)}</p>
            </div>
            <div className="text-sm font-semibold">FundCo Capital Managers</div>
          </div>
          <div className="px-12 py-12">
            <div className="grid grid-cols-2 gap-5">
              {headlineMetrics.map((item) => <PreviewMetric key={item.label} {...item} colors={colors} />)}
            </div>
            <p className="mt-9 max-w-xl text-lg leading-8" style={{ color: colors.dark }}>{trimCopy(slide.narrative, 190)}</p>
          </div>
        </div>
      );
    }

    if (slide.type === 'kpiSnapshot') {
      const metrics = [
        { label: 'Total Capex', value: fmtMillions(k.totalCapex, 1) },
        { label: 'Target Tariff', value: `NGN ${fmtNumber(k.targetTariff, 2)}` },
        { label: 'Project IRR', value: fmtPct(k.projectIRR, 1) },
        { label: 'Equity IRR', value: fmtPct(k.equityIRR, 1) },
        { label: 'Project NPV', value: fmtMillions(k.projectNPV, 1) },
        { label: 'Average DSCR', value: fmtMultiplier(k.avgDSCR) },
        { label: 'Payback Year', value: k.paybackYear || '-' },
        { label: 'System Capacity', value: `${fmtNumber(k.systemCapacityKWp, 0)} kWp` },
      ];
      return <div className="grid grid-cols-4 gap-4">{metrics.map((item) => <PreviewMetric key={item.label} {...item} colors={colors} />)}</div>;
    }

    if (slide.type === 'operatingProfile') {
      const data = annual.slice(0, 8).map((row, itemIndex) => ({ label: String(row.year), value: row.ebitda / 1e6, display: fmtNumber(row.ebitda / 1e6, 0), color: colors.palette[itemIndex % colors.palette.length] }));
      const rows = [{ year: 'Year', revenue: 'Revenue', ebitda: 'EBITDA', pat: 'PAT' }, ...annual.slice(0, 6).map((row) => ({ year: row.year, revenue: fmtMillions(row.revenue, 0), ebitda: fmtMillions(row.ebitda, 0), pat: fmtMillions(row.pat, 0) }))];
      return <div className="grid grid-cols-[58%_1fr] gap-7"><PreviewBars title="EBITDA profile (NGN millions)" data={data} colors={colors} /><PreviewTable rows={rows} columns={[{ key: 'year', width: '0.8fr' }, { key: 'revenue' }, { key: 'ebitda' }, { key: 'pat' }]} colors={colors} /></div>;
    }

    if (slide.type === 'coverage') {
      const data = annual.slice(0, 8).map((row) => ({ label: String(row.year), value: Number(row.dscr) || 0, display: row.dscr == null ? '-' : fmtMultiplier(row.dscr), color: Number(row.dscr) >= 1.2 ? colors.primary : colors.risk }));
      return <div className="grid grid-cols-[64%_1fr] gap-7"><PreviewBars title="Annual DSCR" data={data} colors={colors} /><div className="rounded-2xl border p-6" style={{ borderColor: colors.line, background: colors.panel }}><h4 className="text-xl font-semibold" style={{ color: colors.dark }}>Credit interpretation</h4><p className="mt-5 text-sm leading-7" style={{ color: colors.dark }}>{trimCopy(slide.narrative, 180)}</p></div></div>;
    }

    if (slide.type === 'sensitivity') {
      const rows = [{ scenario: 'Scenario', projectIRR: 'Project IRR', equityIRR: 'Equity IRR', avgDSCR: 'Avg DSCR' }, ...sensitivity.slice(0, 7).map((row) => ({ scenario: trimCopy(row.scenario, 24), projectIRR: fmtPct(row.projectIRR, 1), equityIRR: fmtPct(row.equityIRR, 1), avgDSCR: fmtMultiplier(row.avgDSCR) }))];
      const data = sensitivity.slice(0, 6).map((row, itemIndex) => ({ label: trimCopy(row.scenario, 14), value: (Number(row.projectIRR) || 0) * 100, display: fmtPct(row.projectIRR, 1), color: colors.palette[itemIndex % colors.palette.length] }));
      return <div className="grid grid-cols-[60%_1fr] gap-7"><PreviewTable rows={rows} columns={[{ key: 'scenario', width: '1.4fr' }, { key: 'projectIRR' }, { key: 'equityIRR' }, { key: 'avgDSCR' }]} colors={colors} /><PreviewBars title="Project IRR by scenario" data={data} colors={colors} /></div>;
    }

    if (slide.type === 'appendix') {
      const rows = [{ year: 'Year', revenue: 'Revenue', ebitda: 'EBITDA', dscr: 'DSCR', cash: 'Ending Cash' }, ...annual.slice(0, 9).map((row) => ({ year: row.year, revenue: fmtMillions(row.revenue, 0), ebitda: fmtMillions(row.ebitda, 0), dscr: row.dscr == null ? '-' : fmtMultiplier(row.dscr), cash: fmtMillions(row.cash, 0) }))];
      return <PreviewTable rows={rows} columns={[{ key: 'year', width: '0.7fr' }, { key: 'revenue' }, { key: 'ebitda' }, { key: 'dscr', width: '0.7fr' }, { key: 'cash' }]} colors={colors} />;
    }

    if (slide.type === 'projectScope' || slide.type === 'economics') {
      return <div className="grid grid-cols-[42%_1fr] gap-7"><div className="rounded-2xl border p-6" style={{ borderColor: colors.line, background: colors.panel }}><p className="text-base leading-8" style={{ color: colors.dark }}>{trimCopy(slide.narrative, 220)}</p><div className="mt-7 space-y-4">{(slide.bullets || []).slice(0, 4).map((bullet, bulletIndex) => <div key={bullet} className="flex gap-3 text-sm leading-6" style={{ color: colors.dark }}><span className="mt-2 h-2 w-2 rounded-full" style={{ background: colors.palette[bulletIndex % colors.palette.length] }} />{trimCopy(bullet, 100)}</div>)}</div></div><PreviewBars title="Return and coverage indicators" data={returnData} colors={colors} /></div>;
    }

    return (
      <div className="grid grid-cols-[45%_1fr] gap-8">
        <div className="rounded-2xl border p-6" style={{ borderColor: colors.line, background: colors.panel }}>
          <p className="text-base leading-8" style={{ color: colors.dark }}>{trimCopy(slide.narrative, 230)}</p>
          <div className="mt-7 space-y-4">
            {(slide.bullets || []).slice(0, 5).map((bullet, bulletIndex) => (
              <div key={bullet} className="flex gap-3 text-sm leading-6" style={{ color: colors.dark }}>
                <span className="mt-2 h-2 w-2 rounded-full" style={{ background: colors.palette[bulletIndex % colors.palette.length] }} />
                {trimCopy(bullet, 105)}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl px-9 py-8 text-white" style={{ background: colors.primary }}>
          <div className="text-4xl font-semibold">{fmtPct(k.projectIRR, 1)}</div>
          <div className="mt-2 text-sm opacity-80">Project IRR</div>
          <div className="mt-14 text-3xl font-semibold">{fmtMultiplier(k.avgDSCR)}</div>
          <div className="mt-2 text-sm opacity-80">Average DSCR</div>
          <div className="mt-14 h-2 w-36 rounded-full" style={{ background: colors.gold }} />
          <div className="mt-5 text-lg">Target tariff NGN {fmtNumber(k.targetTariff, 2)} / kWh</div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl rounded-[28px] border bg-white shadow-2xl" style={{ borderColor: colors.line }}>
      <div className="flex min-h-[560px] flex-col" style={{ background: colors.bg }}>
        {slide.type !== 'cover' && (
          <div className="flex items-center justify-between px-10 py-5 text-[11px] font-semibold" style={{ color: colors.muted }}>
            <span>{projectName}</span>
            <span>Slide {index + 1}</span>
          </div>
        )}
        {slide.type !== 'cover' && <div className="mx-10 h-px" style={{ background: colors.line }} />}
        {slide.type !== 'cover' ? (
          <div className="flex-1 px-10 py-6">
            <h3 className="max-w-3xl text-[29px] font-semibold leading-tight" style={{ color: colors.dark }}>{trimCopy(slide.title, 74)}</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6" style={{ color: colors.muted }}>{trimCopy(slide.subtitle || slide.narrative, 118)}</p>
            <div className="mt-7">{renderContent()}</div>
          </div>
        ) : (
          renderContent()
        )}
        {slide.type !== 'cover' && (
          <div className="mx-10 mb-4 flex items-center justify-between border-t pt-3 text-[10px]" style={{ borderColor: colors.line, color: colors.muted }}>
            <span>Generated {new Date().toLocaleDateString('en-GB')}</span>
            <span>FundCo Capital Managers</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SlideNavigator({ slides, activeIndex, onSelect }) {
  return (
    <div className="flex gap-2 overflow-auto pb-2">
      {slides.map((slide, index) => (
        <button
          key={`${slide.id}-${index}`}
          type="button"
          onClick={() => onSelect(index)}
          className={cn(
            'min-w-[150px] rounded-2xl border px-3 py-3 text-left transition-colors',
            activeIndex === index ? 'border-primary bg-primary-50' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]'
          )}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Slide {index + 1}</div>
          <div className="mt-1 truncate text-xs font-semibold text-[var(--text-main)]">{slide.title}</div>
        </button>
      ))}
    </div>
  );
}

export default function PresentationBuilder() {
  const { current } = useProject();
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [presetId, setPresetId] = useState('fundco-classic');
  const [audience, setAudience] = useState('Investment Committee');
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const projectId = current ? String(current._id || current.id) : null;
  const kpis = current?.result?.kpis || {};
  const includedSlides = useMemo(() => (draft?.slides || []).filter((slide) => slide.included !== false), [draft]);
  const previewSlideIndex = Math.min(activeSlideIndex, Math.max(includedSlides.length - 1, 0));
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === presetId) || draft?.preset || DEFAULT_PRESETS[0],
    [draft?.preset, presetId, presets]
  );

  useEffect(() => {
    api.getPresentationPresets()
      .then((response) => {
        if (Array.isArray(response.presets) && response.presets.length > 0) setPresets(response.presets);
      })
      .catch(() => setPresets(DEFAULT_PRESETS));
  }, []);

  const loadHistory = async () => {
    if (!projectId) return;
    setHistoryBusy(true);
    try {
      const response = await api.listPresentationHistory(projectId, 30);
      setHistory(response.history || []);
    } catch (err) {
      setError(friendlyPresentationError(err));
    } finally {
      setHistoryBusy(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  useEffect(() => {
    if (activeSlideIndex >= includedSlides.length) {
      setActiveSlideIndex(Math.max(includedSlides.length - 1, 0));
    }
  }, [activeSlideIndex, includedSlides.length]);

  const generateDraft = async () => {
    if (!projectId) return;
    setBusy('draft');
    setError(null);
    try {
      const response = await api.generatePresentationDraft(projectId, {
        presetId,
        audience,
        useAi: true,
      });
      setDraft({
        ...response.draft,
        slides: (response.draft?.slides || []).map((slide) => ({ ...slide, included: slide.included !== false })),
      });
      setActiveSlideIndex(0);
      setPreviewOpen(true);
      if (response.history) {
        setActiveHistoryId(response.history.id);
        setHistory((prev) => [response.history, ...prev.filter((item) => item.id !== response.history.id)]);
      } else {
        loadHistory();
      }
    } catch (err) {
      setError(friendlyPresentationError(err));
    } finally {
      setBusy('');
    }
  };

  const exportDeck = async () => {
    if (!projectId || !draft) return;
    setBusy('export');
    setError(null);
    try {
      const filename = `${(current.projectName || 'project').replace(/[^\w]+/g, '_')}_presentation.pptx`;
      await api.downloadPresentation(projectId, filename, {
        presetId,
        audience,
        aiAssisted: draft.aiAssisted,
        generatedAt: draft.generatedAt,
        slides: draft.slides,
      });
      loadHistory();
    } catch (err) {
      setError(friendlyPresentationError(err));
    } finally {
      setBusy('');
    }
  };

  const openHistory = async (item) => {
    if (!projectId) return;
    setBusy('history');
    setError(null);
    try {
      const response = await api.getPresentationHistory(projectId, item.id);
      const historyItem = response.history;
      if (!historyItem?.draft) throw new Error('Presentation draft was not found in history');
      setDraft({
        ...historyItem.draft,
        slides: (historyItem.draft.slides || []).map((slide) => ({ ...slide, included: slide.included !== false })),
      });
      setPresetId(historyItem.presetId || historyItem.draft?.preset?.id || presetId);
      setAudience(historyItem.audience || historyItem.draft?.audience || audience);
      setActiveHistoryId(historyItem.id);
      setActiveSlideIndex(0);
      setPreviewOpen(true);
    } catch (err) {
      setError(friendlyPresentationError(err));
    } finally {
      setBusy('');
    }
  };

  const updateSlide = (index, nextSlide) => {
    setDraft((prev) => ({
      ...prev,
      slides: prev.slides.map((slide, slideIndex) => (slideIndex === index ? nextSlide : slide)),
    }));
  };

  if (!current?.result) {
    return (
      <Section>
        <HeaderBlock
          title="Run the model before generating a presentation"
        />
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <Section>
        <HeaderBlock
          title="AI-Assisted PowerPoint Presentation"
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={generateDraft} disabled={busy === 'draft'}>
                {busy === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {draft ? 'Regenerate Draft' : 'Generate Draft'}
              </Button>
              <Button type="button" onClick={exportDeck} disabled={!draft || busy === 'export'}>
                {busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Export PPTX
              </Button>
            </div>
          }
        />
        <KpiStrip kpis={kpis} />
      </Section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section className="overflow-hidden">
            <div className="border-b border-[var(--border-soft)] px-6 py-5">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Presentation Settings</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Choose the audience and visual style before generating the draft.</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Audience</span>
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm text-[var(--text-main)] outline-none"
                >
                  {AUDIENCES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)]">
                {presets.map((preset) => (
                  <PresetCard key={preset.id} preset={preset} selected={presetId === preset.id} onSelect={setPresetId} />
                ))}
              </div>
            </div>
          </Section>

          <Section className="overflow-hidden">
            <HistoryList history={history} activeId={activeHistoryId} busy={historyBusy || busy === 'history'} onRefresh={loadHistory} onOpen={openHistory} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section>
            <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-main)]">Deck Structure</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {draft ? `${includedSlides.length} slides selected for export.` : 'Generate a draft to edit the presentation structure.'}
                </p>
              </div>
              {draft && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={previewOpen ? 'outline' : 'primary'} size="sm" onClick={() => setPreviewOpen((open) => !open)}>
                    {previewOpen ? <X size={14} /> : <Eye size={14} />}
                    {previewOpen ? 'Exit Preview' : 'View Deck'}
                  </Button>
                  <Badge variant={draft.aiAssisted ? 'success' : 'warning'}>{draft.aiAssisted ? 'AI assisted' : 'Standard fallback'}</Badge>
                  <Badge variant="neutral">{draft.preset?.name || presets.find((preset) => preset.id === presetId)?.name}</Badge>
                  <Badge variant="neutral"><Clock3 size={11} className="mr-1" />History saved</Badge>
                </div>
              )}
            </div>

            {!draft ? (
              <div className="px-6 py-12 text-center">
                <Presentation size={36} className="mx-auto text-primary" />
                <h3 className="mt-4 text-xl font-semibold text-[var(--text-main)]">No presentation draft yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
                  Generate a draft to create a complete project finance presentation with charts, KPI pages, scenario analysis, risks, recommendations, and an appendix.
                </p>
                <Button type="button" onClick={generateDraft} disabled={busy === 'draft'} className="mt-6">
                  {busy === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <PencilLine size={16} />}
                  Generate Presentation Draft
                </Button>
              </div>
            ) : (
              <div className="space-y-4 px-6 py-5">
                {previewOpen && includedSlides.length > 0 && (
                  <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:p-6">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text-main)]">Presentation Preview</h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Review the deck inside the application before exporting. Use the editors below to change slide text.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                        <X size={14} />
                        Exit Preview
                      </Button>
                    </div>
                    <SlideNavigator slides={includedSlides} activeIndex={previewSlideIndex} onSelect={setActiveSlideIndex} />
                    <div className="mt-5 max-h-[78vh] overflow-x-auto overflow-y-auto rounded-[24px] bg-[var(--surface)] p-3 pb-5">
                      <div className="min-w-[860px]">
                        <SlidePreview slide={includedSlides[previewSlideIndex]} index={previewSlideIndex} current={current} preset={selectedPreset} />
                      </div>
                    </div>
                  </div>
                )}
                {draft.slides.map((slide, index) => (
                  <SlideEditor key={slide.id} slide={slide} index={index} onChange={(nextSlide) => updateSlide(index, nextSlide)} />
                ))}
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">Need a fresh version?</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Regenerate the draft using the selected audience, preset, and latest model result.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={generateDraft} disabled={busy === 'draft'} className="shrink-0">
                    {busy === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Regenerate Draft
                  </Button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
