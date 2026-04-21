import { useProject } from '../contexts/ProjectContext.jsx';
import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Primitives.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions, fmtMultiplier, fmtPct } from '../lib/utils.js';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PRIMARY = '#312783';
const ACCENT = '#36a9e1';
const SCENARIO_COLORS = ['#312783', '#36a9e1', '#0f766e', '#c2410c', '#475569', '#047857', '#1d4ed8', '#7c3aed'];

const axisProps = {
  stroke: '#667085',
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: '#D7DEE7' },
};

const tooltipProps = {
  contentStyle: { backgroundColor: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12, color: 'var(--text-main)' },
};

export default function Reports() {
  const { current } = useProject();
  if (!current) return <div className="text-sm text-[var(--text-muted)]">Loading...</div>;

  if (!current.result) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <div className="text-lg font-semibold text-[var(--text-main)]">No model results yet</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Click <b>Run Model</b> to populate this page.</p>
        </CardBody>
      </Card>
    );
  }

  const result = current.result;
  const sensitivity = result.sensitivity || [];
  const dscrData = result.financials.years.map((year, index) => ({ year, dscr: result.kpis.dscrByYear?.[index] ?? null, covenant: 1.2 }));
  const sensitivityData = sensitivity.map((scenario) => ({ name: scenario.scenario, irr: scenario.projectIRR ? scenario.projectIRR * 100 : 0 }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Analysis</div>
        <h1 className="text-2xl font-semibold text-[var(--text-main)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Sensitivity analysis · DSCR schedule · scenario comparison</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
          <CardDescription>Base case and modeled downside/upside scenario impact on returns and coverage.</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Scenario</TH>
              <TH align="right">Target Tariff</TH>
              <TH align="right">Project IRR</TH>
              <TH align="right">Equity IRR</TH>
              <TH align="right">Project NPV</TH>
              <TH align="right">Avg DSCR</TH>
              <TH align="right">Min DSCR</TH>
              <TH align="center">Payback</TH>
            </TR>
          </THead>
          <TBody>
            {sensitivity.map((scenario) => {
              const isBase = scenario.scenario === 'Base Case';
              return (
                <TR key={scenario.scenario} className={isBase ? 'bg-primary-50' : ''}>
                  <TD className={isBase ? 'font-semibold text-primary' : 'font-medium'}>{scenario.scenario} {isBase && <Badge variant="primary" className="ml-2">Base</Badge>}</TD>
                  <TD align="right">{`NGN ${scenario.targetTariff.toFixed(2)}`}</TD>
                  <TD align="right">{fmtPct(scenario.projectIRR, 1)}</TD>
                  <TD align="right">{fmtPct(scenario.equityIRR, 1)}</TD>
                  <TD align="right">{fmtMillions(scenario.projectNPV, 1)}</TD>
                  <TD align="right">{fmtMultiplier(scenario.avgDSCR)}</TD>
                  <TD align="right">{fmtMultiplier(scenario.minDSCR)}</TD>
                  <TD align="center">{scenario.paybackYear || '-'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project IRR by Scenario</CardTitle>
            <CardDescription>Simple comparison of return sensitivity across modeled cases.</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sensitivityData} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" {...axisProps} angle={-22} textAnchor="end" height={56} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipProps} formatter={(value) => `${value.toFixed(1)}%`} />
                <Bar dataKey="irr">
                  {sensitivityData.map((item, index) => <Cell key={item.name} fill={item.name === 'Base Case' ? ACCENT : SCENARIO_COLORS[index % SCENARIO_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DSCR Trend</CardTitle>
            <CardDescription>Annual coverage compared against the 1.2x covenant line.</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dscrData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="year" {...axisProps} />
                <YAxis {...axisProps} domain={[0, 'auto']} />
                <Tooltip {...tooltipProps} formatter={(value) => (value === null ? '-' : `${value.toFixed(2)}x`)} />
                <Line type="monotone" dataKey="dscr" stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 3, fill: PRIMARY }} name="DSCR" />
                <Line type="monotone" dataKey="covenant" stroke="#DC2626" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Covenant 1.2x" />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DSCR Detail</CardTitle>
          <CardDescription>Annual coverage ratios and covenant health indicators.</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Year</TH>
              <TH align="right">EBITDA</TH>
              <TH align="right">Debt Service</TH>
              <TH align="right">DSCR</TH>
              <TH align="center">Status</TH>
            </TR>
          </THead>
          <TBody>
            {result.financials.years.map((year, index) => {
              const ebitda = result.financials.incomeStatement.ebitda[index];
              const debtService = -(result.financials.cashFlow.principalRepayments[index] + result.financials.cashFlow.interestPaid[index]);
              const dscr = result.kpis.dscrByYear?.[index];
              return (
                <TR key={year}>
                  <TD className="font-medium">{year}</TD>
                  <TD align="right">{fmtMillions(ebitda, 1)}</TD>
                  <TD align="right">{fmtMillions(debtService, 1)}</TD>
                  <TD align="right" className="font-semibold">{fmtMultiplier(dscr)}</TD>
                  <TD align="center">
                    {dscr === null || dscr === undefined ? <Badge variant="neutral">-</Badge> : dscr >= 1.4 ? <Badge variant="success">Strong</Badge> : dscr >= 1.2 ? <Badge variant="accent">Adequate</Badge> : <Badge variant="danger">Breach</Badge>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
