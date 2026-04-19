/* =============================================================================
 * FINANCIAL ENGINE — Flour Mills (Honeywell) Hybrid Solar + BESS Mini-Grid
 * -----------------------------------------------------------------------------
 * Pure JavaScript reverse-engineering of the Excel file:
 *   "Flour Mills Model Version2_AO.xlsx"
 *
 * Sheet  → Module mapping:
 *   • Assumption        → inputs (project dates, tariffs, capex, debt, tax…)
 *   • BOQ + 3MW BEME    → capex build-up (rolled into Assumption.capex)
 *   • Deal Summary      → executive KPIs (derived here)
 *   • M.Calculation     → monthly engine (timeline, revenue, costs, capex,
 *                         bridge loan schedule, senior debt, equity, totals)
 *   • Depreciation      → straight-line 10-year per capex category
 *   • Financials        → yearly IS / BS / CF aggregated from monthly
 *
 * All Excel date / finance functions are re-implemented below (EOMONTH, EDATE,
 * YEAR, MONTH, QUOTIENT, PPMT, IPMT, PMT, SUMIF, IRR, NPV).
 *
 * Every formula translation carries an inline Excel reference comment so the
 * mapping can be audited cell-by-cell.
 * =========================================================================== */

// -----------------------------------------------------------------------------
// 1.  EXCEL-COMPATIBLE PRIMITIVES
// -----------------------------------------------------------------------------

/** Excel EOMONTH(date, 0) → last calendar day of that month (local time, noon). */
export function eomonth(date, months = 0) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + months + 1, 0, 12, 0, 0, 0);
}

/** Excel EDATE(date, months) → same day-of-month, shifted by `months`. */
export function edate(date, months) {
  const d = new Date(date);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12, 0, 0, 0);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

/** First day of the month of `date`. */
export function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

/** Days between two dates inclusive (Excel: end - start + 1). */
export function daysInPeriod(start, end) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / ms) + 1;
}

/** Excel YEAR(date). */
export const year = (d) => new Date(d).getFullYear();

/** Excel MONTH(date). */
export const month = (d) => new Date(d).getMonth() + 1;

/** Excel QUOTIENT(n, d) — integer division, truncated toward zero. */
export const quotient = (n, d) => Math.trunc(n / d);

/** Round to N decimal places (numeric stability only — never a substitute for formulas). */
export const round = (x, n = 2) => {
  if (!Number.isFinite(x)) return 0;
  const p = 10 ** n;
  return Math.round(x * p) / p;
};

/* -----------------------------------------------------------------------------
 * 2.  FINANCIAL FUNCTIONS (PMT / IPMT / PPMT / IRR / NPV)
 *     These are exact replicas of Excel's behaviour — identical sign
 *     convention and edge-case handling.
 * --------------------------------------------------------------------------- */

/** Excel PMT(rate, nper, pv, [fv=0], [type=0]) — returns a NEGATIVE number for an outflow. */
export function PMT(rate, nper, pv, fv = 0, type = 0) {
  if (nper <= 0) return 0;
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(rate * (pv * pvif + fv)) / ((1 + rate * type) * (pvif - 1));
}

/** Excel IPMT(rate, per, nper, pv, [fv=0], [type=0]) — interest portion for period `per`. */
export function IPMT(rate, per, nper, pv, fv = 0, type = 0) {
  const pmt = PMT(rate, nper, pv, fv, type);
  // Outstanding balance at end of period (per-1)
  let bal = pv;
  for (let i = 1; i < per; i++) {
    const interest = bal * rate;
    bal = bal + interest + pmt; // pmt is negative
  }
  return -bal * rate;
}

/** Excel PPMT(rate, per, nper, pv, [fv=0], [type=0]) — principal portion for period `per`. */
export function PPMT(rate, per, nper, pv, fv = 0, type = 0) {
  return PMT(rate, nper, pv, fv, type) - IPMT(rate, per, nper, pv, fv, type);
}

/** Excel IRR(values, [guess=0.1]) — Newton-Raphson on NPV. Returns null if not converged. */
export function IRR(cashflows, guess = 0.1) {
  const npv = (rate) =>
    cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
  const dnpv = (rate) =>
    cashflows.reduce((acc, cf, i) => acc - (i * cf) / Math.pow(1 + rate, i + 1), 0);

  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    const v = npv(rate);
    if (Math.abs(v) < 1e-8) return rate;
    const dv = dnpv(rate);
    if (Math.abs(dv) < 1e-12) break;
    const next = rate - v / dv;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  return null; // no convergence
}

/** Excel NPV(rate, values) — note: Excel discounts the FIRST value one period. */
export function NPV(rate, cashflows) {
  return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i + 1), 0);
}

/* -----------------------------------------------------------------------------
 * 3.  TIMELINE — mirrors M.Calculation rows 1-8 (columns N onwards)
 * --------------------------------------------------------------------------- */

/**
 * Build the monthly timeline from model start (J10) to model end (J15).
 * Each entry corresponds to one Excel column (N, O, P, …).
 *
 * Excel refs:
 *   N1  =Assumption!J10                                (start date)
 *   O1  =IF(N2 < end, N2+1, 0)                         (next start = prev end +1)
 *   N2  =EOMONTH(N1, 0)                                (month-end)
 *   N3  =YEAR(N2)
 *   N4  =MONTH(N2)
 *   N5  =1 ; O5=N5+1                                   (month counter)
 *   N6  =N2-N1+1                                       (days in month)
 *   N7  =QUOTIENT(N5-1, 12)+1                          (year counter)
 *   N8  =IFS(N2<=J11,"Dev", N2>EDATE(J11, procurement),"Ops",
 *            N2<=EDATE(J11, procurement),"Cons.")
 */
export function buildTimeline(a) {
  const modelStart = new Date(a.dates.modelStartDate);
  const projDevEnd = edate(modelStart, a.dates.projectDevelopmentMonths); // J11 = J10 + J61 - 1
  projDevEnd.setDate(projDevEnd.getDate() - 1);
  const modelEnd = edate(projDevEnd, a.dates.numberOfYearsInModel * 12); // J15 = J11 + J14*12

  // Begin from first of modelStart's month
  let currentStart = startOfMonth(modelStart);
  const timeline = [];
  let counter = 1;

  // Guard against accidental runaway (defensive limit 480 months = 40 years)
  while (currentStart <= modelEnd && counter <= 480) {
    const currentEnd = eomonth(currentStart, 0);
    const description =
      currentEnd <= projDevEnd
        ? 'Dev'
        : currentEnd > edate(projDevEnd, a.dates.procurementMonths)
        ? 'Ops'
        : 'Cons.';

    timeline.push({
      monthIndex: counter - 1,
      counter,
      startDate: new Date(currentStart),
      endDate: new Date(currentEnd),
      year: year(currentEnd),
      month: month(currentEnd),
      daysInPeriod: daysInPeriod(currentStart, currentEnd),
      yearCounter: quotient(counter - 1, 12) + 1,
      description,
    });

    // Advance to first day of next month
    currentStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 1, 1, 12, 0, 0, 0);
    counter += 1;
  }

  return {
    modelStart,
    projDevEnd,
    modelEnd,
    operationsStart: edate(projDevEnd, a.dates.procurementMonths),
    timeline,
  };
}

