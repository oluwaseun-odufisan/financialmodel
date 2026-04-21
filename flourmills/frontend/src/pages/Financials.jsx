import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions, cn } from '../lib/utils.js';

function Row({ label, arr, strong, accent, indent = 0, negativeCheck = false }) {
  return (
    <TR className={cn(strong && 'bg-[var(--surface-muted)] font-semibold', accent && 'bg-primary-50 font-semibold text-primary')}>
      <TD className={cn(strong && 'font-semibold', accent && 'font-semibold text-primary')} style={{ paddingLeft: `${0.75 + indent}rem` }}>
        {label}
      </TD>
      {arr.map((value, index) => (
        <TD key={index} align="right" className={cn(negativeCheck && value < 0 && 'text-red-600', accent && 'font-semibold text-primary')}>
          {fmtMillions(value, 1)}
        </TD>
      ))}
    </TR>
  );
}

export default function Financials() {
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

  const financials = current.result.financials;
  const years = financials.years;

  const SectionBand = ({ children }) => (
    <TR>
      <TD colSpan={years.length + 1} className="bg-primary-50 text-xs font-semibold uppercase tracking-wide text-primary">{children}</TD>
    </TR>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Aggregated Yearly View</div>
        <h1 className="text-2xl font-semibold text-[var(--text-main)]">Financials</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Income Statement · Balance Sheet · Cash Flow (NGN millions)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Statements</CardTitle>
          <CardDescription>Rolled up from the monthly engine.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs defaultValue="is">
            <TabsList>
              <TabsTrigger value="is">Income Statement</TabsTrigger>
              <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
              <TabsTrigger value="cf">Cash Flow</TabsTrigger>
            </TabsList>

            <TabsContent value="is">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-72">Line Item</TH>
                    {years.map((year) => <TH key={year} align="right">{year}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <Row label="Revenue" arr={financials.incomeStatement.revenue} />
                  <Row label="Opex" arr={financials.incomeStatement.opex} negativeCheck />
                  <Row label="EBITDA" arr={financials.incomeStatement.ebitda} strong />
                  <Row label="Depreciation" arr={financials.incomeStatement.depreciation} negativeCheck />
                  <Row label="EBIT" arr={financials.incomeStatement.ebit} strong />
                  <Row label="Interest Expense" arr={financials.incomeStatement.interestExpense} negativeCheck />
                  <Row label="PBT" arr={financials.incomeStatement.profitBeforeTax} strong />
                  <Row label="Tax" arr={financials.incomeStatement.tax} negativeCheck />
                  <Row label="Profit After Tax" arr={financials.incomeStatement.profitAfterTax} accent />
                  <Row label="Retained Earnings (c/f)" arr={financials.incomeStatement.retainedEarnings} />
                </TBody>
              </Table>
            </TabsContent>

            <TabsContent value="bs">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-72">Line Item</TH>
                    {years.map((year) => <TH key={year} align="right">{year}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <SectionBand>Non-current Assets</SectionBand>
                  <Row label="Capex (cumulative)" arr={financials.balanceSheet.capex} indent={1} />
                  <Row label="Accumulated Depreciation" arr={financials.balanceSheet.accumulatedDepreciation.map((value) => -value)} indent={1} negativeCheck />
                  <Row label="Net non-current assets" arr={financials.balanceSheet.netNonCurrentAssets} strong indent={1} />

                  <SectionBand>Current Assets</SectionBand>
                  <Row label="Trade Receivables" arr={financials.balanceSheet.tradeReceivables} indent={1} />
                  <Row label="Cash" arr={financials.balanceSheet.cash} indent={1} />
                  <Row label="Total current assets" arr={financials.balanceSheet.totalCurrentAssets} strong indent={1} />
                  <Row label="Total Assets" arr={financials.balanceSheet.totalAssets} accent />

                  <SectionBand>Liabilities</SectionBand>
                  <Row label="Trade Payables" arr={financials.balanceSheet.tradePayables} indent={1} />
                  <Row label="Senior Debt" arr={financials.balanceSheet.seniorDebt} indent={1} />
                  <Row label="Total Liabilities" arr={financials.balanceSheet.totalLiabilities} strong />

                  <SectionBand>Equity</SectionBand>
                  <Row label="Share Capital" arr={financials.balanceSheet.shareCapital} indent={1} />
                  <Row label="Retained Earnings" arr={financials.balanceSheet.retainedEarningsBS} indent={1} />
                  <Row label="Total Equity" arr={financials.balanceSheet.totalEquity} accent />
                  <Row label="Check (A - L - E)" arr={financials.balanceSheet.check} />
                </TBody>
              </Table>
            </TabsContent>

            <TabsContent value="cf">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-72">Line Item</TH>
                    {years.map((year) => <TH key={year} align="right">{year}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <SectionBand>Operating</SectionBand>
                  <Row label="EBIT" arr={financials.cashFlow.ebit} indent={1} />
                  <Row label="Add: Depreciation" arr={financials.cashFlow.addDepreciation} indent={1} />
                  <Row label="Tax paid" arr={financials.cashFlow.taxPaid} indent={1} negativeCheck />
                  <Row label="Net cash from ops" arr={financials.cashFlow.netCashFromOperations} strong />

                  <SectionBand>Investing</SectionBand>
                  <Row label="Capex" arr={financials.cashFlow.capex} indent={1} negativeCheck />
                  <Row label="Net cash from investing" arr={financials.cashFlow.netCashFromInvesting} strong />

                  <SectionBand>Financing</SectionBand>
                  <Row label="Equity Issuance" arr={financials.cashFlow.equityIssuance} indent={1} />
                  <Row label="Debt Issuance Proceeds" arr={financials.cashFlow.debtIssuance} indent={1} />
                  <Row label="Principal Repayments" arr={financials.cashFlow.principalRepayments} indent={1} negativeCheck />
                  <Row label="Interest paid" arr={financials.cashFlow.interestPaid} indent={1} negativeCheck />
                  <Row label="Net cash from financing" arr={financials.cashFlow.netCashFromFinancing} strong />

                  <Row label="Net change in cash" arr={financials.cashFlow.netChangeInCash} accent />
                  <Row label="Beginning cash" arr={financials.cashFlow.beginningCash} />
                  <Row label="Ending cash" arr={financials.cashFlow.endingCash} accent />
                </TBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
