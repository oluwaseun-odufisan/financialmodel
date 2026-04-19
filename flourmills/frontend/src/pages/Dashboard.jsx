import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardHeader, CardTitle, CardDescription, Button } from '../components/ui/Primitives.jsx';
import { KPICard } from '../components/KPICard.jsx';
import { fmtMillions, fmtPct, fmtMultiplier, fmtCurrency, fmtNumber } from '../lib/utils.js';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, Target, TrendingUp, Shield, Clock, Zap, Sun, Battery, Play
} from 'lucide-react';

const PRIMARY = '#312783';
const ACCENT  = '#36a9e1';

const chartAxisProps = {
  stroke: '#6b7280',
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: '#E5E7EB' },
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    fontSize: 12,
    boxShadow: '0 1px 2px 0 rgba(17,24,39,0.05)',
  },
  labelStyle: { color: '#111827', fontWeight: 600 },
};

function EmptyState() {
  const { runModel, running } = useProject();
  return (
    <Card>
      <CardBody className="text-center py-16">
        <div className="inline-flex w-12 h-12 bg-primary-50 rounded-full items-center justify-center mb-4">
          <Play size={22} className="text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Run the model to view analytics</h2>
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          The dashboard populates with KPIs, revenue projections, cash flow, DSCR, and energy curves after the first model run.
        </p>
        <Button onClick={runModel} disabled={running} size="lg" className="mt-5">
          <Play size={16} /> {running ? 'Running…' : 'Run Model'}
        </Button>
      </CardBody>
    </Card>
  );
}