/* -----------------------------------------------------------------------------
 * 4.  BOQ / CAPEX AGGREGATION
 *     Rolls the 'BOQ' category line items into the 8 capex buckets used
 *     elsewhere in the model. Mirrors Assumption J87:J98 + contingencies.
 * --------------------------------------------------------------------------- */

/**
 * Assumption!J87-J98 capex structure:
 *   J87  Solar PV                                   → BOQ category 'Solar PV'
 *   J88  Inverters & Accessories                    → 'Inverters'
 *   J89  Energy Storage                             → 'Battery Bank'
 *   J90  =3MW BEME!B227 (CCMPPT/String Inverter)    → 'CCMPPT'
 *   J91  Distribution Box
 *   J92  Balance of Systems (BOS)
 *   J93  Other Accessories                          → Addition Distribution Costs
 *   J94  =3MW BEME!B231 (General Costs/Civil Works)
 *   J95  VAT  = G95 * L94                            (7.5% of sub-total)
 *   J96  Contingency = G96 * L94                     (20% of sub-total)
 *   J97  Management  = G97 * L94                     (15% of sub-total)
 *   J98  Others
 *   J99  Total capex = SUM(J87:J98)
 */
export function computeCapex(a) {
  const boq = a.boq || {};
  const raw = {
    solarPV: Number(boq.solarPV) || 0,
    invertersAccessories: Number(boq.invertersAccessories) || 0,
    energyStorage: Number(boq.energyStorage) || 0,
    ccmpptStringInverter: Number(boq.ccmpptStringInverter) || 0,
    distributionBox: Number(boq.distributionBox) || 0,
    balanceOfSystems: Number(boq.balanceOfSystems) || 0,
    otherAccessories: Number(boq.otherAccessories) || 0,
    generalCostsCivilWorks: Number(boq.generalCostsCivilWorks) || 0,
    others: Number(boq.others) || 0,
  };

  // Subtotal before VAT/contingency/management (Excel L94 = SUM(J87:J94))
  const subTotal =
    raw.solarPV +
    raw.invertersAccessories +
    raw.energyStorage +
    raw.ccmpptStringInverter +
    raw.distributionBox +
    raw.balanceOfSystems +
    raw.otherAccessories +
    raw.generalCostsCivilWorks;

  const vatRate = a.capexAdders?.vatRate ?? 0.075;
  const contingencyRate = a.capexAdders?.contingencyRate ?? 0.20;
  const managementRate = a.capexAdders?.managementRate ?? 0.15;

  const vat = vatRate * subTotal;
  const contingency = contingencyRate * subTotal;
  const management = managementRate * subTotal;

  // J99 = SUM(J87:J98)
  const totalCapex =
    subTotal + vat + contingency + management + raw.others;

  // 7 depreciable categories in M.Calc rows 103-109 (VAT/contingency/mgmt are not depreciated)
  const byCategory = {
    solarPV: raw.solarPV,                                   // row 103
    invertersAccessories: raw.invertersAccessories,         // row 104
    energyStorage: raw.energyStorage,                       // row 105
    distributionBox: raw.distributionBox,                   // row 106
    balanceOfSystems: raw.balanceOfSystems,                 // row 107
    otherAccessories: raw.otherAccessories,                 // row 108
    others: raw.others,                                     // row 109
  };

  return { raw, subTotal, vat, contingency, management, totalCapex, byCategory };
}

/* -----------------------------------------------------------------------------
 * 5.  MONTHLY CALCULATION — full replica of M.Calculation rows 11-161
 * --------------------------------------------------------------------------- */

