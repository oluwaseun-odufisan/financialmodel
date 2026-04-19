import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions, fmtNumber } from '../lib/utils.js';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PRIMARY = '#312783';
const ACCENT  = '#36a9e1';

export default function Depreciation() {
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

  const d = current.result.depreciation;
  const years = d.years;
  const cats = d.categories;

  const chartData = years.map((y, i) => {
    const row = { year: y };
    cats.forEach((c) => { row[c.label] = d.schedules[c.key].depreciation[i] / 1e6; });
    return row;
  });

  const buildCategoryRows = (catKey) => {
    const s = d.schedules[catKey];
    return [
      { label: 'Opening balance',         arr: s.opening },
      { label: 'Additions',               arr: s.added },
      { label: 'Closing balance',         arr: s.closing },
      { label: 'Depreciation (year)',     arr: s.depreciation, bold: true },
      { label: 'Cumulative depreciation', arr: s.cumulativeDep },
      { label: 'Net book value',          arr: s.nbv, bold: true },
    ];
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted uppercase tracking-wider">Schedules</div>
        <h1 className="text-2xl font-semibold text-ink">Depreciation</h1>
        <p className="text-sm text-muted mt-1">
          Straight-line, 10-year useful life · per asset class · values in NGN Millions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yearly Depreciation by Category</CardTitle>
          <CardDescription>Stacked bar, NGN Millions</CardDescription>
        </CardHeader>
        <CardBody className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="year" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => `₦${v.toFixed(1)}M`}
              />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {cats.map((c, i) => (
                <Bar key={c.key} dataKey={c.label} stackId="a" fill={i % 2 === 0 ? PRIMARY : ACCENT} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Schedules</CardTitle>
          <CardDescription>Opening → Additions → Closing · Depreciation → NBV</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs defaultValue={cats[0].key}>
            <TabsList className="flex-wrap">
              {cats.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>
            {cats.map((c) => (
              <TabsContent key={c.key} value={c.key}>
                <div className="text-xs text-muted mb-2">Useful life: {c.life} years</div>
                <Table>
                  <THead><TR><TH>Item</TH>{years.map((y) => <TH key={y} align="right">{y}</TH>)}</TR></THead>
                  <TBody>
                    {buildCategoryRows(c.key).map((r) => (
                      <TR key={r.label}>
                        <TD className={r.bold ? 'font-semibold' : ''}>{r.label}</TD>
                        {r.arr.map((v, i) => (
                          <TD key={i} align="right" className={r.bold ? 'font-semibold' : ''}>{fmtMillions(v, 1)}</TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TabsContent>
            ))}
            <TabsContent value="summary">
              <Table>
                <THead><TR><TH>Item</TH>{years.map((y) => <TH key={y} align="right">{y}</TH>)}</TR></THead>
                <TBody>
                  <TR><TD>Opening</TD>{d.summary.opening.map((v,i) => <TD key={i} align="right">{fmtMillions(v,1)}</TD>)}</TR>
                  <TR><TD>Additions</TD>{d.summary.added.map((v,i) => <TD key={i} align="right">{fmtMillions(v,1)}</TD>)}</TR>
                  <TR><TD>Closing</TD>{d.summary.closing.map((v,i) => <TD key={i} align="right">{fmtMillions(v,1)}</TD>)}</TR>
                  <TR className="font-semibold bg-offwhite"><TD>Depreciation</TD>{d.summary.depreciation.map((v,i) => <TD key={i} align="right">{fmtMillions(v,1)}</TD>)}</TR>
                  <TR><TD>Cumulative dep.</TD>{d.summary.cumulativeDep.map((v,i) => <TD key={i} align="right">{fmtMillions(v,1)}</TD>)}</TR>
                  <TR className="font-semibold bg-primary-50"><TD className="text-primary">Net book value</TD>{d.summary.nbv.map((v,i) => <TD key={i} align="right" className="text-primary">{fmtMillions(v,1)}</TD>)}</TR>
                </TBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
