import { useProject } from '../contexts/ProjectContext.jsx';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table.jsx';
import { fmtMillions } from '../lib/utils.js';
import { cn } from '../lib/utils.js';

function Row({ label, arr, strong, accent, indent = 0, negativeCheck = false }) {
  return (
    <TR className={cn(
      strong && 'bg-offwhite font-semibold',
      accent && 'bg-primary-50 font-semibold text-primary',
    )}>
      <TD className={cn(strong && 'font-semibold', accent && 'text-primary font-semibold')} style={{ paddingLeft: `${0.75 + indent * 1}rem` }}>
        {label}
      </TD>
      {arr.map((v, i) => (
        <TD key={i} align="right"
            className={cn(
              negativeCheck && v < 0 && 'text-red-600',
              accent && 'text-primary font-semibold',
            )}>
          {fmtMillions(v, 1)}
        </TD>
      ))}
    </TR>
  );
}

export default function Financials() {
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

  const f = current.result.financials;
  const years = f.years;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted uppercase tracking-wider">Aggregated Yearly View</div>
        <h1 className="text-2xl font-semibold text-ink">Financials</h1>
        <p className="text-sm text-muted mt-1">Income Statement · Balance Sheet · Cash Flow (NGN Millions)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Statements</CardTitle>
          <CardDescription>Rolled up from the monthly engine</CardDescription>
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
                    {years.map((y) => <TH key={y} align="right">{y}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <Row label="Revenue"          arr={f.incomeStatement.revenue} />
                  <Row label="Opex"             arr={f.incomeStatement.opex} negativeCheck />
                  <Row label="EBITDA"           arr={f.incomeStatement.ebitda} strong />
                  <Row label="Depreciation"     arr={f.incomeStatement.depreciation} negativeCheck />
                  <Row label="EBIT"             arr={f.incomeStatement.ebit} strong />
                  <Row label="Interest Expense" arr={f.incomeStatement.interestExpense} negativeCheck />
                  <Row label="PBT"              arr={f.incomeStatement.profitBeforeTax} strong />
                  <Row label="Tax"              arr={f.incomeStatement.tax} negativeCheck />
                  <Row label="Profit After Tax" arr={f.incomeStatement.profitAfterTax} accent />
                  <Row label="Retained Earnings (c/f)" arr={f.incomeStatement.retainedEarnings} />
                </TBody>
              </Table>
            </TabsContent>

            <TabsContent value="bs">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-72">Line Item</TH>
                    {years.map((y) => <TH key={y} align="right">{y}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Non-current Assets</TD></TR>
                  <Row label="Capex (cumulative)"     arr={f.balanceSheet.capex} indent={1} />
                  <Row label="Acc. Depreciation"      arr={f.balanceSheet.accumulatedDepreciation.map(v => -v)} indent={1} negativeCheck />
                  <Row label="Net non-current assets" arr={f.balanceSheet.netNonCurrentAssets} strong indent={1} />

                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Current Assets</TD></TR>
                  <Row label="Trade Receivables" arr={f.balanceSheet.tradeReceivables} indent={1} />
                  <Row label="Cash"              arr={f.balanceSheet.cash} indent={1} />
                  <Row label="Total current assets" arr={f.balanceSheet.totalCurrentAssets} strong indent={1} />
                  <Row label="Total Assets"      arr={f.balanceSheet.totalAssets} accent />

                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Liabilities</TD></TR>
                  <Row label="Trade Payables"   arr={f.balanceSheet.tradePayables} indent={1} />
                  <Row label="Senior Debt"      arr={f.balanceSheet.seniorDebt} indent={1} />
                  <Row label="Total Liabilities" arr={f.balanceSheet.totalLiabilities} strong />

                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Equity</TD></TR>
                  <Row label="Share Capital"      arr={f.balanceSheet.shareCapital} indent={1} />
                  <Row label="Retained Earnings"  arr={f.balanceSheet.retainedEarningsBS} indent={1} />
                  <Row label="Total Equity"       arr={f.balanceSheet.totalEquity} accent />

                  <Row label="Check (A − L − E)"  arr={f.balanceSheet.check} />
                </TBody>
              </Table>
            </TabsContent>

            <TabsContent value="cf">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-72">Line Item</TH>
                    {years.map((y) => <TH key={y} align="right">{y}</TH>)}
                  </TR>
                </THead>
                <TBody>
                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Operating</TD></TR>
                  <Row label="EBIT"                 arr={f.cashFlow.ebit} indent={1} />
                  <Row label="Add: Depreciation"    arr={f.cashFlow.addDepreciation} indent={1} />
                  <Row label="Tax paid"             arr={f.cashFlow.taxPaid} indent={1} negativeCheck />
                  <Row label="Net cash from ops"    arr={f.cashFlow.netCashFromOperations} strong />

                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Investing</TD></TR>
                  <Row label="Capex"                    arr={f.cashFlow.capex} indent={1} negativeCheck />
                  <Row label="Net cash from investing"  arr={f.cashFlow.netCashFromInvesting} strong />

                  <TR><TD colSpan={years.length + 1} className="bg-primary-50 text-primary font-semibold text-xs uppercase tracking-wide">Financing</TD></TR>
                  <Row label="Equity Issuance"          arr={f.cashFlow.equityIssuance} indent={1} />
                  <Row label="Debt Issuance Proceeds"   arr={f.cashFlow.debtIssuance} indent={1} />
                  <Row label="Principal Repayments"     arr={f.cashFlow.principalRepayments} indent={1} negativeCheck />
                  <Row label="Interest paid"            arr={f.cashFlow.interestPaid} indent={1} negativeCheck />
                  <Row label="Net cash from financing"  arr={f.cashFlow.netCashFromFinancing} strong />

                  <Row label="Net change in cash"       arr={f.cashFlow.netChangeInCash} accent />
                  <Row label="Beginning cash"           arr={f.cashFlow.beginningCash} />
                  <Row label="Ending cash"              arr={f.cashFlow.endingCash} accent />
                </TBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