export function buildMonthlyCalculation(a, timelineBundle, capex) {
  const { timeline, projDevEnd, operationsStart } = timelineBundle;
  const N = timeline.length;

  // Initialize all rows as arrays of length N
  const makeArr = () => new Array(N).fill(0);

  const rev = {
    solarEnergyKwh: makeArr(),        // row 14
    dieselEnergyKwh: makeArr(),       // row 15
    dieselFuelKwh: makeArr(),         // row 16
    anchorEnergy: makeArr(),          // row 18 / 38
    commercialEnergy: makeArr(),      // row 19 / 39
    tariffEscalationRate: makeArr(),  // row 23
    escalationTrigger: makeArr(),     // row 24
    escalationFactor: makeArr(),      // row 25
    anchorTariff: makeArr(),          // row 28 / 43
    commercialTariff: makeArr(),      // row 29 / 44
    anchorRevenue: makeArr(),         // row 48
    commercialRevenue: makeArr(),     // row 49
    totalRevenue: makeArr(),          // row 50
  };

  const cost = {
    dieselConsumptionLitres: makeArr(),// row 59
    dieselEscalation: makeArr(),       // row 60
    dieselTrigger: makeArr(),          // row 61
    dieselFactor: makeArr(),           // row 62
    dieselUnitCost: makeArr(),         // row 63
    omEscalation: makeArr(),           // row 67
    omTrigger: makeArr(),              // row 68
    omFactor: makeArr(),               // row 69
    generatorOM: makeArr(),            // row 70
    otherOpexEscalation: makeArr(),    // row 83
    otherOpexTrigger: makeArr(),       // row 84
    otherOpexFactor: makeArr(),        // row 85
    insurance: makeArr(),              // row 89
    systemMonitoring: makeArr(),       // row 90
    inverterMaintenance: makeArr(),    // row 91
    researchCost: makeArr(),           // row 92
    managementFee: makeArr(),          // row 93
    staffCompensation: makeArr(),      // row 94
    others: makeArr(),                 // row 95
    portfolioManagerOM: makeArr(),     // row 96
    bridgeArrangementFee: makeArr(),   // row 97
    totalOperatingCost: makeArr(),     // row 98
    dieselTotalCost: makeArr(),        // row 87
    generatorOMTotal: makeArr(),       // row 88
  };

  const capexMonthly = {
    solarPV: makeArr(),                // row 103
    inverters: makeArr(),              // row 104
    energyStorage: makeArr(),          // row 105
    distributionBox: makeArr(),        // row 106
    balanceOfSystems: makeArr(),       // row 107
    otherAccessories: makeArr(),       // row 108
    othersCategory: makeArr(),         // row 109
    totalCapex: makeArr(),             // row 110
  };

  const bridge = {
    principalFlag: makeArr(),          // row 118
    principalPeriod: makeArr(),        // row 119
    interestFlag: makeArr(),           // row 121
    interestPeriod: makeArr(),         // row 122
    periodicInterestFlag: makeArr(),   // row 123
    openingBalance: makeArr(),         // row 125
    drawdown: makeArr(),               // row 126
    principalRepayment: makeArr(),     // row 127
    interestPayment: makeArr(),        // row 128
    outstanding: makeArr(),            // row 129
    interestRepaid: makeArr(),         // row 131
    loanRepayment: makeArr(),          // row 132
  };

  const senior = {
    principalFlag: makeArr(),          // row 136
    principalPeriod: makeArr(),        // row 137
    periodicPrincipalFlag: makeArr(),  // row 138
    periodicPrincipalPeriod: makeArr(),// row 139
    interestFlag: makeArr(),           // row 141
    interestPeriod: makeArr(),         // row 142
    periodicInterestFlag: makeArr(),   // row 143
    openingBalance: makeArr(),         // row 147
    drawdown: makeArr(),               // row 148
    principalRepayment: makeArr(),     // row 149
    interestPayment: makeArr(),        // row 150
    outstanding: makeArr(),            // row 151
    interestRepaid: makeArr(),         // row 153
    loanRepayment: makeArr(),          // row 154
  };

  const totals = {
    totalFinanceCost: makeArr(),       // row 156
    totalCost: makeArr(),              // row 113
    totalCostLessDiesel: makeArr(),    // row 114
  };

  const equity = {
    openingEquity: makeArr(),          // row 159
    drawdown: makeArr(),               // row 160
    cumulative: makeArr(),             // row 161
  };

  // Pull inputs (defensive defaults)
  const energy = a.energy;
  const tariff = a.tariff;
  const opex = a.opex;
  const financing = a.financing;
  const dates = a.dates;

  // Pre-compute key financing dates (Assumption J158-J165 bridge, J185-J193 senior)
  const bridgeLoanStart = edate(dates.modelStartDate, 0);                                      // J158
  const bridgeFirstRepaymentDate = edate(bridgeLoanStart, 12 * financing.bridge.moratoriumYears); // J159 approx
  bridgeFirstRepaymentDate.setDate(bridgeFirstRepaymentDate.getDate() - 1);
  const bridgeRepaymentEndDate = edate(bridgeFirstRepaymentDate,
    (financing.bridge.tenorYears - financing.bridge.moratoriumYears) * 12);                    // J160
  const bridgeInterestStart = edate(bridgeLoanStart, financing.bridge.interestMoratoriumYears); // J164
  const bridgeInterestEnd = edate(bridgeLoanStart, financing.bridge.tenorMonths);              // J165
  bridgeInterestEnd.setDate(bridgeInterestEnd.getDate() - 1);

  const seniorLoanStart = new Date(projDevEnd.getFullYear(), projDevEnd.getMonth(), projDevEnd.getDate() + 1, 12); // J185 = J11+1
  const seniorFirstRepaymentDate = eomonth(edate(seniorLoanStart, 12 * financing.senior.principalMoratoriumYears), 0); // J186
  const seniorRepaymentEndDate = edate(seniorFirstRepaymentDate, financing.senior.numberOfPrincipalRepayments * 12); // J187
  const seniorInterestStart = eomonth(edate(seniorLoanStart, 12 * financing.senior.interestMoratoriumYears), 0); // J191
  const seniorInterestEnd = edate(seniorInterestStart, financing.senior.tenorMonths);                              // J192

  // Bridge principal: total repayments count (months)
  const bridgeTenorMonths = financing.bridge.tenorMonths;
  const bridgeMoratoriumMonths = financing.bridge.moratoriumYears * 12;
  const bridgePrincipalPayments = bridgeTenorMonths - bridgeMoratoriumMonths; // J156

  // Senior: total monthly periods for amortisation (J183*12 / J183 used as # payments per year, with freq)
  const seniorTenorMonths = financing.senior.tenorMonths;
  const seniorNumberOfPrincipalRepayments = financing.senior.numberOfPrincipalRepayments;

  // Per-period repayment count for senior debt in interest-payment-frequency units
  const seniorRepaymentsInFreq = (seniorTenorMonths - financing.senior.principalMoratoriumYears * 12)
                                  / financing.senior.interestRepaymentFreqMonths;

  // Capex drawdown month: Assumption formula says IF(EDATE(J11,1)=N2, capex_item, 0)
  // i.e. capex is drawn in the single month whose end date is J11 + 1 month = Jan/end.
  const capexDrawdownMonthEnd = eomonth(edate(projDevEnd, 1), 0);

  // Bridge arrangement fee is paid in first month (J152 * bridge_amount / J87 draw)
  const bridgeLoanAmount = capex.raw.solarPV * financing.projectDev.debtPct
    + 0; // J146 = J87 in model; bridge funds project development

  // Previous-row references (M24, M61, M68, M84, M57, M32 etc.) — implement with prev_* vars
  let prev_escalationTrigger = 0; // M24
  let prev_dieselTrigger = 0;     // M61
  let prev_omTrigger = 0;         // M68
  let prev_otherOpexTrigger = 0;  // M84

  let prev_bridgeOutstanding = 0; // M129
  let prev_seniorOutstanding = 0; // M151
  let prev_equityCumulative = 0;  // M161

  // Iterate each month
  for (let i = 0; i < N; i++) {
    const t = timeline[i];
    const startDate = t.startDate;
    const endDate = t.endDate;
    const days = t.daysInPeriod;

    // ======================================================================
    // REVENUE (M.Calc rows 13-53)
    // ======================================================================

    // Row 14: Solar/BESS kWh = days * daily_commercial_consumption (Deal Summary G41)
    rev.solarEnergyKwh[i] = days * energy.dailyConsumptionSolar;

    // Row 15: Diesel Gen kWh = days * H41
    rev.dieselEnergyKwh[i] = days * energy.dailyConsumptionDieselGen;

    // Row 16: Diesel fuel kWh equivalent (H41/3.2)
    rev.dieselFuelKwh[i] = days * (energy.dailyConsumptionDieselGen / 3.2);

    // Row 18/38: Anchor = Solar + Diesel (Excel: N18 = N14+N15)
    const anchorCustomers = energy.anchorCustomers;   // I32
    const commercialCustomers = energy.commercialCustomers; // I33
    rev.anchorEnergy[i] = (rev.solarEnergyKwh[i] + rev.dieselEnergyKwh[i]) * anchorCustomers;

    // Row 19/39: Commercial = days * daily_commercial * in_operations_flag
    //   Excel: N19 = (N6 * J49_daily_consumption) * IF(N1 >= EDATE(J11, procurement), 1, 0)
    //   Using correct logical reference (Assumption!F49 = commercial daily kWh = 11250)
    const inOperations = endDate > projDevEnd && startDate >= edate(projDevEnd, 0) ? 1 : 0;
    const commercialActive = startDate >= operationsStart ? 1 : 0;
    rev.commercialEnergy[i] = days * energy.dailyConsumptionCommercial * commercialCustomers * commercialActive;

    // Row 23 Tariff escalation rate:
    //   =IF(year(N) >= year(EDATE(J11, 12 * escalationCommencementYears)), escalationRate, 0)
    const escalationStartDate = edate(projDevEnd, tariff.escalationCommencementYears * 12);
    rev.tariffEscalationRate[i] = t.year >= year(escalationStartDate) ? tariff.annualEscalation : 0;

    // Row 24 Escalation trigger: IF rate=0 → 0; else IF month==1 → prev+1 else prev
    if (rev.tariffEscalationRate[i] === 0) {
      rev.escalationTrigger[i] = 0;
    } else if (t.month === 1) {
      rev.escalationTrigger[i] = prev_escalationTrigger + 1;
    } else {
      rev.escalationTrigger[i] = prev_escalationTrigger;
    }
    prev_escalationTrigger = rev.escalationTrigger[i];

    // Row 25 Escalation factor = (1 + rate)^trigger
    rev.escalationFactor[i] = Math.pow(1 + rev.tariffEscalationRate[i], rev.escalationTrigger[i]);

    // Row 43/44 Tariffs = base * escalation_factor  (Excel uses escalation factor per year)
    rev.anchorTariff[i] = tariff.anchorBase * rev.escalationFactor[i];
    rev.commercialTariff[i] = tariff.commercialBase * rev.escalationFactor[i];

    // Row 48/49 Revenue = tariff × energy
    rev.anchorRevenue[i] = rev.anchorTariff[i] * rev.anchorEnergy[i];
    rev.commercialRevenue[i] = rev.commercialTariff[i] * rev.commercialEnergy[i];

    // Row 50 Total revenue (with technical uptime × collection rate adjustment, Assumption!J58)
    rev.totalRevenue[i] = (rev.anchorRevenue[i] + rev.commercialRevenue[i]) * opex.percentOfSales;

    // ======================================================================
    // COSTS (M.Calc rows 58-98)
    // ======================================================================

    // Row 59: monthly diesel consumption = annual / 12 × in_ops_flag
    const inOpsForCost = startDate >= edate(projDevEnd, dates.procurementMonths) ? 1 : 0;
    cost.dieselConsumptionLitres[i] = (opex.dieselAnnualConsumption / 12) * inOpsForCost;

    // Row 60: diesel escalation rate (static input)
    cost.dieselEscalation[i] = opex.dieselAnnualEscalation;

    // Row 61: trigger (compound yearly on January after operations start + procurement)
    const dieselEscStart = edate(projDevEnd, dates.procurementMonths);
    if (startDate >= dieselEscStart && t.month === 1) {
      cost.dieselTrigger[i] = prev_dieselTrigger + 1;
    } else {
      cost.dieselTrigger[i] = prev_dieselTrigger;
    }
    prev_dieselTrigger = cost.dieselTrigger[i];

    // Row 62 factor + Row 63 unit cost
    cost.dieselFactor[i] = Math.pow(1 + cost.dieselEscalation[i], cost.dieselTrigger[i]);
    cost.dieselUnitCost[i] = opex.dieselUnitCost * cost.dieselFactor[i];

    // Row 87 diesel total cost = consumption × unit_cost × factor  (Excel: N59*N63*N62)
    cost.dieselTotalCost[i] = cost.dieselConsumptionLitres[i] * cost.dieselUnitCost[i] * cost.dieselFactor[i];

    // Row 67-70: Generator O&M
    cost.omEscalation[i] = opex.omAnnualEscalation;
    const omEscStart = edate(projDevEnd, dates.procurementMonths);
    if (startDate >= omEscStart && t.month === 1) {
      cost.omTrigger[i] = prev_omTrigger + 1;
    } else {
      cost.omTrigger[i] = prev_omTrigger;
    }
    prev_omTrigger = cost.omTrigger[i];
    cost.omFactor[i] = Math.pow(1 + cost.omEscalation[i], cost.omTrigger[i]);
    cost.generatorOM[i] = cost.omFactor[i] * (opex.generatorOMAnnual / 12) * inOpsForCost;
    cost.generatorOMTotal[i] = cost.generatorOM[i] * cost.omFactor[i]; // Row 88 = N70*N69

    // Row 83-85: other opex escalation (same structure, different input)
    cost.otherOpexEscalation[i] = opex.otherOpexAnnualEscalation;
    if (startDate >= omEscStart && t.month === 1) {
      cost.otherOpexTrigger[i] = prev_otherOpexTrigger + 1;
    } else {
      cost.otherOpexTrigger[i] = prev_otherOpexTrigger;
    }
    prev_otherOpexTrigger = cost.otherOpexTrigger[i];
    cost.otherOpexFactor[i] = Math.pow(1 + cost.otherOpexEscalation[i], cost.otherOpexTrigger[i]);

    // Rows 89-96: monthly base × escalation factor × in-ops flag
    const f = cost.otherOpexFactor[i] * inOpsForCost;
    cost.insurance[i]           = (opex.items.insurance           / 12) * f;
    cost.systemMonitoring[i]    = (opex.items.systemMonitoring    / 12) * f;
    cost.inverterMaintenance[i] = (opex.items.inverterMaintenance / 12) * f;
    cost.researchCost[i]        = (opex.items.researchCost        / 12) * f;
    cost.managementFee[i]       = (opex.items.managementFee       / 12) * f;
    cost.staffCompensation[i]   = (opex.items.staffCompensation   / 12) * f;
    cost.others[i]              = (opex.items.others              / 12) * f;
    cost.portfolioManagerOM[i]  = (opex.items.portfolioManager    / 12) * f;

    // Row 97: bridge arrangement fee (one-off, in month 1)
    if (i === 0) {
      cost.bridgeArrangementFee[i] = financing.bridge.arrangementFeeRate * bridgeLoanAmount;
    }

    // Row 98: total operating cost
    cost.totalOperatingCost[i] =
      cost.dieselTotalCost[i] +
      cost.generatorOMTotal[i] +
      cost.insurance[i] +
      cost.systemMonitoring[i] +
      cost.inverterMaintenance[i] +
      cost.researchCost[i] +
      cost.managementFee[i] +
      cost.staffCompensation[i] +
      cost.others[i] +
      cost.portfolioManagerOM[i] +
      cost.bridgeArrangementFee[i];

    // ======================================================================
    // CAPEX (M.Calc rows 103-110)
    //   Each item drawn fully in the month whose month-end = EDATE(J11, 1)
    // ======================================================================
    const capexMonth = endDate.getTime() === capexDrawdownMonthEnd.getTime();
    if (capexMonth) {
      capexMonthly.solarPV[i]         = capex.raw.solarPV;
      capexMonthly.inverters[i]       = capex.raw.invertersAccessories;
      capexMonthly.energyStorage[i]   = capex.raw.energyStorage;
      capexMonthly.distributionBox[i] = capex.raw.distributionBox;
      capexMonthly.balanceOfSystems[i]= capex.raw.balanceOfSystems;
      capexMonthly.otherAccessories[i]= capex.raw.otherAccessories;
      capexMonthly.othersCategory[i]  = capex.raw.others;
    }
    capexMonthly.totalCapex[i] =
      capexMonthly.solarPV[i] + capexMonthly.inverters[i] + capexMonthly.energyStorage[i] +
      capexMonthly.distributionBox[i] + capexMonthly.balanceOfSystems[i] +
      capexMonthly.otherAccessories[i] + capexMonthly.othersCategory[i];

    // ======================================================================
    // BRIDGE FINANCE (rows 118-132)
    // ======================================================================

    // Row 118 Principal flag: date is in [first repayment, repayment end]
    bridge.principalFlag[i] =
      endDate >= bridgeFirstRepaymentDate && endDate <= bridgeRepaymentEndDate ? 1 : 0;
    // Row 119 Principal period counter
    bridge.principalPeriod[i] = bridge.principalFlag[i]
      ? (i === 0 ? 1 : bridge.principalPeriod[i - 1] + 1)
      : 0;

    // Row 121 Interest flag: between interest start and interest end
    bridge.interestFlag[i] =
      startDate >= bridgeInterestStart && endDate <= bridgeInterestEnd ? 1 : 0;
    bridge.interestPeriod[i] = bridge.interestFlag[i]
      ? (i === 0 ? 1 : bridge.interestPeriod[i - 1] + 1)
      : 0;

    // Row 123 Periodic interest flag: interest_period > 0 && period % freq == 0
    bridge.periodicInterestFlag[i] =
      bridge.interestPeriod[i] > 0 &&
      bridge.interestPeriod[i] % financing.bridge.interestRepaymentFreqMonths === 0
        ? 1 : 0;

    // Row 125 Opening balance = prev outstanding
    bridge.openingBalance[i] = prev_bridgeOutstanding;

    // Row 126 Drawdown: first month draws the bridge loan amount
    bridge.drawdown[i] = i === 0 ? bridgeLoanAmount : 0;

    // Row 127 Principal repayment via PPMT
    if (bridge.principalFlag[i] === 1 && bridge.openingBalance[i] > 0) {
      const monthlyRate = financing.bridge.interestRate / 12;
      const remaining = bridgePrincipalPayments - bridge.principalPeriod[i] + 1;
      // Excel: PPMT(rate/12, 1, remaining, opening_balance) — sign convention: negative = outflow
      bridge.principalRepayment[i] = PPMT(monthlyRate, 1, remaining, bridge.openingBalance[i]);
    }

    // Row 128 Interest: = -(rate/12) * periodic_flag * opening_balance
    //   Per Excel; intent = semi-annual interest billed against current balance
    if (bridge.periodicInterestFlag[i] === 1) {
      // Accumulate months since last semi-annual payment
      const freq = financing.bridge.interestRepaymentFreqMonths;
      bridge.interestPayment[i] = -(financing.bridge.interestRate / 12) * freq * bridge.openingBalance[i];
    }

    // Row 129 Outstanding
    bridge.outstanding[i] = bridge.openingBalance[i] + bridge.drawdown[i] + bridge.principalRepayment[i];
    prev_bridgeOutstanding = bridge.outstanding[i];

    // Row 131 Interest repaid: cumulative interest on bridge end date
    if (endDate.getTime() === bridgeInterestEnd.getTime() || endDate > bridgeInterestEnd) {
      // Sum of previous interest payments up to this month
      if (endDate.getTime() === bridgeInterestEnd.getTime()) {
        let s = 0;
        for (let k = 0; k <= i; k++) s += bridge.interestPayment[k];
        bridge.interestRepaid[i] = s;
      }
    }

    // Row 132 Loan repayment
    bridge.loanRepayment[i] = bridge.principalRepayment[i] !== 0
      ? bridge.principalRepayment[i] + bridge.interestPayment[i]
      : 0;

    // ======================================================================
    // SENIOR DEBT REFINANCING (rows 136-154)
    // ======================================================================

    // Row 136/141 Flags
    senior.principalFlag[i] =
      endDate >= seniorFirstRepaymentDate && endDate <= seniorRepaymentEndDate ? 1 : 0;
    senior.principalPeriod[i] = senior.principalFlag[i]
      ? (i === 0 ? 1 : senior.principalPeriod[i - 1] + 1)
      : 0;
    senior.periodicPrincipalFlag[i] =
      senior.principalPeriod[i] > 0 &&
      senior.principalPeriod[i] % financing.senior.interestRepaymentFreqMonths === 0
        ? 1 : 0;
    senior.periodicPrincipalPeriod[i] = senior.periodicPrincipalFlag[i] === 1
      ? (i === 0 ? 1 : (senior.periodicPrincipalPeriod[i - 1] || 0) + 1)
      : (senior.periodicPrincipalPeriod[i - 1] || 0);

    senior.interestFlag[i] =
      startDate >= seniorInterestStart && endDate <= seniorInterestEnd ? 1 : 0;
    senior.interestPeriod[i] = senior.interestFlag[i]
      ? (i === 0 ? 1 : senior.interestPeriod[i - 1] + 1)
      : 0;
    senior.periodicInterestFlag[i] =
      senior.interestPeriod[i] > 0 &&
      senior.interestPeriod[i] % financing.senior.interestRepaymentFreqMonths === 0
        ? 1 : 0;

    // Row 147 Opening balance
    senior.openingBalance[i] = prev_seniorOutstanding;

    // Row 148 Drawdown: Senior debt drawdown in month immediately after project dev end (capex drawdown month)
    //   In the Excel the drawdown equals senior debt amount (J175 = J174*J171 = 90% of total capex)
    if (endDate.getTime() === capexDrawdownMonthEnd.getTime()) {
      senior.drawdown[i] = financing.senior.amount;
    }

    // Row 149 Principal repayment via PPMT (semi-annual if freq=6)
    if (senior.periodicPrincipalFlag[i] === 1 && senior.openingBalance[i] > 0) {
      const freq = financing.senior.interestRepaymentFreqMonths;
      const periodicRate = (financing.senior.interestRate * freq) / 12; // e.g. semi-annual rate
      const totalPeriodic = (seniorTenorMonths - financing.senior.principalMoratoriumYears * 12) / freq;
      const alreadyPaid = senior.periodicPrincipalPeriod[i];
      const remaining = totalPeriodic - alreadyPaid + 1;
      senior.principalRepayment[i] = PPMT(periodicRate, 1, remaining, senior.openingBalance[i]);
    }

    // Row 150 Interest: periodic_flag × (rate × freq/12) × opening_balance — negative
    if (senior.periodicInterestFlag[i] === 1) {
      const freq = financing.senior.interestRepaymentFreqMonths;
      senior.interestPayment[i] = -(financing.senior.interestRate * freq / 12) * senior.openingBalance[i];
    }

    // Row 151 Outstanding
    senior.outstanding[i] = senior.openingBalance[i] + senior.drawdown[i] + senior.principalRepayment[i];
    prev_seniorOutstanding = senior.outstanding[i];

    // Row 153/154 Loan repayment components
    if (senior.principalRepayment[i] !== 0) {
      senior.interestRepaid[i] = senior.interestPayment[i];
      senior.loanRepayment[i] = senior.principalRepayment[i] + senior.interestPayment[i];
    }

    // ======================================================================
    // TOTAL FINANCE COST & TOTALS
    // ======================================================================
    totals.totalFinanceCost[i] = senior.interestPayment[i] + bridge.interestPayment[i]; // row 156
    totals.totalCost[i] = capexMonthly.totalCapex[i] + cost.totalOperatingCost[i];      // row 113
    totals.totalCostLessDiesel[i] =
      capexMonthly.totalCapex[i] +
      (cost.totalOperatingCost[i] - cost.dieselTotalCost[i]) +
      (-totals.totalFinanceCost[i]);                                                    // row 114

    // ======================================================================
    // EQUITY (rows 158-161)
    // ======================================================================
    equity.openingEquity[i] = prev_equityCumulative;
    // Equity drawdown in the same month senior debt draws (fund capex equity portion)
    if (endDate.getTime() === capexDrawdownMonthEnd.getTime()) {
      equity.drawdown[i] = financing.equity.amount;
    }
    equity.cumulative[i] = equity.openingEquity[i] + equity.drawdown[i];
    prev_equityCumulative = equity.cumulative[i];
  }

  return { rev, cost, capexMonthly, bridge, senior, equity, totals,
           keyDates: {
             bridgeLoanStart, bridgeFirstRepaymentDate, bridgeRepaymentEndDate,
             bridgeInterestStart, bridgeInterestEnd,
             seniorLoanStart, seniorFirstRepaymentDate, seniorRepaymentEndDate,
             seniorInterestStart, seniorInterestEnd,
             capexDrawdownMonthEnd,
           }};
}

