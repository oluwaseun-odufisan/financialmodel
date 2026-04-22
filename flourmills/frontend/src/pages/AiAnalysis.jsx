// AI FEATURE - GROK
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAi } from '../contexts/AiContext.jsx';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Badge, Button } from '../components/ui/Primitives.jsx';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/Table.jsx';
import { normalizeAiText, splitAiSections, toParagraphs } from '../lib/aiPresentation.js';
import { cn, fmtMillions, fmtMultiplier, fmtNumber, fmtPct } from '../lib/utils.js';

const PRIMARY = '#312783';
const ACCENT = '#36a9e1';
const SCENARIO_COLORS = ['#312783', '#36a9e1', '#0f766e', '#c2410c', '#475569', '#1d4ed8'];

const axisProps = {
  stroke: '#667085',
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: '#D7DEE7' },
};

const tooltipProps = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #D7DEE7',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  },
};

const TYPE_META = {
  summary: {
    label: 'Executive Summary',
    eyebrow: 'AI Memorandum',
    description: 'Formal narrative prepared from the current model results.',
  },
  scenarios: {
    label: 'Scenario Analysis',
    eyebrow: 'AI Scenario Pack',
    description: 'Institutional scenario comparison with modeled outputs and sensitivity implications.',
  },
  optimize: {
    label: 'Optimization Analysis',
    eyebrow: 'AI Optimization Review',
    description: 'Recommended levers ranked against the current investment objective.',
  },
  insights: {
    label: 'AI Insights',
    eyebrow: 'AI Commentary',
    description: 'Sensitivity, risk, and DSCR commentary for management review.',
  },
};

function Surface({ className, children }) {
  return <section className={cn('rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)]', className)}>{children}</section>;
}

function SectionHeader({ eyebrow, title, description, extra }) {
  return (
    <div className="border-b border-[var(--border-soft)] px-6 py-5 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">{eyebrow}</div>}
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)]">{title}</h2>
          {description && <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{description}</p>}
        </div>
        {extra}
      </div>
    </div>
  );
}

function MetricBand({ items }) {
  return (
    <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--surface)] px-5 py-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.label}</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{item.value}</div>
          {item.note && <div className="mt-1 text-xs text-[var(--text-muted)]">{item.note}</div>}
        </div>
      ))}
    </div>
  );
}

function ChartShell({ title, description, children, className }) {
  return (
    <div className={cn('rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]', className)}>
      <div className="border-b border-[var(--border-soft)] px-5 py-4">
        <div className="text-sm font-semibold text-[var(--text-main)]">{title}</div>
        {description && <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</div>}
      </div>
      <div className="h-[320px] px-4 py-4">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ArtifactTabs({ activeType, availableTypes, onSelect }) {
  if (availableTypes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {availableTypes.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm transition-colors',
            activeType === type
              ? 'border-primary bg-primary text-white'
              : 'border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-muted)]'
          )}
        >
          {TYPE_META[type]?.label || type}
        </button>
      ))}
    </div>
  );
}

function EmptyAnalysisState({ onOpenAi }) {
  return (
    <Surface>
      <div className="px-6 py-12 text-center lg:px-8">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">AI Analysis</div>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--text-main)]">No saved AI output yet</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
          Generate a scenario pack, executive summary, optimization review, or insights from FundCo AI. The result can then be opened here as a full working page.
        </p>
        <div className="mt-8 flex justify-center">
          <Button type="button" onClick={onOpenAi}>Open FundCo AI</Button>
        </div>
      </div>
    </Surface>
  );
}

