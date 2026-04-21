import { useProject } from '../contexts/ProjectContext.jsx';
import { Button, Badge } from '../components/ui/Primitives.jsx';
import { fmtMillions, fmtMultiplier, fmtNumber, fmtPct } from '../lib/utils.js';
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Play } from 'lucide-react';

const chartAxisProps = {
  stroke: '#667085',
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: '#D7DEE7' },
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #D7DEE7',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  },
  labelStyle: { color: '#111827', fontWeight: 600 },
};

function EmptyState() {
  const { runModel, running } = useProject();

  return (
    <section className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-12 text-center shadow-card sm:px-10">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Deal Summary</div>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--text-main)]">Run the model to generate the summary</h2>
      <Button onClick={runModel} disabled={running} className="mt-7">
        <Play size={16} />
        {running ? 'Running...' : 'Run Model'}
      </Button>
    </section>
  );
}

export default function Dashboard() {
  const { current } = useProject();
  if (!current) return <div className="text-sm text-[var(--text-muted)]">Loading project...</div>;
  if (!current.result) return <EmptyState />;

  const result = current.result;
  const kpis = result.kpis;
  const financials = result.financials;

  const performanceData = financials.years.map((year, index) => ({
    year,
    revenue: financials.incomeStatement.revenue[index] / 1e6,
    ebitda: financials.incomeStatement.ebitda[index] / 1e6,
    pat: financials.incomeStatement.profitAfterTax[index] / 1e6,
  }));

  const dscrData = financials.years.map((year, index) => ({
    year,
    dscr: kpis.dscrByYear?.[index] ?? null,
    threshold: 1.2,
  }));

  const tariffData = result.timeline
    .filter((_, index) => index % 6 === 0)
    .map((period, index) => ({
      label: period.startDate.slice(0, 7),
      tariff: result.monthly.rev.commercialTariff[index * 6],
    }));

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border-soft)] px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Deal Summary</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-main)]">{current.projectName}</h1>
                <Badge variant="success">Model complete</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Last model run</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                {current.lastRunAt ? new Date(current.lastRunAt).toLocaleString() : 'Not available'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)] px-6 py-6 xl:border-b-0 xl:border-r">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Headline Metrics</div>
            <div className="mt-4 space-y-4">
              <MetricLine label="Total Capex" value={fmtMillions(kpis.totalCapex, 1)} note="inclusive of VAT, contingency, and management" />
              <MetricLine label="Target Tariff" value={`NGN ${fmtNumber(kpis.targetTariff, 2)} / kWh`} note="modeled commercial tariff" />
              <MetricLine label="Break-even Tariff" value={`NGN ${fmtNumber(kpis.breakevenTariff, 2)} / kWh`} note="minimum cost-cover tariff" />
              <MetricLine label="Project IRR" value={fmtPct(kpis.projectIRR, 1)} note="unlevered project return" />
              <MetricLine label="Equity IRR" value={fmtPct(kpis.equityIRR, 1)} note="equity investor return" />
              <MetricLine label="Average DSCR" value={fmtMultiplier(kpis.avgDSCR)} note={`minimum ${fmtMultiplier(kpis.minDSCR)}`} />
              <MetricLine label="Payback Year" value={kpis.paybackYear || '-'} note="first positive cumulative year" />
            </div>
          </div>

          <div className="px-6 py-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <SummaryTable
                title="Project Configuration"
                rows={[
                  ['System Capacity', `${fmtNumber(kpis.systemCapacityKWp)} kWp`],
                  ['Battery Capacity', `${fmtNumber(kpis.batteryCapacityKWh)} kWh`],
                  ['Inverter Capacity', `${fmtNumber(kpis.inverterCapacityKW)} kW`],
                  ['Project NPV', fmtMillions(kpis.projectNPV, 1)],
                ]}
              />
              <SummaryTable
                title="Commercial Position"
                rows={[
                  ['Target Tariff', `NGN ${fmtNumber(kpis.targetTariff, 2)} / kWh`],
                  ['Break-even Tariff', `NGN ${fmtNumber(kpis.breakevenTariff, 2)} / kWh`],
                  ['Average DSCR', fmtMultiplier(kpis.avgDSCR)],
                  ['Payback Year', kpis.paybackYear || '-'],
                ]}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-5">
              <div className="text-sm font-semibold text-[var(--text-main)]">Management Note</div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                The current case indicates a total project investment of {fmtMillions(kpis.totalCapex, 1)} with a target tariff of NGN {fmtNumber(kpis.targetTariff, 2)} per kWh.
                The return profile is supported by a project IRR of {fmtPct(kpis.projectIRR, 1)} and an equity IRR of {fmtPct(kpis.equityIRR, 1)}, while coverage remains at an average DSCR of {fmtMultiplier(kpis.avgDSCR)}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border-soft)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Performance Support</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            These are the only charts retained on the summary page because they directly support an executive review.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <ChartBlock title="Revenue, EBITDA, and Profit After Tax">
            <ComposedChart data={performanceData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="year" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip {...tooltipStyle} formatter={(value) => `NGN ${value.toFixed(1)}M`} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#312783" name="Revenue" />
              <Line type="monotone" dataKey="ebitda" stroke="#36a9e1" strokeWidth={2.5} dot={{ r: 3, fill: '#36a9e1' }} name="EBITDA" />
              <Line type="monotone" dataKey="pat" stroke="#1f6a8e" strokeWidth={2.5} dot={{ r: 3, fill: '#1f6a8e' }} name="PAT" />
            </ComposedChart>
          </ChartBlock>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartBlock title="Debt Service Coverage Ratio">
              <ComposedChart data={dscrData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} domain={[0, 'auto']} />
                <Tooltip {...tooltipStyle} formatter={(value) => (value === null ? '-' : `${value.toFixed(2)}x`)} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dscr" fill="#312783" name="DSCR" />
                <Line type="monotone" dataKey="threshold" stroke="#36a9e1" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Threshold 1.2x" />
              </ComposedChart>
            </ChartBlock>

            <ChartBlock title="Tariff Escalation Curve">
              <LineChart data={tariffData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} minTickGap={20} />
                <YAxis {...chartAxisProps} domain={['auto', 'auto']} />
                <Tooltip {...tooltipStyle} formatter={(value) => `NGN ${value.toFixed(2)}`} />
                <Line type="monotone" dataKey="tariff" stroke="#312783" strokeWidth={2.5} dot={false} name="Commercial Tariff" />
              </LineChart>
            </ChartBlock>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricLine({ label, value, note }) {
  return (
    <div className="border-b border-[var(--border-soft)] pb-4 last:border-b-0 last:pb-0">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">{note}</div>
    </div>
  );
}

function SummaryTable({ title, rows }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border-soft)] px-5 py-4">
        <div className="text-sm font-semibold text-[var(--text-main)]">{title}</div>
      </div>
      <div className="px-5 py-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] py-3 last:border-b-0 last:pb-0 first:pt-0">
            <div className="text-sm text-[var(--text-muted)]">{label}</div>
            <div className="text-sm font-semibold text-[var(--text-main)]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartBlock({ title, children }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]">
      <div className="border-b border-[var(--border-soft)] px-5 py-4">
        <div className="text-sm font-semibold text-[var(--text-main)]">{title}</div>
      </div>
      <div className="h-[340px] px-4 py-4">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