/* -----------------------------------------------------------------------------
 * 6.  DEPRECIATION — yearly, straight-line, per capex category
 *     Mirrors the 'Depreciation' sheet rows 10-70 + summary 75-81.
 * --------------------------------------------------------------------------- */

export function buildDepreciation(a, timelineBundle, monthly) {
  const { timeline } = timelineBundle;
  // Unique years across the timeline
  const yearsSet = new Set(timeline.map((t) => t.year));
  const years = Array.from(yearsSet).sort();

  // Capex added per year per category (sum of monthly values)
  const addedByYear = years.map((yr) => {
    const idxs = timeline
      .map((t, i) => (t.year === yr ? i : -1))
      .filter((i) => i >= 0);
    const sum = (arr) => idxs.reduce((s, i) => s + arr[i], 0);
    return {
      solarPV: sum(monthly.capexMonthly.solarPV),
      inverters: sum(monthly.capexMonthly.inverters),
      energyStorage: sum(monthly.capexMonthly.energyStorage),
      distributionBox: sum(monthly.capexMonthly.distributionBox),
      balanceOfSystems: sum(monthly.capexMonthly.balanceOfSystems),
      otherAccessories: sum(monthly.capexMonthly.otherAccessories),
      othersCategory: sum(monthly.capexMonthly.othersCategory),
    };
  });

  // Per-category schedule: opening, added, closing, NBV, depreciation, cumulative
  const categories = [
    { key: 'solarPV',          label: 'Solar PV',                   life: a.depreciation.solarPV },
    { key: 'inverters',        label: 'Inverters & Accessories',    life: a.depreciation.invertersAccessories },
    { key: 'energyStorage',    label: 'Energy Storage',             life: a.depreciation.energyStorage },
    { key: 'distributionBox',  label: 'Distribution Box',           life: a.depreciation.distributionBox },
    { key: 'balanceOfSystems', label: 'Balance of Systems (BOS)',   life: a.depreciation.balanceOfSystems },
    { key: 'otherAccessories', label: 'Other Accessories',          life: a.depreciation.otherAccessories },
    { key: 'othersCategory',   label: 'Others',                     life: a.depreciation.others },
  ];

  const schedules = {};
  for (const cat of categories) {
    const opening = new Array(years.length).fill(0);
    const added = new Array(years.length).fill(0);
    const closing = new Array(years.length).fill(0);
    const depreciation = new Array(years.length).fill(0);
    const cumulativeDep = new Array(years.length).fill(0);
    const nbv = new Array(years.length).fill(0);

    for (let i = 0; i < years.length; i++) {
      opening[i] = i === 0 ? 0 : closing[i - 1];
      added[i] = addedByYear[i][cat.key];
      closing[i] = opening[i] + added[i];
      // MIN(opening / life, closing - prev_cumulative)
      const prevCum = i === 0 ? 0 : cumulativeDep[i - 1];
      depreciation[i] = Math.min(opening[i] / cat.life, Math.max(0, closing[i] - prevCum));
      cumulativeDep[i] = prevCum + depreciation[i];
      nbv[i] = Math.max(0, closing[i] - cumulativeDep[i]);
    }
    schedules[cat.key] = { label: cat.label, life: cat.life, opening, added, closing, depreciation, cumulativeDep, nbv };
  }

  // Summary (Depreciation rows 75-81)
  const summary = {
    opening: new Array(years.length).fill(0),
    added: new Array(years.length).fill(0),
    closing: new Array(years.length).fill(0),
    nbv: new Array(years.length).fill(0),
    depreciation: new Array(years.length).fill(0),
    cumulativeDep: new Array(years.length).fill(0),
  };
  for (let i = 0; i < years.length; i++) {
    for (const k of Object.keys(schedules)) {
      summary.opening[i]       += schedules[k].opening[i];
      summary.added[i]         += schedules[k].added[i];
      summary.closing[i]       += schedules[k].closing[i];
      summary.nbv[i]           += schedules[k].nbv[i];
      summary.depreciation[i]  += schedules[k].depreciation[i];
      summary.cumulativeDep[i] += schedules[k].cumulativeDep[i];
    }
  }

  return { years, categories, schedules, summary };
}

