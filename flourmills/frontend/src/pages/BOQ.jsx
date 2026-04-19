import { useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input } from '../components/ui/Primitives.jsx';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table.jsx';
import { fmtCurrency } from '../lib/utils.js';
import { Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

const ROWS = [
  { key: 'solarPV',                 label: '1. Solar PV',                 note: 'Panels, mounting, DC cabling' },
  { key: 'invertersAccessories',    label: '2. Inverters & Accessories',  note: 'Hybrid inverters + AC cabling' },
  { key: 'energyStorage',           label: '3. Energy Storage',           note: 'LFP batteries' },
  { key: 'ccmpptStringInverter',    label: '4. CCMPPT / String Inverter', note: 'String-level MPPT' },
  { key: 'distributionBox',         label: '5. Distribution Box',         note: 'AC/DC distribution panels' },
  { key: 'balanceOfSystems',        label: '6. Balance of Systems (BOS)', note: 'Protection, bus-bars, hardware' },
  { key: 'otherAccessories',        label: '7. Other Accessories',        note: 'Cable trays, fire, misc.' },
  { key: 'generalCostsCivilWorks',  label: '8. Civil Works',              note: 'Civil, structural, earthing' },
  { key: 'others',                  label: '9. Others',                   note: 'Any residual line items' },
];

export default function BOQ() {
  const { current, updateAssumptionDeep } = useProject();
  const [values, setValues] = useState({});
  const [adders, setAdders] = useState({ vatRate: 0.075, contingencyRate: 0.20, managementRate: 0.15 });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    if (current) {
      setValues({ ...current.assumption.boq });
      setAdders({ ...current.assumption.capexAdders });
      setDirty(false);
    }
  }, [current?._id || current?.id]);

  const setVal = (k, v) => { setValues((prev) => ({ ...prev, [k]: Number(v) || 0 })); setDirty(true); };
  const setAdd = (k, v) => { setAdders((prev) => ({ ...prev, [k]: Number(v) || 0 })); setDirty(true); };

  const subTotal = ROWS.slice(0, 8).reduce((s, r) => s + (values[r.key] || 0), 0);
  const vat = subTotal * (adders.vatRate || 0);
  const contingency = subTotal * (adders.contingencyRate || 0);
  const management = subTotal * (adders.managementRate || 0);
  const others = values.others || 0;
  const total = subTotal + vat + contingency + management + others;

  if (!current) return <div className="text-sm text-muted">Loading…</div>;

  const onSave = async () => {
    setSaveState('saving');
    try {
      await updateAssumptionDeep((a) => { a.boq = { ...values }; a.capexAdders = { ...adders }; return a; });
      setSaveState('saved'); setDirty(false);
      setTimeout(() => setSaveState(null), 2000);
    } catch (e) { setSaveState('error'); alert(e.message); }
  };

  const onReset = () => {
    setValues({ ...current.assumption.boq });
    setAdders({ ...current.assumption.capexAdders });
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider">Capex Build-up</div>
          <h1 className="text-2xl font-semibold text-ink">Bill of Quantities</h1>
          <p className="text-sm text-muted mt-1">
            Category roll-up from BOQ + 3MW Project BEME · VAT, contingency, and management apply to sub-total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === 'saved' && (
            <div className="flex items-center gap-1 text-emerald-700 text-xs bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
              <CheckCircle2 size={12} /> Saved
            </div>
          )}
          {saveState === 'error' && (
            <div className="flex items-center gap-1 text-red-700 text-xs bg-red-50 border border-red-100 rounded px-2 py-1">
              <AlertCircle size={12} /> Failed
            </div>
          )}
          <Button variant="outline" onClick={onReset} disabled={!dirty}><RotateCcw size={14} /> Reset</Button>
          <Button onClick={onSave} disabled={!dirty}><Save size={14} /> Save BOQ</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Line Items</CardTitle>
          <CardDescription>NGN · sub-total feeds VAT / contingency / management</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Category</TH>
              <TH>Description</TH>
              <TH align="right">Cost (NGN)</TH>
              <TH align="right">Share</TH>
            </TR>
          </THead>
          <TBody>
            {ROWS.map((row, idx) => (
              <TR key={row.key}>
                <TD className="text-muted">{idx + 1}</TD>
                <TD className="font-medium">{row.label}</TD>
                <TD className="text-muted text-xs">{row.note}</TD>
                <TD align="right" className="p-0 pr-3">
                  <Input
                    type="number"
                    className="h-9 text-right border-transparent hover:border-border focus:border-accent bg-transparent"
                    value={values[row.key] ?? 0}
                    onChange={(e) => setVal(row.key, e.target.value)}
                  />
                </TD>
                <TD align="right" className="text-muted text-xs">
                  {total > 0 ? `${(((values[row.key] || 0) / total) * 100).toFixed(1)}%` : '—'}
                </TD>
              </TR>
            ))}
            <TR className="bg-offwhite font-semibold">
              <TD></TD>
              <TD>Sub-total (items 1-8)</TD>
              <TD></TD>
              <TD align="right">{fmtCurrency(subTotal)}</TD>
              <TD></TD>
            </TR>
          </TBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Adders</CardTitle>
            <CardDescription>Applied to sub-total</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {[
              ['vatRate', 'VAT', vat],
              ['contingencyRate', 'Contingency', contingency],
              ['managementRate', 'Management', management],
            ].map(([key, label, amt]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 text-xs text-muted uppercase tracking-wide">{label}</div>
                <Input type="number" step="0.001" className="w-28" value={adders[key]} onChange={(e) => setAdd(key, e.target.value)} />
                <div className="text-xs text-muted w-24">decimal</div>
                <div className="ml-auto text-sm font-medium tabular-nums">{fmtCurrency(amt)}</div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capex Summary</CardTitle>
            <CardDescription>Auto-calculated</CardDescription>
          </CardHeader>
          <CardBody>
            <dl className="text-sm divide-y divide-border">
              <div className="flex justify-between py-2"><dt className="text-muted">Sub-total</dt>   <dd className="num font-medium">{fmtCurrency(subTotal)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted">VAT</dt>         <dd className="num font-medium">{fmtCurrency(vat)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted">Contingency</dt> <dd className="num font-medium">{fmtCurrency(contingency)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted">Management</dt>  <dd className="num font-medium">{fmtCurrency(management)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted">Others</dt>      <dd className="num font-medium">{fmtCurrency(others)}</dd></div>
              <div className="flex justify-between py-3 bg-primary-50 -mx-5 px-5 rounded mt-2">
                <dt className="font-semibold text-primary">Total Capex</dt>
                <dd className="num font-bold text-primary text-lg">{fmtCurrency(total)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
