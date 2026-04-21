import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions } from '../lib/utils.js';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const CATEGORY_COLORS = ['#312783', '#36a9e1', '#0f766e', '#c2410c', '#475569', '#047857', '#1d4ed8', '#9a3412'];

export default function Depreciation() {
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

  const depreciation = current.result.depreciation;
  const years = depreciation.years;
  const categories = depreciation.categories;
  const chartData = years.map((year, index) => {
    const row = { year };
    categories.forEach((category) => {
      row[category.label] = depreciation.schedules[category.key].depreciation[index] / 1e6;
    });
    return row;
  });

  const buildCategoryRows = (categoryKey) => {
    const schedule = depreciation.schedules[categoryKey];
    return [
      { label: 'Opening balance', arr: schedule.opening },
      { label: 'Additions', arr: schedule.added },
      { label: 'Closing balance', arr: schedule.closing },
      { label: 'Depreciation (year)', arr: schedule.depreciation, bold: true },
      { label: 'Cumulative depreciation', arr: schedule.cumulativeDep },
      { label: 'Net book value', arr: schedule.nbv, bold: true },
    ];
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Schedules</div>
        <h1 className="text-2xl font-semibold text-[var(--text-main)]">Depreciation</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yearly Depreciation by Category</CardTitle>
          <CardDescription>Stacked view of the annual depreciation charge by asset class.</CardDescription>
        </CardHeader>
        <CardBody className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="year" stroke="#667085" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis stroke="#667085" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12, color: 'var(--text-main)' }} formatter={(value) => `NGN ${value.toFixed(1)}M`} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {categories.map((category, index) => <Bar key={category.key} dataKey={category.label} stackId="a" fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Schedules</CardTitle>
          <CardDescription>Opening, additions, depreciation, and net book value by category.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs defaultValue={categories[0].key}>
            <TabsList className="w-full flex-wrap">
              {categories.map((category) => <TabsTrigger key={category.key} value={category.key}>{category.label}</TabsTrigger>)}
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {categories.map((category) => (
              <TabsContent key={category.key} value={category.key}>
                <div className="mb-2 text-xs text-[var(--text-muted)]">Useful life: {category.life} years</div>
                <Table>
                  <THead>
                    <TR>
                      <TH>Item</TH>
                      {years.map((year) => <TH key={year} align="right">{year}</TH>)}
                    </TR>
                  </THead>
                  <TBody>
                    {buildCategoryRows(category.key).map((row) => (
                      <TR key={row.label}>
                        <TD className={row.bold ? 'font-semibold' : ''}>{row.label}</TD>
                        {row.arr.map((value, index) => <TD key={`${row.label}-${index}`} align="right" className={row.bold ? 'font-semibold' : ''}>{fmtMillions(value, 1)}</TD>)}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TabsContent>
            ))}

            <TabsContent value="summary">
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    {years.map((year) => <TH key={year} align="right">{year}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <TR><TD>Opening</TD>{depreciation.summary.opening.map((value, index) => <TD key={index} align="right">{fmtMillions(value, 1)}</TD>)}</TR>
                  <TR><TD>Additions</TD>{depreciation.summary.added.map((value, index) => <TD key={index} align="right">{fmtMillions(value, 1)}</TD>)}</TR>
                  <TR><TD>Closing</TD>{depreciation.summary.closing.map((value, index) => <TD key={index} align="right">{fmtMillions(value, 1)}</TD>)}</TR>
                  <TR className="bg-[var(--surface-muted)] font-semibold"><TD>Depreciation</TD>{depreciation.summary.depreciation.map((value, index) => <TD key={index} align="right">{fmtMillions(value, 1)}</TD>)}</TR>
                  <TR><TD>Cumulative dep.</TD>{depreciation.summary.cumulativeDep.map((value, index) => <TD key={index} align="right">{fmtMillions(value, 1)}</TD>)}</TR>
                  <TR className="bg-primary-50 font-semibold"><TD className="text-primary">Net book value</TD>{depreciation.summary.nbv.map((value, index) => <TD key={index} align="right" className="text-primary">{fmtMillions(value, 1)}</TD>)}</TR>
                </TBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