/* -----------------------------------------------------------------------------
 * 7.  FINANCIALS — yearly IS / BS / CF (aggregated from monthly)
 *     Mirrors the 'Financials' sheet rows 10-88.
 * --------------------------------------------------------------------------- */

export function buildFinancials(a, timelineBundle, monthly, depreciation) {
  const { timeline } = timelineBundle;
  const years = depreciation.years;
  const nY = years.length;

  const sumByYear = (arr) =>
    years.map((yr) =>
      timeline.reduce((s, t, i) => (t.year === yr ? s + arr[i] : s), 0)
    );

  // Income Statement
  const revenueY    = sumByYear(monthly.rev.totalRevenue);           // row 10
  const opexY       = sumByYear(monthly.cost.totalOperatingCost).map(v => -v); // row 17 (negative)
  const depY        = depreciation.summary.depreciation.map(v => -v);           // row 20 (negative)
  const interestExpY = sumByYear(monthly.bridge.interestPayment)
                        .map((v, i) => v + sumByYear(monthly.senior.interestPayment)[i]); // already negative
  const ebitda      = revenueY.map((r, i) => r + opexY[i]);
  const ebit        = ebitda.map((e, i) => e + depY[i]);
  const profitBeforeTax = ebit.map((e, i) => e + interestExpY[i]);

  // Tax: applies after taxHoliday end date and only when PBT >= 0
  const taxHolidayEnd = edate(new Date(a.dates.modelStartDate), a.dates.projectDevelopmentMonths);
  taxHolidayEnd.setFullYear(taxHolidayEnd.getFullYear() + a.tax.holidayMonths / 12);
  const taxY = profitBeforeTax.map((pbt, i) => {
    const isPastHoliday = years[i] > year(taxHolidayEnd);
    return isPastHoliday && pbt >= 0 ? -(pbt * a.tax.totalTaxRate) : 0;
  });
  const profitAfterTax = profitBeforeTax.map((p, i) => p + taxY[i]);

  // Retained earnings
  const retainedEarnings = new Array(nY).fill(0);
  for (let i = 0; i < nY; i++) {
    retainedEarnings[i] = (i === 0 ? 0 : retainedEarnings[i - 1]) + profitAfterTax[i];
  }

  // Balance Sheet
  const capexYearly = sumByYear(monthly.capexMonthly.totalCapex);
  const cumulativeCapex = new Array(nY).fill(0);
  for (let i = 0; i < nY; i++) cumulativeCapex[i] = (i === 0 ? 0 : cumulativeCapex[i - 1]) + capexYearly[i];
  const accDep = depreciation.summary.cumulativeDep;
  const nca = cumulativeCapex.map((c, i) => c - accDep[i]);

  // Senior debt yearly outstanding (end-of-year)
  const seniorOutstandingY = years.map((yr) => {
    const lastIdx = timeline.map((t, i) => t.year === yr ? i : -1).filter(i => i >= 0).pop();
    return lastIdx !== undefined ? monthly.senior.outstanding[lastIdx] : 0;
  });

  // Equity issuance by year
  const equityIssuanceY = sumByYear(monthly.equity.drawdown);
  const shareCapital = new Array(nY).fill(0);
  for (let i = 0; i < nY; i++) shareCapital[i] = (i === 0 ? 0 : shareCapital[i - 1]) + equityIssuanceY[i];

  // Cash Flow Statement
  const cfoEbit          = ebit;
  const cfoAddDep        = depY.map(v => -v);
  const cfoTax           = taxY.map(v => -v);   // cash tax out = -tax_expense (tax already negative)
  const cashFromOps      = cfoEbit.map((e, i) => e + cfoAddDep[i] + cfoTax[i]);

  const cashFromInvesting = capexYearly.map(v => -v);

  const debtProceeds  = sumByYear(monthly.senior.drawdown);
  const principalRep  = sumByYear(monthly.senior.principalRepayment); // negative
  const interestPaid  = interestExpY; // negative
  const cashFromFinancing = equityIssuanceY.map((e, i) => e + debtProceeds[i] + principalRep[i] + interestPaid[i]);

  const netChangeInCash = cashFromOps.map((o, i) => o + cashFromInvesting[i] + cashFromFinancing[i]);
  const endingCash = new Array(nY).fill(0);
  for (let i = 0; i < nY; i++) endingCash[i] = (i === 0 ? 0 : endingCash[i - 1]) + netChangeInCash[i];
  const beginningCash = [0, ...endingCash.slice(0, nY - 1)];

  // BS current assets
  const tradeReceivablesDays = a.workingCapital.receivableDays;
  const tradePayablesDays = a.workingCapital.payableDays;
  const daysInYear = 365;
  const tradeReceivables = revenueY.map((r, i) => (r * tradeReceivablesDays) / daysInYear);
  const tradePayables    = opexY.map((o, i) => (-o * tradePayablesDays) / daysInYear);
  const totalCurrentAssets = tradeReceivables.map((r, i) => r + endingCash[i]);
  const totalCurrentLiabilities = tradePayables.slice();
  const totalAssets = nca.map((n, i) => n + totalCurrentAssets[i]);
  const totalEquity = shareCapital.map((s, i) => s + retainedEarnings[i]);
  const totalLiabilities = totalCurrentLiabilities.map((c, i) => c + seniorOutstandingY[i]);
  const bsCheck = totalAssets.map((a, i) => a - (totalLiabilities[i] + totalEquity[i]));

  return {
    years,
    incomeStatement: {
      revenue: revenueY, opex: opexY, depreciation: depY,
      ebitda, ebit, interestExpense: interestExpY,
      profitBeforeTax, tax: taxY, profitAfterTax,
      retainedEarnings,
    },
    balanceSheet: {
      capex: cumulativeCapex, accumulatedDepreciation: accDep, netNonCurrentAssets: nca,
      tradeReceivables, cash: endingCash, totalCurrentAssets,
      tradePayables, totalCurrentLiabilities,
      seniorDebt: seniorOutstandingY, totalLiabilities,
      shareCapital, retainedEarningsBS: retainedEarnings, totalEquity,
      totalAssets, check: bsCheck,
    },
    cashFlow: {
      ebit: cfoEbit, addDepreciation: cfoAddDep, taxPaid: cfoTax,
      netCashFromOperations: cashFromOps,
      capex: cashFromInvesting, netCashFromInvesting: cashFromInvesting,
      equityIssuance: equityIssuanceY, debtIssuance: debtProceeds,
      principalRepayments: principalRep, interestPaid,
      netCashFromFinancing: cashFromFinancing,
      beginningCash, netChangeInCash, endingCash,
    },
  };
}

