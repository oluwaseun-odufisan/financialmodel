/* =============================================================================
 * PROJECT TEMPLATES
 *
 * Two templates are available when creating a new project:
 *   1. flour_mills → Exact reproduction of the reference Excel model
 *                    (Flour Mills / Honeywell 3MW Solar + BESS Mini-Grid).
 *                    Every value maps to its Excel cell in a comment.
 *   2. blank       → All numeric fields zeroed so accountants enter every value
 *                    themselves. Preserves the shape of the assumption tree so
 *                    the engine runs safely with zeros.
 *
 * Both templates pass through derive() which computes opex amounts (from % of
 * capex), senior/equity sizing, and the percent-of-sales factor.
 * ===========================================================================*/

/* ---------- FLOUR MILLS (HONEYWELL) PRESET ---------- */
export const FLOUR_MILLS_ASSUMPTION = {
  projectName: 'FLOUR MILLS (HONEYWELL)',
  location: { village: 'FLOUR MILLS (HONEYWELL)', state: 'Ogun', lga: '', ward: '' },

  dates: {
    modelStartDate: '2025-10-01',            // J10
    projectDevelopmentMonths: 3,             // J61
    procurementMonths: 9,                    // J60
    numberOfYearsInModel: 10,                // J14
    hoursInDay: 24, hoursInYear: 8760, numberRounding: 1000,
  },

  macro: { exchangeRate: 1600 },             // J22

  system: {                                  // Deal Summary F87-F90
    solarPVCapacity: 3000, batteryCapacity: 0,
    inverterCapacity: 3000, dieselGeneratorCapacity: 0,
  },

  energy: {                                  // Assumption J31-J38, Deal Summary F21/F22/F41
    anchorCustomers: 0, commercialCustomers: 1,
    dailyConsumptionSolar: 11250, dailyConsumptionDieselGen: 0,
    dailyConsumptionDiesel: 0, dailyConsumptionCommercial: 11250,
  },

  tariff: {                                  // J43, J44, J48, J49
    annualEscalation: 0.10, escalationCommencementYears: 2,
    anchorBase: 0, commercialBase: 207, discountRate: 0.10,
  },

  technical: { uptime: 0.98, collectionRate: 0.98 }, // J56, J57

  opex: {
    percentOfSales: 0.9604,
    dieselAnnualConsumption: 0, dieselUnitCost: 1300,
    dieselAnnualEscalation: 0.10, generatorOMAnnual: 0,
    items: {
      insurance: 0, systemMonitoring: 0, inverterMaintenance: 0,
      researchCost: 0, managementFee: 0, staffCompensation: 0,
      others: 0, portfolioManager: 0,
    },
    opexPercentages: {                       // G73-G80
      insurance: 0.025, systemMonitoring: 0.005, inverterMaintenance: 0.005,
      researchCost: 0, managementFee: 0, staffCompensation: 0.025,
      others: 0.01, portfolioManager: 0.005,
    },
    omAnnualEscalation: 0.05, otherOpexAnnualEscalation: 0.05,
  },

  boq: {                                     // J87-J98 + BOQ sheet roll-up
    solarPV: 705072000, invertersAccessories: 282000000, energyStorage: 0,
    ccmpptStringInverter: 165000000, distributionBox: 28109700,
    balanceOfSystems: 112438800, otherAccessories: 81000000,
    generalCostsCivilWorks: 263447920, others: 0,
  },
  capexAdders: { vatRate: 0.075, contingencyRate: 0.20, managementRate: 0.15 },

  depreciation: {                            // G105-G111 (all 10 years)
    solarPV: 10, invertersAccessories: 10, energyStorage: 10,
    distributionBox: 10, balanceOfSystems: 10, otherAccessories: 10, others: 10,
  },

  tax: { companyIncomeTax: 0.30, educationTax: 0, vat: 0, totalTaxRate: 0.30, holidayMonths: 60 },

  grant: {
    amountPerConnection: 0, totalConnections: 0, exchangeRateForGrant: 1600,
    firstPaymentPct: 0.80, secondPaymentPct: 0.20,
  },

  financing: {
    projectDev: { debtPct: 1.0, equityPct: 0.0 },
    bridge: {
      arrangementFeeRate: 0.02, tenorMonths: 13, tenorYears: 13/12,
      moratoriumYears: 13/12, interestMoratoriumYears: 0,
      interestRate: 0.27, interestRepaymentFreqMonths: 6,
    },
    senior: {
      debtPct: 0.90, equityPct: 0.10, tenorYears: 10, tenorMonths: 120,
      principalMoratoriumYears: 1, numberOfPrincipalRepayments: 10,
      interestRate: 0.20, interestMoratoriumYears: 1,
      interestRepaymentFreqMonths: 6, amount: 0,
    },
    equity: { amount: 0 },
  },

  workingCapital: { receivableDays: 0, payableDays: 0 },

  staff: [                                   // Deal Summary E65-H72
    { role: 'COO',                                 count: 1, unitCost: 0 },
    { role: 'Project Engineer',                    count: 1, unitCost: 0 },
    { role: 'GIS / Data Scientist / Analyst',      count: 1, unitCost: 0 },
    { role: 'Electrical Engineer / MG Designer',   count: 1, unitCost: 0 },
    { role: 'Technical Analysts',                  count: 2, unitCost: 0 },
    { role: 'Consultants (Shared Services)',       count: 2, unitCost: 0 },
    { role: 'Independent Engineers',               count: 1, unitCost: 0 },
    { role: 'Site Representatives',                count: 2, unitCost: 0 },
  ],
};

