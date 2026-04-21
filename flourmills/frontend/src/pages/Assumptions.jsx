import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Button, Input, Label } from '../components/ui/Primitives.jsx';
import { AlertCircle, CheckCircle2, RotateCcw, Save } from 'lucide-react';

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const set = (obj, path, value) => {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
};

function Field({ label, register, error, name, type = 'number', step = 'any', suffix, disabled }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="relative mt-1.5">
        <Input id={name} type={type} step={step} disabled={disabled} {...register(name, { valueAsNumber: type === 'number' })} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">{suffix}</span>}
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error.message}</div>}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="border-t border-[var(--border-soft)] pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[var(--text-main)]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

const schema = z.object({
  projectName: z.string().min(1, 'Required'),
  'location.village': z.string().optional(),
  'location.state': z.string().optional(),
  'location.lga': z.string().optional(),
  'location.ward': z.string().optional(),
  'dates.modelStartDate': z.string().min(1),
  'dates.projectDevelopmentMonths': z.number().min(0),
  'dates.procurementMonths': z.number().min(0),
  'dates.numberOfYearsInModel': z.number().min(1).max(40),
  'macro.exchangeRate': z.number().min(0),
  'system.solarPVCapacity': z.number().min(0),
  'system.batteryCapacity': z.number().min(0),
  'system.inverterCapacity': z.number().min(0),
  'system.dieselGeneratorCapacity': z.number().min(0),
  'energy.anchorCustomers': z.number().min(0),
  'energy.commercialCustomers': z.number().min(0),
  'energy.dailyConsumptionSolar': z.number().min(0),
  'energy.dailyConsumptionDieselGen': z.number().min(0),
  'energy.dailyConsumptionDiesel': z.number().min(0),
  'energy.dailyConsumptionCommercial': z.number().min(0),
  'tariff.anchorBase': z.number().min(0),
  'tariff.commercialBase': z.number().min(0),
  'tariff.annualEscalation': z.number().min(0).max(1),
  'tariff.escalationCommencementYears': z.number().min(0),
  'tariff.discountRate': z.number().min(0).max(1),
  'technical.uptime': z.number().min(0).max(1),
  'technical.collectionRate': z.number().min(0).max(1),
  'opex.dieselAnnualConsumption': z.number().min(0),
  'opex.dieselUnitCost': z.number().min(0),
  'opex.dieselAnnualEscalation': z.number().min(0).max(1),
  'opex.generatorOMAnnual': z.number().min(0),
  'opex.omAnnualEscalation': z.number().min(0).max(1),
  'opex.otherOpexAnnualEscalation': z.number().min(0).max(1),
  'opex.opexPercentages.insurance': z.number().min(0).max(1),
  'opex.opexPercentages.systemMonitoring': z.number().min(0).max(1),
  'opex.opexPercentages.inverterMaintenance': z.number().min(0).max(1),
  'opex.opexPercentages.researchCost': z.number().min(0).max(1),
  'opex.opexPercentages.managementFee': z.number().min(0).max(1),
  'opex.opexPercentages.staffCompensation': z.number().min(0).max(1),
  'opex.opexPercentages.others': z.number().min(0).max(1),
  'opex.opexPercentages.portfolioManager': z.number().min(0).max(1),
  'capexAdders.vatRate': z.number().min(0).max(1),
  'capexAdders.contingencyRate': z.number().min(0).max(1),
  'capexAdders.managementRate': z.number().min(0).max(1),
  'depreciation.solarPV': z.number().min(1).max(50),
  'depreciation.invertersAccessories': z.number().min(1).max(50),
  'depreciation.energyStorage': z.number().min(1).max(50),
  'depreciation.distributionBox': z.number().min(1).max(50),
  'depreciation.balanceOfSystems': z.number().min(1).max(50),
  'depreciation.otherAccessories': z.number().min(1).max(50),
  'depreciation.others': z.number().min(1).max(50),
  'tax.companyIncomeTax': z.number().min(0).max(1),
  'tax.educationTax': z.number().min(0).max(1),
  'tax.vat': z.number().min(0).max(1),
  'tax.totalTaxRate': z.number().min(0).max(1),
  'tax.holidayMonths': z.number().min(0),
  'grant.amountPerConnection': z.number().min(0),
  'grant.totalConnections': z.number().min(0),
  'grant.exchangeRateForGrant': z.number().min(0),
  'grant.firstPaymentPct': z.number().min(0).max(1),
  'grant.secondPaymentPct': z.number().min(0).max(1),
  'financing.projectDev.debtPct': z.number().min(0).max(1),
  'financing.bridge.arrangementFeeRate': z.number().min(0).max(1),
  'financing.bridge.tenorMonths': z.number().min(0),
  'financing.bridge.moratoriumYears': z.number().min(0),
  'financing.bridge.interestMoratoriumYears': z.number().min(0),
  'financing.bridge.interestRate': z.number().min(0).max(1),
  'financing.bridge.interestRepaymentFreqMonths': z.number().min(1),
  'financing.senior.debtPct': z.number().min(0).max(1),
  'financing.senior.tenorYears': z.number().min(0),
  'financing.senior.principalMoratoriumYears': z.number().min(0),
  'financing.senior.numberOfPrincipalRepayments': z.number().min(1),
  'financing.senior.interestRate': z.number().min(0).max(1),
  'financing.senior.interestMoratoriumYears': z.number().min(0),
  'financing.senior.interestRepaymentFreqMonths': z.number().min(1),
  'workingCapital.receivableDays': z.number().min(0),
  'workingCapital.payableDays': z.number().min(0),
});