export default function Dashboard() {
  const { current } = useProject();
  if (!current) return <div className="text-sm text-muted">Loading project…</div>;
  if (!current.result) return <EmptyState />;

  const r = current.result;
  const k = r.kpis;
  const f = r.financials;

  /* --- Chart data --- */
  const yearlyData = f.years.map((y, i) => ({
    year: y,
    revenue: f.incomeStatement.revenue[i] / 1e6,
    opex: -f.incomeStatement.opex[i] / 1e6,
    ebitda: f.incomeStatement.ebitda[i] / 1e6,
    pat: f.incomeStatement.profitAfterTax[i] / 1e6,
    debtService: -(f.cashFlow.principalRepayments[i] + f.cashFlow.interestPaid[i]) / 1e6,
  }));

  const cashflowData = f.years.map((y, i) => {
    let cum = 0;
    for (let j = 0; j <= i; j++) {
      cum += f.cashFlow.netCashFromOperations[j] + f.cashFlow.netCashFromInvesting[j];
    }
    return {
      year: y,
      netCashFromOps: f.cashFlow.netCashFromOperations[i] / 1e6,
      investing: f.cashFlow.netCashFromInvesting[i] / 1e6,
      cumulative: cum / 1e6,
    };
  });

  const dscrData = f.years.map((y, i) => ({
    year: y,
    dscr: k.dscrByYear?.[i] ?? null,
    threshold: 1.2,
  }));

  // Tariff escalation curve — monthly
  const tariffData = r.timeline
    .filter((_, i) => i % 6 === 0)
    .map((t, idx) => ({
      label: t.startDate.slice(0, 7),
      tariff: r.monthly.rev.commercialTariff[idx * 6],
      factor: r.monthly.rev.escalationFactor[idx * 6],
    }));

  // Energy production: aggregate by year
  const energyByYear = f.years.map((y) => {
    const idxs = r.timeline.map((t, i) => (t.year === y ? i : -1)).filter((i) => i >= 0);
    const kwh = idxs.reduce((s, i) => s + r.monthly.rev.commercialEnergy[i], 0);
    return { year: y, energyMWh: kwh / 1000 };
  });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <div className="text-xs text-muted uppercase tracking-wider">Dashboard</div>
        <h1 className="text-2xl font-semibold text-ink">{current.projectName}</h1>
        <p className="text-sm text-muted mt-1">
          3 MW Solar + BESS Hybrid Mini-Grid · Project IRR {fmtPct(k.projectIRR, 1)} · Last run{' '}
          {current.lastRunAt ? new Date(current.lastRunAt).toLocaleString() : 'n/a'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Capex"      value={fmtMillions(k.totalCapex, 1)} sublabel="Incl. VAT, mgmt, contingency" icon={DollarSign} />
        <KPICard label="Target Tariff"    value={`₦${k.targetTariff}`} sublabel="NGN per kWh" icon={Target} accent />
        <KPICard label="Project IRR"      value={fmtPct(k.projectIRR, 1)} sublabel="Unlevered" icon={TrendingUp} />
        <KPICard label="Equity IRR"       value={fmtPct(k.equityIRR, 1)} sublabel="Levered" icon={TrendingUp} accent />
        <KPICard label="Min DSCR"         value={fmtMultiplier(k.minDSCR)} sublabel={`Avg ${fmtMultiplier(k.avgDSCR)}`} icon={Shield} />
        <KPICard label="Payback"          value={k.paybackYear || '—'} sublabel="Year cash-positive" icon={Clock} accent />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="PV Capacity"    value={`${fmtNumber(k.systemCapacityKWp)} kWp`} icon={Sun} />
        <KPICard label="Battery"        value={`${fmtNumber(k.batteryCapacityKWh)} kWh`} icon={Battery} accent />
        <KPICard label="Inverter"       value={`${fmtNumber(k.inverterCapacityKW)} kW`} icon={Zap} />
        <KPICard label="Break-even Tariff" value={`₦${fmtNumber(k.breakevenTariff, 2)}`} sublabel="NGN per kWh" icon={Target} accent />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Opex</CardTitle>
            <CardDescription>NGN Millions · yearly</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip {...tooltipStyle} formatter={(v) => `₦${v.toFixed(1)}M`} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill={PRIMARY} name="Revenue" />
                <Bar dataKey="opex"    fill={ACCENT}  name="Opex" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>EBITDA vs PAT</CardTitle>
            <CardDescription>NGN Millions · yearly</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip {...tooltipStyle} formatter={(v) => `₦${v.toFixed(1)}M`} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ebitda" stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 3, fill: PRIMARY }} name="EBITDA" />
                <Line type="monotone" dataKey="pat"    stroke={ACCENT}  strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }}  name="PAT" />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Project Cash</CardTitle>
            <CardDescription>NGN Millions · net of capex + operations</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip {...tooltipStyle} formatter={(v) => `₦${v.toFixed(1)}M`} />
                <Area type="monotone" dataKey="cumulative" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.12} strokeWidth={2.5} name="Cumulative Cash" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debt Service Coverage Ratio</CardTitle>
            <CardDescription>EBITDA ÷ Debt service · threshold 1.2x</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dscrData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} domain={[0, 'auto']} />
                <Tooltip {...tooltipStyle} formatter={(v) => (v === null ? '—' : `${v.toFixed(2)}x`)} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dscr" fill={PRIMARY} name="DSCR" />
                <Line type="monotone" dataKey="threshold" stroke={ACCENT} strokeWidth={2} strokeDasharray="4 4" dot={false} name="Threshold 1.2x" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tariff Escalation Curve</CardTitle>
            <CardDescription>NGN per kWh · sampled semi-annually</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tariffData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} minTickGap={20} />
                <YAxis {...chartAxisProps} domain={['auto', 'auto']} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === 'tariff' ? `₦${v.toFixed(2)}` : v.toFixed(3))} />
                <Line type="monotone" dataKey="tariff" stroke={PRIMARY} strokeWidth={2.5} dot={false} name="Commercial Tariff" />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Energy Production</CardTitle>
            <CardDescription>MWh delivered per year</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyByYear} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="year" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip {...tooltipStyle} formatter={(v) => `${v.toFixed(0)} MWh`} />
                <Bar dataKey="energyMWh" fill={ACCENT} name="Energy (MWh)" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Debt service breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>EBITDA vs Debt Service</CardTitle>
          <CardDescription>NGN Millions · coverage visualization</CardDescription>
        </CardHeader>
        <CardBody className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={yearlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="year" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip {...tooltipStyle} formatter={(v) => `₦${v.toFixed(1)}M`} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ebitda" fill={PRIMARY} name="EBITDA" />
              <Bar dataKey="debtService" fill={ACCENT} name="Debt Service" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}