/* ---------- BLANK TEMPLATE (all zeros, structure preserved) ---------- */
export const BLANK_ASSUMPTION = {
  projectName: 'New Project',
  location: { village: '', state: '', lga: '', ward: '' },

  dates: {
    modelStartDate: new Date().toISOString().slice(0, 10),
    projectDevelopmentMonths: 0, procurementMonths: 0,
    numberOfYearsInModel: 10,
    hoursInDay: 24, hoursInYear: 8760, numberRounding: 1000,
  },
  macro: { exchangeRate: 0 },
  system: { solarPVCapacity: 0, batteryCapacity: 0, inverterCapacity: 0, dieselGeneratorCapacity: 0 },
  energy: {
    anchorCustomers: 0, commercialCustomers: 0,
    dailyConsumptionSolar: 0, dailyConsumptionDieselGen: 0,
    dailyConsumptionDiesel: 0, dailyConsumptionCommercial: 0,
  },
  tariff: {
    annualEscalation: 0, escalationCommencementYears: 2,
    anchorBase: 0, commercialBase: 0, discountRate: 0.10,
  },
  technical: { uptime: 1.0, collectionRate: 1.0 },
  opex: {
    percentOfSales: 1.0,
    dieselAnnualConsumption: 0, dieselUnitCost: 0,
    dieselAnnualEscalation: 0, generatorOMAnnual: 0,
    items: {
      insurance: 0, systemMonitoring: 0, inverterMaintenance: 0,
      researchCost: 0, managementFee: 0, staffCompensation: 0,
      others: 0, portfolioManager: 0,
    },
    opexPercentages: {
      insurance: 0, systemMonitoring: 0, inverterMaintenance: 0,
      researchCost: 0, managementFee: 0, staffCompensation: 0,
      others: 0, portfolioManager: 0,
    },
    omAnnualEscalation: 0, otherOpexAnnualEscalation: 0,
  },
  boq: {
    solarPV: 0, invertersAccessories: 0, energyStorage: 0, ccmpptStringInverter: 0,
    distributionBox: 0, balanceOfSystems: 0, otherAccessories: 0,
    generalCostsCivilWorks: 0, others: 0,
  },
  capexAdders: { vatRate: 0, contingencyRate: 0, managementRate: 0 },
  depreciation: {
    solarPV: 10, invertersAccessories: 10, energyStorage: 10,
    distributionBox: 10, balanceOfSystems: 10, otherAccessories: 10, others: 10,
  },
  tax: { companyIncomeTax: 0, educationTax: 0, vat: 0, totalTaxRate: 0, holidayMonths: 0 },
  grant: {
    amountPerConnection: 0, totalConnections: 0, exchangeRateForGrant: 0,
    firstPaymentPct: 0.80, secondPaymentPct: 0.20,
  },
  financing: {
    projectDev: { debtPct: 1.0, equityPct: 0.0 },
    bridge: {
      arrangementFeeRate: 0, tenorMonths: 0, tenorYears: 0,
      moratoriumYears: 0, interestMoratoriumYears: 0,
      interestRate: 0, interestRepaymentFreqMonths: 6,
    },
    senior: {
      debtPct: 1.0, equityPct: 0.0, tenorYears: 10, tenorMonths: 120,
      principalMoratoriumYears: 1, numberOfPrincipalRepayments: 10,
      interestRate: 0, interestMoratoriumYears: 1,
      interestRepaymentFreqMonths: 6, amount: 0,
    },
    equity: { amount: 0 },
  },
  workingCapital: { receivableDays: 0, payableDays: 0 },
  staff: [],
};

/* ---------- Derive: compute dependent fields from primitive inputs ---------- */
export function derive(a) {
  const sub =
    (a.boq.solarPV || 0) + (a.boq.invertersAccessories || 0) + (a.boq.energyStorage || 0) +
    (a.boq.ccmpptStringInverter || 0) + (a.boq.distributionBox || 0) + (a.boq.balanceOfSystems || 0) +
    (a.boq.otherAccessories || 0) + (a.boq.generalCostsCivilWorks || 0);

  const vat = (a.capexAdders.vatRate || 0) * sub;
  const cty = (a.capexAdders.contingencyRate || 0) * sub;
  const mgt = (a.capexAdders.managementRate || 0) * sub;
  const totalCapex = sub + vat + cty + mgt + (a.boq.others || 0);

  a.financing.senior.amount = totalCapex * (a.financing.senior.debtPct || 0);
  a.financing.equity.amount = totalCapex * (a.financing.senior.equityPct || 0);

  for (const k of Object.keys(a.opex.opexPercentages || {})) {
    a.opex.items[k] = (a.opex.opexPercentages[k] || 0) * totalCapex;
  }

  a.opex.percentOfSales = (a.technical.uptime || 1) * (a.technical.collectionRate || 1);
  return a;
}

export function flourMillsPreset() {
  return derive(JSON.parse(JSON.stringify(FLOUR_MILLS_ASSUMPTION)));
}

export function blankPreset(projectName = 'New Project') {
  const t = JSON.parse(JSON.stringify(BLANK_ASSUMPTION));
  t.projectName = projectName;
  return derive(t);
}

export function getTemplate(key = 'flour_mills', projectName) {
  if (key === 'blank') return blankPreset(projectName || 'New Project');
  return flourMillsPreset();
}

export const seedDefault = flourMillsPreset;
export default flourMillsPreset;