function toFlat(assumption, projectName) {
  const flat = { projectName };
  Object.keys(schema.shape).forEach((key) => {
    if (key === 'projectName') return;
    const value = get(assumption, key);
    flat[key] = value ?? (key.startsWith('location.') ? '' : 0);
    if (key === 'dates.modelStartDate' && typeof value === 'string' && value.includes('T')) {
      flat[key] = value.slice(0, 10);
    }
  });
  return flat;
}

function fromFlat(flat, baseAssumption) {
  const output = JSON.parse(JSON.stringify(baseAssumption));
  Object.keys(flat).forEach((key) => {
    if (key === 'projectName') return;
    set(output, key, flat[key]);
  });
  if (output.financing?.senior?.tenorYears != null) {
    output.financing.senior.tenorMonths = Number(output.financing.senior.tenorYears) * 12;
  }
  return output;
}

export default function Assumptions() {
  const { current, updateAssumptionDeep, renameProject } = useProject();
  const [saveState, setSaveState] = useState(null);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: current ? toFlat(current.assumption, current.projectName) : {},
    mode: 'onBlur',
  });

  useEffect(() => {
    if (current) reset(toFlat(current.assumption, current.projectName));
  }, [current?._id || current?.id]);

  const onSubmit = async (values) => {
    setSaveState('saving');
    try {
      const nextAssumption = fromFlat(values, current.assumption);
      if (values.projectName && values.projectName !== current.projectName) {
        await renameProject(values.projectName);
      }
      await updateAssumptionDeep(() => nextAssumption);
      setSaveState('saved');
      reset(values);
      setTimeout(() => setSaveState(null), 2200);
    } catch (error) {
      setSaveState('error');
      alert(error.message);
    }
  };

  const onReset = () => {
    if (current) reset(toFlat(current.assumption, current.projectName));
  };

  if (!current) return <div className="text-sm text-[var(--text-muted)]">Loading...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Assumption Sheet</div>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-main)]">Assumptions</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveState === 'saved' && <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={12} /> Saved</div>}
          {saveState === 'error' && <div className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-600 dark:text-red-300"><AlertCircle size={12} /> Save failed</div>}
          <Button type="button" variant="outline" onClick={onReset} disabled={!isDirty}><RotateCcw size={14} /> Reset</Button>
          <Button type="submit" disabled={!isDirty || saveState === 'saving'}><Save size={14} /> {saveState === 'saving' ? 'Saving...' : 'Save Assumptions'}</Button>
        </div>
      </section>

      <div className="space-y-8 border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-6 sm:px-6">
        <Section title="Project Identity" description="Name and location fields from the source workbook">
          <Field label="Project Name" name="projectName" register={register} error={errors.projectName} type="text" />
          <Field label="Village / Site" name="location.village" register={register} error={errors['location.village']} type="text" />
          <Field label="State" name="location.state" register={register} error={errors['location.state']} type="text" />
          <Field label="LGA" name="location.lga" register={register} error={errors['location.lga']} type="text" />
          <Field label="Ward" name="location.ward" register={register} error={errors['location.ward']} type="text" />
        </Section>

        <Section title="Dates and Macro" description="Development period, model horizon, and exchange rate assumptions">
          <Field label="Model Start Date" name="dates.modelStartDate" register={register} error={errors['dates.modelStartDate']} type="date" />
          <Field label="Years in Model" name="dates.numberOfYearsInModel" register={register} error={errors['dates.numberOfYearsInModel']} suffix="years" />
          <Field label="Project Development Period" name="dates.projectDevelopmentMonths" register={register} error={errors['dates.projectDevelopmentMonths']} suffix="months" />
          <Field label="Procurement / Construction" name="dates.procurementMonths" register={register} error={errors['dates.procurementMonths']} suffix="months" />
          <Field label="Exchange Rate" name="macro.exchangeRate" register={register} error={errors['macro.exchangeRate']} suffix="NGN/US$" />
        </Section>

        <Section title="System Sizing" description="Installed system capacity values">
          <Field label="Solar PV Capacity" name="system.solarPVCapacity" register={register} error={errors['system.solarPVCapacity']} suffix="kWp" />
          <Field label="Battery Capacity" name="system.batteryCapacity" register={register} error={errors['system.batteryCapacity']} suffix="kWh" />
          <Field label="Hybrid Inverter Capacity" name="system.inverterCapacity" register={register} error={errors['system.inverterCapacity']} suffix="kW" />
          <Field label="Diesel Generator" name="system.dieselGeneratorCapacity" register={register} error={errors['system.dieselGeneratorCapacity']} suffix="kVA" />
        </Section>

        <Section title="Energy Demand" description="Customer counts and daily energy assumptions">
          <Field label="Anchor Customers" name="energy.anchorCustomers" register={register} error={errors['energy.anchorCustomers']} suffix="#" />
          <Field label="Commercial Customers" name="energy.commercialCustomers" register={register} error={errors['energy.commercialCustomers']} suffix="#" />
          <Field label="Daily Consumption (Solar/BESS)" name="energy.dailyConsumptionSolar" register={register} error={errors['energy.dailyConsumptionSolar']} suffix="kWh/day" />
          <Field label="Daily Consumption (Gen)" name="energy.dailyConsumptionDieselGen" register={register} error={errors['energy.dailyConsumptionDieselGen']} suffix="kWh/day" />
          <Field label="Daily Consumption (Diesel Fuel)" name="energy.dailyConsumptionDiesel" register={register} error={errors['energy.dailyConsumptionDiesel']} suffix="kWh/day" />
          <Field label="Daily Consumption (Commercial)" name="energy.dailyConsumptionCommercial" register={register} error={errors['energy.dailyConsumptionCommercial']} suffix="kWh/day" />
        </Section>

        <Section title="Tariff and Escalation" description="Base tariff values and escalation timing">
          <Field label="Anchor Base Tariff" name="tariff.anchorBase" register={register} error={errors['tariff.anchorBase']} suffix="NGN/kWh" />
          <Field label="Commercial Base Tariff" name="tariff.commercialBase" register={register} error={errors['tariff.commercialBase']} suffix="NGN/kWh" />
          <Field label="Annual Escalation" name="tariff.annualEscalation" register={register} error={errors['tariff.annualEscalation']} suffix="e.g. 0.10" />
          <Field label="Escalation Commencement" name="tariff.escalationCommencementYears" register={register} error={errors['tariff.escalationCommencementYears']} suffix="years" />
          <Field label="NPV Discount Rate" name="tariff.discountRate" register={register} error={errors['tariff.discountRate']} suffix="e.g. 0.10" />
        </Section>

        <Section title="Technical" description="Collection and uptime settings used by the engine">
          <Field label="Technical Uptime" name="technical.uptime" register={register} error={errors['technical.uptime']} suffix="e.g. 0.98" />
          <Field label="Collection Rate" name="technical.collectionRate" register={register} error={errors['technical.collectionRate']} suffix="e.g. 0.98" />
        </Section>

        <Section title="Diesel and Generator Opex" description="Annual operating cost assumptions with escalation">
          <Field label="Diesel Annual Consumption" name="opex.dieselAnnualConsumption" register={register} error={errors['opex.dieselAnnualConsumption']} suffix="litres/yr" />
          <Field label="Diesel Unit Cost" name="opex.dieselUnitCost" register={register} error={errors['opex.dieselUnitCost']} suffix="NGN/litre" />
          <Field label="Diesel Annual Escalation" name="opex.dieselAnnualEscalation" register={register} error={errors['opex.dieselAnnualEscalation']} suffix="e.g. 0.10" />
          <Field label="Generator O&M Annual" name="opex.generatorOMAnnual" register={register} error={errors['opex.generatorOMAnnual']} suffix="NGN/yr" />
          <Field label="Generator O&M Escalation" name="opex.omAnnualEscalation" register={register} error={errors['opex.omAnnualEscalation']} suffix="e.g. 0.05" />
          <Field label="Other Opex Escalation" name="opex.otherOpexAnnualEscalation" register={register} error={errors['opex.otherOpexAnnualEscalation']} suffix="e.g. 0.05" />
        </Section>

        <Section title="Other Opex as Percentage of Capex" description="Percent-based annual opex items from the workbook">
          <Field label="Insurance" name="opex.opexPercentages.insurance" register={register} error={errors['opex.opexPercentages.insurance']} suffix="decimal" />
          <Field label="System Monitoring" name="opex.opexPercentages.systemMonitoring" register={register} error={errors['opex.opexPercentages.systemMonitoring']} suffix="decimal" />
          <Field label="Inverter Maintenance" name="opex.opexPercentages.inverterMaintenance" register={register} error={errors['opex.opexPercentages.inverterMaintenance']} suffix="decimal" />
          <Field label="Research Cost" name="opex.opexPercentages.researchCost" register={register} error={errors['opex.opexPercentages.researchCost']} suffix="decimal" />
          <Field label="Management Fee" name="opex.opexPercentages.managementFee" register={register} error={errors['opex.opexPercentages.managementFee']} suffix="decimal" />
          <Field label="Staff Compensation" name="opex.opexPercentages.staffCompensation" register={register} error={errors['opex.opexPercentages.staffCompensation']} suffix="decimal" />
          <Field label="Others" name="opex.opexPercentages.others" register={register} error={errors['opex.opexPercentages.others']} suffix="decimal" />
          <Field label="Portfolio Manager" name="opex.opexPercentages.portfolioManager" register={register} error={errors['opex.opexPercentages.portfolioManager']} suffix="decimal" />
        </Section>

        <Section title="Capex Adders" description="Applied to the BOQ sub-total">
          <Field label="VAT" name="capexAdders.vatRate" register={register} error={errors['capexAdders.vatRate']} suffix="decimal" />
          <Field label="Contingency" name="capexAdders.contingencyRate" register={register} error={errors['capexAdders.contingencyRate']} suffix="decimal" />
          <Field label="Management" name="capexAdders.managementRate" register={register} error={errors['capexAdders.managementRate']} suffix="decimal" />
        </Section>

        <Section title="Depreciation Lives" description="Straight-line depreciation lives by category">
          <Field label="Solar PV" name="depreciation.solarPV" register={register} error={errors['depreciation.solarPV']} suffix="years" />
          <Field label="Inverters and Accessories" name="depreciation.invertersAccessories" register={register} error={errors['depreciation.invertersAccessories']} suffix="years" />
          <Field label="Energy Storage" name="depreciation.energyStorage" register={register} error={errors['depreciation.energyStorage']} suffix="years" />
          <Field label="Distribution Box" name="depreciation.distributionBox" register={register} error={errors['depreciation.distributionBox']} suffix="years" />
          <Field label="Balance of Systems" name="depreciation.balanceOfSystems" register={register} error={errors['depreciation.balanceOfSystems']} suffix="years" />
          <Field label="Other Accessories" name="depreciation.otherAccessories" register={register} error={errors['depreciation.otherAccessories']} suffix="years" />
          <Field label="Others" name="depreciation.others" register={register} error={errors['depreciation.others']} suffix="years" />
        </Section>

        <Section title="Tax" description="Tax parameters applied after the holiday period and only when PBT is positive">
          <Field label="Company Income Tax" name="tax.companyIncomeTax" register={register} error={errors['tax.companyIncomeTax']} suffix="decimal" />
          <Field label="Education Tax" name="tax.educationTax" register={register} error={errors['tax.educationTax']} suffix="decimal" />
          <Field label="VAT" name="tax.vat" register={register} error={errors['tax.vat']} suffix="decimal" />
          <Field label="Effective Tax Rate" name="tax.totalTaxRate" register={register} error={errors['tax.totalTaxRate']} suffix="decimal" />
          <Field label="Tax Holiday" name="tax.holidayMonths" register={register} error={errors['tax.holidayMonths']} suffix="months" />
        </Section>

        <Section title="Grant Assumptions" description="Optional grant-related project inputs">
          <Field label="Amount per Connection" name="grant.amountPerConnection" register={register} error={errors['grant.amountPerConnection']} suffix="US$" />
          <Field label="Total Connections" name="grant.totalConnections" register={register} error={errors['grant.totalConnections']} suffix="#" />
          <Field label="Grant Exchange Rate" name="grant.exchangeRateForGrant" register={register} error={errors['grant.exchangeRateForGrant']} suffix="NGN/US$" />
          <Field label="1st Payment Share" name="grant.firstPaymentPct" register={register} error={errors['grant.firstPaymentPct']} suffix="decimal" />
          <Field label="2nd Payment Share" name="grant.secondPaymentPct" register={register} error={errors['grant.secondPaymentPct']} suffix="decimal" />
        </Section>

        <Section title="Bridge Financing" description="Project development funding refinanced by senior debt">
          <Field label="Project Dev Debt %" name="financing.projectDev.debtPct" register={register} error={errors['financing.projectDev.debtPct']} suffix="decimal" />
          <Field label="Arrangement Fee" name="financing.bridge.arrangementFeeRate" register={register} error={errors['financing.bridge.arrangementFeeRate']} suffix="decimal" />
          <Field label="Tenor" name="financing.bridge.tenorMonths" register={register} error={errors['financing.bridge.tenorMonths']} suffix="months" />
          <Field label="Principal Moratorium" name="financing.bridge.moratoriumYears" register={register} error={errors['financing.bridge.moratoriumYears']} suffix="years" />
          <Field label="Interest Moratorium" name="financing.bridge.interestMoratoriumYears" register={register} error={errors['financing.bridge.interestMoratoriumYears']} suffix="years" />
          <Field label="Interest Rate" name="financing.bridge.interestRate" register={register} error={errors['financing.bridge.interestRate']} suffix="decimal" />
          <Field label="Interest Payment Frequency" name="financing.bridge.interestRepaymentFreqMonths" register={register} error={errors['financing.bridge.interestRepaymentFreqMonths']} suffix="months" />
        </Section>

        <Section title="Senior Debt" description="Amortizing debt after operations start">
          <Field label="Debt %" name="financing.senior.debtPct" register={register} error={errors['financing.senior.debtPct']} suffix="decimal" />
          <Field label="Tenor" name="financing.senior.tenorYears" register={register} error={errors['financing.senior.tenorYears']} suffix="years" />
          <Field label="Principal Moratorium" name="financing.senior.principalMoratoriumYears" register={register} error={errors['financing.senior.principalMoratoriumYears']} suffix="years" />
          <Field label="Number of Principal Repayments" name="financing.senior.numberOfPrincipalRepayments" register={register} error={errors['financing.senior.numberOfPrincipalRepayments']} suffix="#" />
          <Field label="Interest Rate" name="financing.senior.interestRate" register={register} error={errors['financing.senior.interestRate']} suffix="decimal" />
          <Field label="Interest Moratorium" name="financing.senior.interestMoratoriumYears" register={register} error={errors['financing.senior.interestMoratoriumYears']} suffix="years" />
          <Field label="Interest Payment Frequency" name="financing.senior.interestRepaymentFreqMonths" register={register} error={errors['financing.senior.interestRepaymentFreqMonths']} suffix="months" />
        </Section>

        <Section title="Working Capital" description="Receivables and payables timing assumptions">
          <Field label="Receivable Days" name="workingCapital.receivableDays" register={register} error={errors['workingCapital.receivableDays']} suffix="days" />
          <Field label="Payable Days" name="workingCapital.payableDays" register={register} error={errors['workingCapital.payableDays']} suffix="days" />
        </Section>
      </div>
    </form>
  );
}