function ExecutiveSummaryView({ artifact, current }) {
  const result = current?.result;
  const kpis = result?.kpis || {};
  const sections = splitAiSections(artifact?.data?.content, [
    'Project Overview',
    'Economics',
    'Coverage and Credit',
    'Key Risks',
    'Recommendation',
  ]);

  const performanceData = (result?.financials?.years || []).map((year, index) => ({
    year,
    revenue: (result?.financials?.incomeStatement?.revenue?.[index] || 0) / 1e6,
    ebitda: (result?.financials?.incomeStatement?.ebitda?.[index] || 0) / 1e6,
  }));

  const dscrData = (result?.financials?.years || []).map((year, index) => ({
    year,
    dscr: result?.kpis?.dscrByYear?.[index] ?? null,
    covenant: 1.2,
  }));

  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeader
          eyebrow="Executive Summary"
          title="Institutional Investment Memorandum"
          description="A formal narrative view of the current case, arranged for credit, investment, or management review."
          extra={<Badge variant="primary">Prepared from latest model run</Badge>}
        />
        <MetricBand
          items={[
            { label: 'Total Capex', value: fmtMillions(kpis.totalCapex, 1) },
            { label: 'Target Tariff', value: `NGN ${fmtNumber(kpis.targetTariff, 2)} / kWh` },
            { label: 'Project IRR', value: fmtPct(kpis.projectIRR, 1) },
            { label: 'Equity IRR', value: fmtPct(kpis.equityIRR, 1) },
            { label: 'Average DSCR', value: fmtMultiplier(kpis.avgDSCR) },
            { label: 'Project NPV', value: fmtMillions(kpis.projectNPV, 1) },
          ]}
        />
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-[var(--border-soft)] px-6 py-6 xl:border-b-0 xl:border-r lg:px-8">
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.title}>
                  <div className="text-lg font-semibold text-[var(--text-main)]">{section.title}</div>
                  <div className="mt-2 space-y-3">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={`${section.title}-${index}`} className="text-sm leading-7 text-[var(--text-muted)]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[var(--surface-muted)] px-6 py-6 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Model basis</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--text-main)]">Commercial basis</div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  The modeled case assumes a commercial tariff of NGN {fmtNumber(kpis.targetTariff, 2)} per kWh with a break-even tariff of NGN {fmtNumber(kpis.breakevenTariff, 2)} per kWh.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--text-main)]">Coverage basis</div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  Average DSCR stands at {fmtMultiplier(kpis.avgDSCR)} with a minimum DSCR of {fmtMultiplier(kpis.minDSCR)} across the modeled debt life.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--text-main)]">Project profile</div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  Installed capacity is {fmtNumber(kpis.systemCapacityKWp)} kWp with battery capacity of {fmtNumber(kpis.batteryCapacityKWh)} kWh and inverter capacity of {fmtNumber(kpis.inverterCapacityKW)} kW.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell title="Revenue and EBITDA Profile" description="Yearly operating earnings profile from the current base case.">
          <ComposedChart data={performanceData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => `NGN ${value.toFixed(1)}M`} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" fill={PRIMARY} name="Revenue" />
            <Line type="monotone" dataKey="ebitda" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} name="EBITDA" />
          </ComposedChart>
        </ChartShell>
        <ChartShell title="DSCR Profile" description="Debt coverage trajectory against the covenant reference line.">
          <ComposedChart data={dscrData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 'auto']} />
            <Tooltip {...tooltipProps} formatter={(value) => (value === null ? '-' : `${value.toFixed(2)}x`)} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="dscr" fill={PRIMARY} name="DSCR" />
            <Line type="monotone" dataKey="covenant" stroke="#DC2626" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Covenant 1.2x" />
          </ComposedChart>
        </ChartShell>
      </div>
    </div>
  );
}