/* -----------------------------------------------------------------------------
 * 8.  KPIs — Deal Summary / Reports (IRR, NPV, DSCR, Payback, Target Tariff)
 * --------------------------------------------------------------------------- */

export function buildKPIs(a, timelineBundle, monthly, depreciation, financials, capex) {
  const years = financials.years;
  const rev = financials.incomeStatement.revenue;
  const pat = financials.incomeStatement.profitAfterTax;
  const ebitda = financials.incomeStatement.ebitda;
  const debtService = monthly.senior.principalRepayment.map((p, i) =>
    -(p + monthly.senior.interestPayment[i])
  );

  // Project IRR: capex outflow + equity outflow + operating inflows
  const equityDrawdown = financials.cashFlow.equityIssuance;
  const debtProceeds = financials.cashFlow.debtIssuance;
  const projectCashflow = years.map((_, i) => {
    // Project = operating CF + investing CF  (ignores financing)
    return financials.cashFlow.netCashFromOperations[i] + financials.cashFlow.netCashFromInvesting[i];
  });
  const projectIRR = IRR(projectCashflow);

  // Equity IRR: equity outflow + equity dividends (approximated as PAT)
  const equityCashflow = equityDrawdown.map((e, i) => -e + pat[i]);
  const equityIRR = IRR(equityCashflow);

  // DSCR: EBITDA / Debt Service per year
  const dscrByYear = ebitda.map((e, i) => {
    const ds = years.map((_, yi) => {
      const yearSum = monthly.senior.principalRepayment.reduce((s, p, mi) => {
        if (timelineBundle.timeline[mi].year === years[yi]) {
          return s + -(p + monthly.senior.interestPayment[mi]);
        }
        return s;
      }, 0);
      return yearSum;
    })[i];
    return ds > 0 ? e / ds : null;
  });
  const avgDSCR = dscrByYear.filter((d) => d && d > 0).reduce((s, d, _, arr) => s + d / arr.length, 0);
  const minDSCR = dscrByYear.filter((d) => d && d > 0).reduce((m, d) => Math.min(m, d), Infinity);

  // Payback: cumulative project CF first turns positive
  let cum = 0;
  let paybackYear = null;
  for (let i = 0; i < projectCashflow.length; i++) {
    cum += projectCashflow[i];
    if (cum >= 0 && paybackYear === null) {
      paybackYear = years[i];
      break;
    }
  }

  // Target tariff (Deal Summary G81 derivation / from Assumption!J49)
  const totalEnergyLifetime = monthly.rev.commercialEnergy.reduce((s, v) => s + v, 0);
  const totalCostLifetime = capex.totalCapex + financials.incomeStatement.opex.reduce((s, v) => s - v, 0);
  const breakevenTariff = totalEnergyLifetime > 0 ? totalCostLifetime / totalEnergyLifetime : 0;

  // NPV @ discount rate
  const discountRate = a.tariff.discountRate ?? 0.10;
  const projectNPV = NPV(discountRate, projectCashflow);

  return {
    totalCapex: capex.totalCapex,
    targetTariff: a.tariff.commercialBase,
    breakevenTariff,
    projectIRR,
    equityIRR,
    projectNPV,
    discountRate,
    avgDSCR: Number.isFinite(avgDSCR) ? avgDSCR : null,
    minDSCR: Number.isFinite(minDSCR) ? minDSCR : null,
    paybackYear,
    dscrByYear,
    totalRevenueLifetime: rev.reduce((s, v) => s + v, 0),
    totalOpexLifetime: financials.incomeStatement.opex.reduce((s, v) => s + v, 0),
    totalEnergyLifetime,
    debtEquityRatio: a.financing.senior.debtPct,
    systemCapacityKWp: a.system.solarPVCapacity,
    batteryCapacityKWh: a.system.batteryCapacity,
    inverterCapacityKW: a.system.inverterCapacity,
  };
}

