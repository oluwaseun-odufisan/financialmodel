import { useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Button, Input, Badge } from '../components/ui/Primitives.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table.jsx';
import { fmtCurrency } from '../lib/utils.js';
import { Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

const ROWS = [
  { key: 'solarPV', label: 'Solar PV', note: 'Panels, mounting, DC cabling' },
  { key: 'invertersAccessories', label: 'Inverters & Accessories', note: 'Hybrid inverters and AC cabling' },
  { key: 'energyStorage', label: 'Energy Storage', note: 'LFP batteries' },
  { key: 'ccmpptStringInverter', label: 'CCMPPT / String Inverter', note: 'String-level MPPT' },
  { key: 'distributionBox', label: 'Distribution Box', note: 'AC/DC distribution panels' },
  { key: 'balanceOfSystems', label: 'Balance of Systems', note: 'Protection, bus-bars, hardware' },
  { key: 'otherAccessories', label: 'Other Accessories', note: 'Cable trays, fire, miscellaneous' },
  { key: 'generalCostsCivilWorks', label: 'Civil Works', note: 'Civil, structural, earthing' },
  { key: 'others', label: 'Others', note: 'Residual line items' },
];

export default function BOQ() {
  const { current, updateAssumptionDeep } = useProject();
  const [values, setValues] = useState({});
  const [adders, setAdders] = useState({ vatRate: 0.075, contingencyRate: 0.2, managementRate: 0.15 });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    if (current) {
      setValues({ ...current.assumption.boq });
      setAdders({ ...current.assumption.capexAdders });
      setDirty(false);
    }
  }, [current?._id || current?.id]);

  const setVal = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: Number(value) || 0 }));
    setDirty(true);
  };

  const setAdd = (key, value) => {
    setAdders((prev) => ({ ...prev, [key]: Number(value) || 0 }));
    setDirty(true);
  };

  const subTotal = ROWS.slice(0, 8).reduce((sum, row) => sum + (values[row.key] || 0), 0);
  const vat = subTotal * (adders.vatRate || 0);
  const contingency = subTotal * (adders.contingencyRate || 0);
  const management = subTotal * (adders.managementRate || 0);
  const others = values.others || 0;
  const total = subTotal + vat + contingency + management + others;

  if (!current) return <div className="text-sm text-[var(--text-muted)]">Loading...</div>;

  const onSave = async () => {
    setSaveState('saving');
    try {
      await updateAssumptionDeep((assumption) => {
        assumption.boq = { ...values };
        assumption.capexAdders = { ...adders };
        return assumption;
      });
      setSaveState('saved');
      setDirty(false);
      setTimeout(() => setSaveState(null), 2000);
    } catch (error) {
      setSaveState('error');
      alert(error.message);
    }
  };

  const onReset = () => {
    setValues({ ...current.assumption.boq });
    setAdders({ ...current.assumption.capexAdders });
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border-soft)] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">BOQ</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]"> Bill of Quantities</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {saveState === 'saved' && (
                <Badge variant="success">
                  <CheckCircle2 size={12} className="mr-1" />
                  Saved
                </Badge>
              )}
              {saveState === 'error' && (
                <Badge variant="danger">
                  <AlertCircle size={12} className="mr-1" />
                  Save failed
                </Badge>
              )}
              <Button variant="outline" onClick={onReset} disabled={!dirty}>
                <RotateCcw size={14} />
                Reset
              </Button>
              <Button onClick={onSave} disabled={!dirty}>
                <Save size={14} />
                Save BOQ
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="min-w-0 border-b border-[var(--border-soft)] xl:border-b-0 xl:border-r">
            <div className="overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-16">No.</TH>
                    <TH className="w-[280px]">Category</TH>
                    <TH>Description</TH>
                    <TH align="right" className="w-[180px]">Cost (NGN)</TH>
                    <TH align="right" className="w-[110px]">Share</TH>
                  </TR>
                </THead>
                <TBody>
                  {ROWS.map((row, index) => (
                    <TR key={row.key}>
                      <TD className="text-[var(--text-muted)]">{index + 1}</TD>
                      <TD className="font-medium text-[var(--text-main)]">{row.label}</TD>
                      <TD className="text-sm text-[var(--text-muted)]">{row.note}</TD>
                      <TD align="right" className="p-0 pr-3">
                        <Input
                          type="number"
                          value={values[row.key] ?? 0}
                          onChange={(event) => setVal(row.key, event.target.value)}
                          className="h-11 border-transparent bg-transparent text-right hover:border-[var(--border-soft)] focus:border-accent"
                        />
                      </TD>
                      <TD align="right" className="text-sm text-[var(--text-muted)]">
                        {total > 0 ? `${(((values[row.key] || 0) / total) * 100).toFixed(1)}%` : '-'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>

          <aside className="bg-[var(--surface-muted)] px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Capex Roll-up</div>
            <div className="mt-4 space-y-4">
              <SummaryLine label="Sub-total" value={fmtCurrency(subTotal)} strong />
              <AdderRow label="VAT" value={adders.vatRate} amount={vat} onChange={(value) => setAdd('vatRate', value)} />
              <AdderRow label="Contingency" value={adders.contingencyRate} amount={contingency} onChange={(value) => setAdd('contingencyRate', value)} />
              <AdderRow label="Management" value={adders.managementRate} amount={management} onChange={(value) => setAdd('managementRate', value)} />
              <SummaryLine label="Others" value={fmtCurrency(others)} />
            </div>

            <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary">Total Capex</div>
              <div className="mt-2 text-3xl font-semibold text-primary">{fmtCurrency(total)}</div>
              <p className="mt-2 text-xs leading-6 text-primary/80">
                VAT, contingency, and management are applied to items 1 to 8, with residual items carried separately.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-3 last:border-b-0 last:pb-0">
      <div className={strong ? 'font-semibold text-[var(--text-main)]' : 'text-sm text-[var(--text-muted)]'}>{label}</div>
      <div className={strong ? 'font-semibold text-[var(--text-main)]' : 'text-sm font-medium text-[var(--text-main)]'}>{value}</div>
    </div>
  );
}

function AdderRow({ label, value, amount, onChange }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
          <div className="mt-1 text-sm font-medium text-[var(--text-main)]">{fmtCurrency(amount)}</div>
        </div>
        <div className="w-28">
          <Input type="number" step="0.001" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 text-right" />
        </div>
      </div>
      <div className="mt-2 text-xs text-[var(--text-muted)]">Decimal rate applied to sub-total</div>
    </div>
  );
}