function ScenarioAnalysisView({ artifact }) {
  const [selectedScenarioName, setSelectedScenarioName] = useState(null);
  const scenarioRows = useMemo(() => {
    const rows = [];
    if (artifact?.data?.baseCase) rows.push({ ...artifact.data.baseCase, kind: 'base' });
    (artifact?.data?.scenarios || []).forEach((scenario) => rows.push({ ...scenario, kind: 'scenario' }));
    return rows;
  }, [artifact]);

  useEffect(() => {
    const firstScenario = artifact?.data?.scenarios?.[0]?.name || null;
    setSelectedScenarioName(firstScenario);
  }, [artifact]);

  const selectedScenario = artifact?.data?.scenarios?.find((scenario) => scenario.name === selectedScenarioName) || artifact?.data?.scenarios?.[0] || null;
  const scenarioComparison = scenarioRows.map((row) => ({
    name: row.name,
    projectIRR: (row.metrics?.kpis?.projectIRR || 0) * 100,
    avgDSCR: row.metrics?.kpis?.avgDSCR || 0,
    projectNPV: (row.metrics?.kpis?.projectNPV || 0) / 1e9,
  }));

  const dscrTrend = (artifact?.data?.baseCase?.metrics?.years || []).map((year, index) => ({
    year,
    base: artifact?.data?.baseCase?.metrics?.annualRevenue?.[index]?.dscr ?? null,
    selected: selectedScenario?.metrics?.annualRevenue?.[index]?.dscr ?? null,
  }));

  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeader
          eyebrow="Scenario Pack"
          title="AI Scenario Analysis"
          description={normalizeAiText(artifact?.data?.summary)}
          extra={<Badge variant="primary">{scenarioRows.length} modeled cases</Badge>}
        />
        <MetricBand
          items={scenarioRows.map((row) => ({
            label: row.name,
            value: fmtPct(row.metrics?.kpis?.projectIRR, 1),
            note: `Avg DSCR ${fmtMultiplier(row.metrics?.kpis?.avgDSCR)}`,
          }))}
        />
      </Surface>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell title="Project IRR by Case" description="Modeled return comparison across the base case and generated scenarios.">
          <BarChart data={scenarioComparison} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" {...axisProps} angle={-18} textAnchor="end" height={54} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => `${value.toFixed(1)}%`} />
            <Bar dataKey="projectIRR">
              {scenarioComparison.map((row, index) => (
                <Cell key={row.name} fill={index === 0 ? ACCENT : SCENARIO_COLORS[(index - 1) % SCENARIO_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartShell>
        <ChartShell title="Average DSCR by Case" description="Coverage resilience across the generated case set.">
          <BarChart data={scenarioComparison} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" {...axisProps} angle={-18} textAnchor="end" height={54} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => `${value.toFixed(2)}x`} />
            <Bar dataKey="avgDSCR" fill={ACCENT} />
          </BarChart>
        </ChartShell>
      </div>

      <Surface>
        <SectionHeader
          title="Scenario Comparison Table"
          description="Current case and modeled AI-generated cases side by side for decision review."
        />
        <Table>
          <THead>
            <TR>
              <TH>Case</TH>
              <TH align="right">Project IRR</TH>
              <TH align="right">Avg DSCR</TH>
              <TH align="right">Project NPV</TH>
              <TH align="right">Target Tariff</TH>
            </TR>
          </THead>
          <TBody>
            {scenarioRows.map((row, index) => (
              <TR key={row.name} className={index === 0 ? 'bg-primary-50' : ''}>
                <TD className={index === 0 ? 'font-semibold text-primary' : 'font-medium'}>{row.name}</TD>
                <TD align="right">{fmtPct(row.metrics?.kpis?.projectIRR, 1)}</TD>
                <TD align="right">{fmtMultiplier(row.metrics?.kpis?.avgDSCR)}</TD>
                <TD align="right">{fmtMillions(row.metrics?.kpis?.projectNPV, 1)}</TD>
                <TD align="right">NGN {fmtNumber(row.metrics?.kpis?.targetTariff, 2)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Surface>

      {selectedScenario && (
        <Surface>
          <SectionHeader
            title={selectedScenario.name}
            description={selectedScenario.description}
            extra={
              <div className="flex flex-wrap gap-2">
                {(artifact?.data?.scenarios || []).map((scenario) => (
                  <button
                    key={scenario.name}
                    type="button"
                    onClick={() => setSelectedScenarioName(scenario.name)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm transition-colors',
                      selectedScenario.name === scenario.name
                        ? 'border-primary bg-primary text-white'
                        : 'border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-muted)]'
                    )}
                  >
                    {scenario.name}
                  </button>
                ))}
              </div>
            }
          />
          <div className="grid gap-6 px-6 py-6 lg:px-8 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-5">
                <div className="text-sm font-semibold text-[var(--text-main)]">Assumption changes</div>
                <div className="mt-4 space-y-3">
                  {(selectedScenario.appliedChanges || []).map((change) => (
                    <div key={`${selectedScenario.name}-${change.path}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--text-main)]">{change.path}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">{change.reason || 'Scenario adjustment'}</div>
                      <div className="mt-2 text-sm text-[var(--text-main)]">
                        {String(change.previousValue)} to <span className="font-semibold">{String(change.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <ChartShell title="DSCR Profile Versus Base Case" description="Coverage path for the selected scenario compared with the current saved case." className="h-full">
              <ComposedChart data={dscrTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="year" {...axisProps} />
                <YAxis {...axisProps} domain={[0, 'auto']} />
                <Tooltip {...tooltipProps} formatter={(value) => (value === null ? '-' : `${value.toFixed(2)}x`)} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="base" stroke="#94A3B8" strokeWidth={2.2} dot={false} name="Base Case" />
                <Line type="monotone" dataKey="selected" stroke={PRIMARY} strokeWidth={2.6} dot={{ r: 3, fill: PRIMARY }} name={selectedScenario.name} />
              </ComposedChart>
            </ChartShell>
          </div>
        </Surface>
      )}
    </div>
  );
}

function OptimizationAnalysisView({ artifact }) {
  const options = artifact?.data?.recommendations || [];
  const comparison = options.map((item) => ({
    name: item.title,
    projectIRR: (item.metrics?.kpis?.projectIRR || 0) * 100,
    avgDSCR: item.metrics?.kpis?.avgDSCR || 0,
    targetTariff: item.metrics?.kpis?.targetTariff || 0,
  }));

  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeader
          eyebrow="Optimization"
          title="AI Optimization Review"
          description={`Objective: ${normalizeAiText(artifact?.data?.goal)}`}
          extra={<Badge variant="primary">{options.length} options</Badge>}
        />
        <MetricBand
          items={options.map((item) => ({
            label: item.title,
            value: fmtMultiplier(item.metrics?.kpis?.avgDSCR),
            note: `Tariff NGN ${fmtNumber(item.metrics?.kpis?.targetTariff, 2)}`,
          }))}
        />
      </Surface>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell title="Project IRR by Recommendation" description="Return impact under each recommended adjustment set.">
          <BarChart data={comparison} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" {...axisProps} angle={-18} textAnchor="end" height={54} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => `${value.toFixed(1)}%`} />
            <Bar dataKey="projectIRR" fill={PRIMARY} />
          </BarChart>
        </ChartShell>
        <ChartShell title="Average DSCR by Recommendation" description="Coverage outcome under each recommendation set.">
          <BarChart data={comparison} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" {...axisProps} angle={-18} textAnchor="end" height={54} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(value) => `${value.toFixed(2)}x`} />
            <Bar dataKey="avgDSCR" fill={ACCENT} />
          </BarChart>
        </ChartShell>
      </div>

      <Surface>
        <SectionHeader title="Recommendation Detail" description="Each option contains exact model inputs suggested by FundCo AI and the corresponding simulated result." />
        <div className="space-y-0">
          {options.map((item, index) => (
            <div key={item.title} className={cn('grid gap-0 xl:grid-cols-[0.8fr_1.2fr]', index < options.length - 1 && 'border-b border-[var(--border-soft)]')}>
              <div className="px-6 py-6 lg:px-8">
                <div className="text-lg font-semibold text-[var(--text-main)]">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{item.thesis}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Project IRR</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--text-main)]">{fmtPct(item.metrics?.kpis?.projectIRR, 1)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Average DSCR</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--text-main)]">{fmtMultiplier(item.metrics?.kpis?.avgDSCR)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Target Tariff</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--text-main)]">NGN {fmtNumber(item.metrics?.kpis?.targetTariff, 2)}</div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--surface-muted)] px-6 py-6 lg:px-8">
                <div className="text-sm font-semibold text-[var(--text-main)]">Proposed model changes</div>
                <div className="mt-4 space-y-3">
                  {(item.appliedChanges || []).map((change) => (
                    <div key={`${item.title}-${change.path}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--text-main)]">{change.path}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">{change.reason || 'Recommended adjustment'}</div>
                      <div className="mt-2 text-sm text-[var(--text-main)]">
                        {String(change.previousValue)} to <span className="font-semibold">{String(change.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function InsightsView({ artifact }) {
  const risks = artifact?.data?.risks || [];

  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeader
          eyebrow="AI Insights"
          title="Reports Commentary"
          description={normalizeAiText(artifact?.data?.headline)}
        />
        <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[var(--border-soft)] px-6 py-6 xl:border-b-0 xl:border-r lg:px-8">
            <div className="text-sm font-semibold text-[var(--text-main)]">Sensitivity narrative</div>
            {toParagraphs(artifact?.data?.tornadoDescription).map((paragraph, index) => (
              <p key={index} className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{paragraph}</p>
            ))}
          </div>
          <div className="bg-[var(--surface-muted)] px-6 py-6 lg:px-8">
            <div className="text-sm font-semibold text-[var(--text-main)]">DSCR commentary</div>
            {toParagraphs(artifact?.data?.dscrCommentary).map((paragraph, index) => (
              <p key={index} className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{paragraph}</p>
            ))}
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-2">
        <Surface>
          <SectionHeader title="Top Sensitive Variables" description="The five most material variables highlighted by FundCo AI." />
          <Table>
            <THead>
              <TR>
                <TH>Variable</TH>
                <TH>Impact</TH>
              </TR>
            </THead>
            <TBody>
              {(artifact?.data?.sensitiveVariables || []).map((item) => (
                <TR key={item.variable}>
                  <TD className="font-medium">{item.variable}</TD>
                  <TD>{normalizeAiText(item.impact)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Surface>
        <Surface>
          <SectionHeader title="Risk and Mitigation" description="Management issues and response actions based on the current case." />
          <div className="space-y-0">
            {risks.map((item, index) => (
              <div key={`${item.risk}-${index}`} className={cn('px-6 py-5 lg:px-8', index < risks.length - 1 && 'border-b border-[var(--border-soft)]')}>
                <div className="text-sm font-semibold text-[var(--text-main)]">{item.risk}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{normalizeAiText(item.mitigation)}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

export default function AiAnalysis() {
  const { current } = useProject();
  const { sidebarOpen, setSidebarOpen, availableArtifactTypes, getArtifact, lastArtifactType, setLastArtifactType } = useAi();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const requestedType = searchParams.get('type');
  const activeType = availableArtifactTypes.includes(requestedType) ? requestedType : lastArtifactType;
  const artifact = activeType ? getArtifact(activeType) : null;

  useEffect(() => {
    if (!activeType && availableArtifactTypes.length > 0) {
      const fallback = availableArtifactTypes[0];
      setLastArtifactType(fallback);
      navigate(`/ai-analysis?type=${encodeURIComponent(fallback)}`, { replace: true });
      return;
    }

    if (activeType && requestedType !== activeType) {
      navigate(`/ai-analysis?type=${encodeURIComponent(activeType)}`, { replace: true });
    }
  }, [activeType, availableArtifactTypes, navigate, requestedType, setLastArtifactType]);

  const handleSelectType = (type) => {
    setLastArtifactType(type);
    navigate(`/ai-analysis?type=${encodeURIComponent(type)}`);
  };

  const meta = TYPE_META[activeType] || TYPE_META.summary;

  if (!artifact) {
    return <EmptyAnalysisState onOpenAi={() => setSidebarOpen(true)} />;
  }

  return (
    <div className="space-y-6">
      <Surface>
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">{meta.eyebrow}</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">{meta.label}</h1>
            <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              {current?.projectName ? `${current.projectName}. ` : ''}{meta.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Saved {artifact.savedAt ? new Date(artifact.savedAt).toLocaleString() : 'just now'}</Badge>
            <Button type="button" variant="outline" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? 'Close FundCo AI' : 'Open FundCo AI'}
            </Button>
          </div>
        </div>
        <div className="border-t border-[var(--border-soft)] px-6 py-4 lg:px-8">
          <ArtifactTabs activeType={activeType} availableTypes={availableArtifactTypes} onSelect={handleSelectType} />
        </div>
      </Surface>

      {activeType === 'summary' && <ExecutiveSummaryView artifact={artifact} current={current} />}
      {activeType === 'scenarios' && <ScenarioAnalysisView artifact={artifact} />}
      {activeType === 'optimize' && <OptimizationAnalysisView artifact={artifact} />}
      {activeType === 'insights' && <InsightsView artifact={artifact} />}
    </div>
  );
}
