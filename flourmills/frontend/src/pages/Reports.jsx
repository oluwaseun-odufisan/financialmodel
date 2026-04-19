import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardDescription, CardHeader, CardTitle, Badge } from '../components/ui/Primitives.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions, fmtPct, fmtMultiplier } from '../lib/utils.js';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

const PRIMARY = '#312783';
const ACCENT  = '#36a9e1';

export default function Reports() {
  const { current } = useProject();
  if (!current) return <div className="text-sm text-muted">Loading…</div>;
  if (!current.result) {
    return (
      <Card><CardBody className="text-center py-12">
        <div className="text-lg font-semibold text-ink">No model results yet</div>
        <p className="text-sm text-muted mt-1">Click <b>Run Model</b> to populate this page.</p>
      </CardBody></Card>
    );
  }

  const r = current.result;
  const sens = r.sensitivity || [];
  const base = sens.find(s => s.scenario === 'Base Case') || sens[0];

  const dscrData = r.financials.years.map((y, i) => ({
    year: y,
    dscr: r.kpis.dscrByYear?.[i] ?? null,
    threshold: 1.2,
  }));

  const sensData = sens.map((s) => ({
    name: s.scenario,
    IRR: s.projectIRR ? s.projectIRR * 100 : 0,
    equityIRR: s.equityIRR ? s.equityIRR * 100 : 0,
    DSCR: s.avgDSCR || 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted uppercase tracking-wider">Analysis</div>
        <h1 className="text-2xl font-semibold text-ink">Reports</h1>
        <p className="text-sm text-muted mt-1">Sensitivity analysis · DSCR schedule · scenario comparison</p>
      </div>

      {/* Sensitivity table */}
      <Card>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
          <CardDescription>Base case + key shocks on tariff / capex / opex</CardDescription>
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
            {sens.map((s) => {
              const isBase = s.scenario === 'Base Case';
              return (
                <TR key={s.scenario} className={isBase ? 'bg-primary-50' : ''}>
                  <TD className={isBase ? 'font-semibold text-primary' : 'font-medium'}>
                    {s.scenario}
                    {isBase && <Badge variant="primary" className="ml-2">Base</Badge>}
                  </TD>
                  <TD align="right">₦{s.targetTariff.toFixed(2)}</TD>
                  <TD align="right">{fmtPct(s.projectIRR, 1)}</TD>
                  <TD align="right">{fmtPct(s.equityIRR, 1)}</TD>
                  <TD align="right">{fmtMillions(s.projectNPV, 1)}</TD>
                  <TD align="right">{fmtMultiplier(s.avgDSCR)}</TD>
                  <TD align="right">{fmtMultiplier(s.minDSCR)}</TD>
                  <TD align="center">{s.paybackYear || '—'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {/* Sensitivity bar chart - IRR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Project IRR Sensitivity</CardTitle>
            <CardDescription>% per scenario</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sensData} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} angle={-25} textAnchor="end" height={60} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }} formatter={(v) => `${v.toFixed(1)}%`} />
                <Bar dataKey="IRR" fill={PRIMARY}>
                  {sensData.map((d, i) => <Cell key={i} fill={d.name === 'Base Case' ? ACCENT : PRIMARY} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DSCR by Year</CardTitle>
            <CardDescription>EBITDA ÷ debt service · threshold 1.2×</CardDescription>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dscrData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="year" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }} formatter={(v) => v === null ? '—' : `${v.toFixed(2)}x`} />
                <Bar dataKey="dscr">
                  {dscrData.map((d, i) => <Cell key={i} fill={(d.dscr ?? 0) >= 1.2 ? PRIMARY : '#DC2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* DSCR detailed table */}
      <Card>
        <CardHeader>
          <CardTitle>DSCR Detail</CardTitle>
          <CardDescription>Annual coverage ratios</CardDescription>
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
            {r.financials.years.map((y, i) => {
              const ebitda = r.financials.incomeStatement.ebitda[i];
              const ds = -(r.financials.cashFlow.principalRepayments[i] + r.financials.cashFlow.interestPaid[i]);
              const dscr = r.kpis.dscrByYear?.[i];
              return (
                <TR key={y}>
                  <TD className="font-medium">{y}</TD>
                  <TD align="right">{fmtMillions(ebitda, 1)}</TD>
                  <TD align="right">{fmtMillions(ds, 1)}</TD>
                  <TD align="right" className="font-semibold">{fmtMultiplier(dscr)}</TD>
                  <TD align="center">
                    {dscr === null || dscr === undefined ? <Badge variant="neutral">—</Badge>
                      : dscr >= 1.4 ? <Badge variant="success">Strong</Badge>
                      : dscr >= 1.2 ? <Badge variant="accent">Adequate</Badge>
                      : <Badge variant="danger">Breach</Badge>}
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
