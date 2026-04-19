import { useMemo, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender, getFilteredRowModel,
} from '@tanstack/react-table';
import { Card, CardBody, CardDescription, CardHeader, CardTitle, Input } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { ArrowUpDown, Search } from 'lucide-react';

const fmt = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—'
    : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function DataTable({ columns, data }) {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data, columns, state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)}
               placeholder="Search (year, month, phase…)" className="pl-9 h-9" />
      </div>
      <div className="border border-border rounded-lg bg-white overflow-auto max-h-[650px]">
        <table className="w-full text-sm">
          <thead className="bg-offwhite sticky top-0 z-10 border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide text-muted text-left whitespace-nowrap border-r border-border last:border-r-0">
                    {h.isPlaceholder ? null : (
                      <button
                        className="flex items-center gap-1 hover:text-ink"
                        onClick={h.column.getToggleSortingHandler?.()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-offwhite/50">
                {row.getVisibleCells().map((c, i) => (
                  <td key={c.id}
                      className={`px-3 py-1.5 whitespace-nowrap border-r border-border last:border-r-0 ${i > 4 ? 'num' : ''}`}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted">{table.getRowModel().rows.length} rows</div>
    </div>
  );
}

export default function MonthlyCalc() {
  const { current } = useProject();

  const data = useMemo(() => {
    if (!current?.result) return [];
    const r = current.result;
    const m = r.monthly;
    return r.timeline.map((t, i) => ({
      counter: t.counter,
      startDate: t.startDate.slice(0, 10),
      endDate:   t.endDate.slice(0, 10),
      days: t.daysInPeriod,
      phase: t.description,
      // Revenue
      solarKwh: m.rev.solarEnergyKwh[i],
      commercialEnergy: m.rev.commercialEnergy[i],
      anchorTariff: m.rev.anchorTariff[i],
      commercialTariff: m.rev.commercialTariff[i],
      escalationFactor: m.rev.escalationFactor[i],
      totalRevenue: m.rev.totalRevenue[i],
      // Cost
      dieselCost: m.cost.dieselTotalCost[i],
      generatorOM: m.cost.generatorOMTotal[i],
      insurance: m.cost.insurance[i],
      staffComp: m.cost.staffCompensation[i],
      totalOpex: m.cost.totalOperatingCost[i],
      // Capex
      capex: m.capexMonthly.totalCapex[i],
      // Bridge
      bridgeDraw: m.bridge.drawdown[i],
      bridgeInt: m.bridge.interestPayment[i],
      bridgePrin: m.bridge.principalRepayment[i],
      bridgeOutstanding: m.bridge.outstanding[i],
      // Senior
      seniorDraw: m.senior.drawdown[i],
      seniorInt: m.senior.interestPayment[i],
      seniorPrin: m.senior.principalRepayment[i],
      seniorOutstanding: m.senior.outstanding[i],
      // Equity
      equityDraw: m.equity.drawdown[i],
      equityCum: m.equity.cumulative[i],
    }));
  }, [current]);

  /* ----- Columns per tab ----- */
  const cn = (label, key, opts = {}) => ({
    header: label,
    accessorKey: key,
    cell: ({ getValue }) => fmt(getValue(), opts.decimals ?? 0),
    enableSorting: opts.sort !== false,
  });

  const headerCols = [
    { header: '#',     accessorKey: 'counter', cell: (c) => c.getValue() },
    { header: 'Start', accessorKey: 'startDate', cell: (c) => c.getValue() },
    { header: 'End',   accessorKey: 'endDate',   cell: (c) => c.getValue() },
    { header: 'Days',  accessorKey: 'days',      cell: (c) => c.getValue() },
    { header: 'Phase', accessorKey: 'phase', cell: (c) => {
      const v = c.getValue();
      const cls = v === 'Ops' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : v === 'Cons.' ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-primary-50 text-primary border-primary-100';
      return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>{v}</span>;
    } },
  ];

  const revenueCols = [...headerCols,
    cn('Solar kWh',          'solarKwh'),
    cn('Commercial kWh',     'commercialEnergy'),
    cn('Anchor Tariff',      'anchorTariff', { decimals: 2 }),
    cn('Commercial Tariff',  'commercialTariff', { decimals: 2 }),
    cn('Escalation Factor',  'escalationFactor', { decimals: 3 }),
    cn('Total Revenue',      'totalRevenue'),
  ];

  const costCols = [...headerCols,
    cn('Diesel Cost',   'dieselCost'),
    cn('Generator O&M', 'generatorOM'),
    cn('Insurance',     'insurance'),
    cn('Staff Comp',    'staffComp'),
    cn('Total Opex',    'totalOpex'),
  ];

  const capexCols = [...headerCols,
    cn('Capex',        'capex'),
    cn('Equity Draw',  'equityDraw'),
    cn('Equity Cum.',  'equityCum'),
  ];

  const bridgeCols = [...headerCols,
    cn('Bridge Draw',   'bridgeDraw'),
    cn('Bridge Int.',   'bridgeInt'),
    cn('Bridge Prin.',  'bridgePrin'),
    cn('Bridge Outs.',  'bridgeOutstanding'),
  ];

  const seniorCols = [...headerCols,
    cn('Senior Draw',   'seniorDraw'),
    cn('Senior Int.',   'seniorInt'),
    cn('Senior Prin.',  'seniorPrin'),
    cn('Senior Outs.',  'seniorOutstanding'),
  ];

  if (!current) return <div className="text-sm text-muted">Loading…</div>;
  if (!current.result) {
    return (
      <Card><CardBody className="text-center py-12">
        <div className="text-lg font-semibold text-ink">No model results yet</div>
        <p className="text-sm text-muted mt-1">Click <b>Run Model</b> in the top bar to populate this page.</p>
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted uppercase tracking-wider">Monthly Engine</div>
        <h1 className="text-2xl font-semibold text-ink">M.Calculation</h1>
        <p className="text-sm text-muted mt-1">
          {data.length}-month timeline · Dev → Construction → Operations · all cells computed by the engine
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-month detail</CardTitle>
          <CardDescription>Read-only. Switch tabs for revenue, cost, capex, bridge, senior debt.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs defaultValue="revenue">
            <TabsList>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="cost">Opex</TabsTrigger>
              <TabsTrigger value="capex">Capex + Equity</TabsTrigger>
              <TabsTrigger value="bridge">Bridge Loan</TabsTrigger>
              <TabsTrigger value="senior">Senior Debt</TabsTrigger>
            </TabsList>
            <TabsContent value="revenue"><DataTable columns={revenueCols} data={data} /></TabsContent>
            <TabsContent value="cost">   <DataTable columns={costCols}    data={data} /></TabsContent>
            <TabsContent value="capex">  <DataTable columns={capexCols}   data={data} /></TabsContent>
            <TabsContent value="bridge"> <DataTable columns={bridgeCols}  data={data} /></TabsContent>
            <TabsContent value="senior"> <DataTable columns={seniorCols}  data={data} /></TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