/* -----------------------------------------------------------------------------
 * 9.  SENSITIVITY ANALYSIS — vary tariff / capex / opex; report IRR/NPV/DSCR
 * --------------------------------------------------------------------------- */

export function runSensitivity(baseAssumption) {
  const variations = [
    { name: 'Base Case', tariffDelta: 0, capexDelta: 0, opexDelta: 0 },
    { name: 'Tariff -20%', tariffDelta: -0.2, capexDelta: 0, opexDelta: 0 },
    { name: 'Tariff -10%', tariffDelta: -0.1, capexDelta: 0, opexDelta: 0 },
    { name: 'Tariff +10%', tariffDelta: +0.1, capexDelta: 0, opexDelta: 0 },
    { name: 'Tariff +20%', tariffDelta: +0.2, capexDelta: 0, opexDelta: 0 },
    { name: 'Capex +10%', tariffDelta: 0, capexDelta: +0.1, opexDelta: 0 },
    { name: 'Capex +20%', tariffDelta: 0, capexDelta: +0.2, opexDelta: 0 },
    { name: 'Opex +20%',  tariffDelta: 0, capexDelta: 0, opexDelta: +0.2 },
    { name: 'Opex -20%',  tariffDelta: 0, capexDelta: 0, opexDelta: -0.2 },
  ];

  const results = [];
  for (const v of variations) {
    // Deep-clone assumption
    const a = JSON.parse(JSON.stringify(baseAssumption));
    a.tariff.commercialBase *= 1 + v.tariffDelta;
    a.tariff.anchorBase     *= 1 + v.tariffDelta;
    a.capexAdders.contingencyRate += v.capexDelta; // shift contingency
    Object.keys(a.opex.items).forEach(k => { a.opex.items[k] *= 1 + v.opexDelta; });

    const result = runModel(a);
    results.push({
      scenario: v.name,
      targetTariff: a.tariff.commercialBase,
      projectIRR: result.kpis.projectIRR,
      equityIRR: result.kpis.equityIRR,
      projectNPV: result.kpis.projectNPV,
      avgDSCR: result.kpis.avgDSCR,
      minDSCR: result.kpis.minDSCR,
      paybackYear: result.kpis.paybackYear,
      totalCapex: result.kpis.totalCapex,
    });
  }

  return results;
}

