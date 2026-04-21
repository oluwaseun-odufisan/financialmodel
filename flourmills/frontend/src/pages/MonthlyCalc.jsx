import { useMemo, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender, getFilteredRowModel,
} from '@tanstack/react-table';
import { Input } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { ArrowUpDown, Search } from 'lucide-react';

const fmt = (value, decimals = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '-'
    : Number(value).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function DataTable({ columns, data }) {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input value={globalFilter ?? ''} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Search by month, year, or phase" className="h-10 pl-9" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{table.getRowModel().rows.length} rows</div>
      </div>

      <div className="overflow-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap border-r border-[var(--border-soft)] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] last:border-r-0">
                    {header.isPlaceholder ? null : (
                      <button type="button" className="flex items-center gap-1 hover:text-[var(--text-main)]" onClick={header.column.getToggleSortingHandler?.()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border-soft)] last:border-b-0 hover:bg-[var(--surface-muted)]/70">
                {row.getVisibleCells().map((cell, index) => (
                  <td key={cell.id} className={`whitespace-nowrap border-r border-[var(--border-soft)] px-3 py-2 last:border-r-0 ${index > 4 ? 'num' : ''}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MonthlyCalc() {
  const { current } = useProject();

  const data = useMemo(() => {
    if (!current?.result) return [];
    const result = current.result;
    const monthly = result.monthly;
    return result.timeline.map((timeline, index) => ({
      counter: timeline.counter,
      startDate: timeline.startDate.slice(0, 10),
      endDate: timeline.endDate.slice(0, 10),
      days: timeline.daysInPeriod,
      phase: timeline.description,
      solarKwh: monthly.rev.solarEnergyKwh[index],
      commercialEnergy: monthly.rev.commercialEnergy[index],
      anchorTariff: monthly.rev.anchorTariff[index],
      commercialTariff: monthly.rev.commercialTariff[index],
      escalationFactor: monthly.rev.escalationFactor[index],
      totalRevenue: monthly.rev.totalRevenue[index],
      dieselCost: monthly.cost.dieselTotalCost[index],
      generatorOM: monthly.cost.generatorOMTotal[index],
      insurance: monthly.cost.insurance[index],
      staffComp: monthly.cost.staffCompensation[index],
      totalOpex: monthly.cost.totalOperatingCost[index],
      capex: monthly.capexMonthly.totalCapex[index],
      bridgeDraw: monthly.bridge.drawdown[index],
      bridgeInt: monthly.bridge.interestPayment[index],
      bridgePrin: monthly.bridge.principalRepayment[index],
      bridgeOutstanding: monthly.bridge.outstanding[index],
      seniorDraw: monthly.senior.drawdown[index],
      seniorInt: monthly.senior.interestPayment[index],
      seniorPrin: monthly.senior.principalRepayment[index],
      seniorOutstanding: monthly.senior.outstanding[index],
      equityDraw: monthly.equity.drawdown[index],
      equityCum: monthly.equity.cumulative[index],
    }));
  }, [current]);

  const makeNumberColumn = (label, key, options = {}) => ({
    header: label,
    accessorKey: key,
    cell: ({ getValue }) => fmt(getValue(), options.decimals ?? 0),
    enableSorting: options.sort !== false,
  });

  const headerCols = [
    { header: '#', accessorKey: 'counter', cell: (cell) => cell.getValue() },
    { header: 'Start', accessorKey: 'startDate', cell: (cell) => cell.getValue() },
    { header: 'End', accessorKey: 'endDate', cell: (cell) => cell.getValue() },
    { header: 'Days', accessorKey: 'days', cell: (cell) => cell.getValue() },
    {
      header: 'Phase',
      accessorKey: 'phase',
      cell: (cell) => {
        const value = cell.getValue();
        const className = value === 'Ops'
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : value === 'Cons.'
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-primary-100 bg-primary-50 text-primary';
        return <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${className}`}>{value}</span>;
      },
    },
  ];

  const revenueCols = [...headerCols, makeNumberColumn('Solar kWh', 'solarKwh'), makeNumberColumn('Commercial kWh', 'commercialEnergy'), makeNumberColumn('Anchor Tariff', 'anchorTariff', { decimals: 2 }), makeNumberColumn('Commercial Tariff', 'commercialTariff', { decimals: 2 }), makeNumberColumn('Escalation Factor', 'escalationFactor', { decimals: 3 }), makeNumberColumn('Total Revenue', 'totalRevenue')];
  const costCols = [...headerCols, makeNumberColumn('Diesel Cost', 'dieselCost'), makeNumberColumn('Generator O&M', 'generatorOM'), makeNumberColumn('Insurance', 'insurance'), makeNumberColumn('Staff Comp', 'staffComp'), makeNumberColumn('Total Opex', 'totalOpex')];
  const capexCols = [...headerCols, makeNumberColumn('Capex', 'capex'), makeNumberColumn('Equity Draw', 'equityDraw'), makeNumberColumn('Equity Cum.', 'equityCum')];
  const bridgeCols = [...headerCols, makeNumberColumn('Bridge Draw', 'bridgeDraw'), makeNumberColumn('Bridge Int.', 'bridgeInt'), makeNumberColumn('Bridge Prin.', 'bridgePrin'), makeNumberColumn('Bridge Outs.', 'bridgeOutstanding')];
  const seniorCols = [...headerCols, makeNumberColumn('Senior Draw', 'seniorDraw'), makeNumberColumn('Senior Int.', 'seniorInt'), makeNumberColumn('Senior Prin.', 'seniorPrin'), makeNumberColumn('Senior Outs.', 'seniorOutstanding')];

  if (!current) return <div className="text-sm text-[var(--text-muted)]">Loading...</div>;
  if (!current.result) {
    return (
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-12 text-center shadow-card">
        <div className="text-lg font-semibold text-[var(--text-main)]">No model results yet</div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Run the model from the navbar to populate the monthly engine schedule.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border-soft)] px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">M.Calculation</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Monthly ledger</h1>
        </div>

        <div className="grid gap-0 border-b border-[var(--border-soft)] md:grid-cols-3">
          <LedgerStat label="Timeline length" value={`${data.length} months`} />
          <LedgerStat label="Structure" value="Development to operations" />
          <LedgerStat label="Source" value="Computed by model engine" />
        </div>

        <div className="px-6 py-5">
          <Tabs defaultValue="revenue">
            <TabsList className="w-full flex-wrap justify-start">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="cost">Opex</TabsTrigger>
              <TabsTrigger value="capex">Capex + Equity</TabsTrigger>
              <TabsTrigger value="bridge">Bridge Loan</TabsTrigger>
              <TabsTrigger value="senior">Senior Debt</TabsTrigger>
            </TabsList>
            <TabsContent value="revenue"><DataTable columns={revenueCols} data={data} /></TabsContent>
            <TabsContent value="cost"><DataTable columns={costCols} data={data} /></TabsContent>
            <TabsContent value="capex"><DataTable columns={capexCols} data={data} /></TabsContent>
            <TabsContent value="bridge"><DataTable columns={bridgeCols} data={data} /></TabsContent>
            <TabsContent value="senior"><DataTable columns={seniorCols} data={data} /></TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

function LedgerStat({ label, value }) {
  return (
    <div className="border-b border-[var(--border-soft)] px-6 py-4 last:border-b-0 md:border-b-0 md:border-r last:md:border-r-0">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--text-main)]">{value}</div>
    </div>
  );
}