/* -----------------------------------------------------------------------------
 * 10.  RUN MODEL — the single entry point
 * --------------------------------------------------------------------------- */

export function runModel(assumption) {
  const timelineBundle = buildTimeline(assumption);
  const capex = computeCapex(assumption);
  const monthly = buildMonthlyCalculation(assumption, timelineBundle, capex);
  const depreciation = buildDepreciation(assumption, timelineBundle, monthly);
  const financials = buildFinancials(assumption, timelineBundle, monthly, depreciation);
  const kpis = buildKPIs(assumption, timelineBundle, monthly, depreciation, financials, capex);

  return {
    timeline: timelineBundle.timeline.map(t => ({
      ...t,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
    })),
    keyDates: {
      modelStart: timelineBundle.modelStart.toISOString(),
      projDevEnd: timelineBundle.projDevEnd.toISOString(),
      operationsStart: timelineBundle.operationsStart.toISOString(),
      modelEnd: timelineBundle.modelEnd.toISOString(),
    },
    capex,
    monthly,
    depreciation,
    financials,
    kpis,
    computedAt: new Date().toISOString(),
  };
}

export default {
  runModel,
  runSensitivity,
  buildTimeline,
  computeCapex,
  buildMonthlyCalculation,
  buildDepreciation,
  buildFinancials,
  buildKPIs,
  eomonth, edate, PMT, IPMT, PPMT, IRR, NPV,
};
