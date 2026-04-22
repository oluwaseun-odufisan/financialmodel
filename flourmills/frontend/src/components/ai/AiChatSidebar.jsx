// AI FEATURE - GROK
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAi } from '../../contexts/AiContext.jsx';
import { useProject } from '../../contexts/ProjectContext.jsx';
import { api } from '../../lib/api.js';
import { normalizeAiText, splitAiSections } from '../../lib/aiPresentation.js';
import { fmtMillions, fmtMultiplier, fmtNumber, fmtPct } from '../../lib/utils.js';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from '../ui/Primitives.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs.jsx';

const TOOL_KEYS = {
  scenarios: 'scenarios',
  optimize: 'optimize',
  summary: 'summary',
};

function ChatBubble({ role, content }) {
  const assistant = role === 'assistant';
  return (
    <div className={`flex ${assistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={
          assistant
            ? 'max-w-[92%] rounded-2xl rounded-tl-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-7 text-[var(--text-main)]'
            : 'max-w-[92%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-7 text-white'
        }
      >
        <div className="whitespace-pre-wrap">{normalizeAiText(content)}</div>
      </div>
    </div>
  );
}

function EmptyPanel({ text }) {
  return <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--text-muted)]">{normalizeAiText(text)}</div>;
}

function MetricList({ items }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.label}</div>
          <div className="mt-2 text-sm font-semibold text-[var(--text-main)]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function buildExplainTargets(pathname, current) {
  const result = current?.result;
  if (!result) return [];
  const kpis = result.kpis || {};

  if (pathname === '/financials') {
    return [
      { label: 'Financial Statements Overview', context: 'Explain the purpose and structure of the Financial Statements page.' },
      { label: 'Income Statement', context: 'Explain the main drivers of the Income Statement outputs in the current project.' },
      { label: 'Balance Sheet', context: 'Explain what is driving the Balance Sheet structure in the current project.' },
      { label: 'Cash Flow', context: 'Explain the cash flow profile and the most important financing drivers in the current project.' },
      { label: 'Revenue Line', context: 'Explain how the revenue line is generated in the current project.' },
      { label: 'EBITDA Line', context: 'Explain what is driving EBITDA in the current project.' },
      { label: 'Debt Service and Cash', context: 'Explain what is driving debt service, liquidity, and ending cash in the current project.' },
    ];
  }

  if (pathname === '/reports') {
    return [
      { label: 'Sensitivity Analysis', context: 'Explain how to interpret the sensitivity analysis and what variables matter most.' },
      { label: 'Project IRR by Scenario', context: 'Explain the Project IRR by Scenario view and what it means for decision-making.' },
      { label: 'DSCR Trend', context: 'Explain the DSCR trend and identify the years that need attention.' },
      { label: 'DSCR Detail', context: 'Explain the DSCR detail table and how to assess covenant strength.' },
    ];
  }

  return [
    { label: 'Deal Summary Overview', context: 'Explain the current deal summary as if speaking to an investment committee analyst.' },
    { label: 'Total Capex', value: fmtMillions(kpis.totalCapex, 1), context: 'Explain what drives Total Capex in the current project.' },
    { label: 'Target Tariff', value: `NGN ${fmtNumber(kpis.targetTariff, 2)} / kWh`, context: 'Explain how the current target tariff is being supported by the model outputs.' },
    { label: 'Break-even Tariff', value: `NGN ${fmtNumber(kpis.breakevenTariff, 2)} / kWh`, context: 'Explain what is driving the break-even tariff and what would move it.' },
    { label: 'Project IRR', value: fmtPct(kpis.projectIRR, 1), context: 'Explain the project IRR and the major factors affecting it.' },
    { label: 'Equity IRR', value: fmtPct(kpis.equityIRR, 1), context: 'Explain the equity IRR and how leverage affects it.' },
    { label: 'Average DSCR', value: fmtMultiplier(kpis.avgDSCR), context: 'Explain the average DSCR and the key periods that affect coverage.' },
    { label: 'Payback Year', value: String(kpis.paybackYear || '-'), context: 'Explain what determines the payback year in the current project.' },
  ];
}

function ViewInPageButton({ onClick, label = 'View in Page' }) {
  return (
    <div className="flex justify-end pt-2">
      <Button type="button" variant="outline" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}

function SummaryPreview({ data, onViewPage }) {
  if (!data) return null;
  const sections = splitAiSections(data.content, ['Project Overview', 'Economics', 'Coverage and Credit', 'Key Risks', 'Recommendation']);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Executive Summary</div>
        <div className="mt-3 space-y-3">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="text-sm font-semibold text-[var(--text-main)]">{section.title}</div>
              {section.paragraphs.slice(0, 1).map((paragraph, index) => (
                <p key={`${section.title}-${index}`} className="mt-1 text-sm leading-7 text-[var(--text-muted)]">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ViewInPageButton onClick={onViewPage} />
    </div>
  );
}

function ScenariosPanel({ data, onViewPage }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <EmptyPanel text={normalizeAiText(data.summary)} />
      {data.baseCase && (
        <Card>
          <CardHeader>
            <CardTitle>Base Case</CardTitle>
            <CardDescription>{data.baseCase.description}</CardDescription>
          </CardHeader>
          <CardBody>
            <MetricList
              items={[
                { label: 'Project IRR', value: fmtPct(data.baseCase.metrics.kpis.projectIRR, 1) },
                { label: 'Equity IRR', value: fmtPct(data.baseCase.metrics.kpis.equityIRR, 1) },
                { label: 'Average DSCR', value: fmtMultiplier(data.baseCase.metrics.kpis.avgDSCR) },
                { label: 'Project NPV', value: fmtMillions(data.baseCase.metrics.kpis.projectNPV, 1) },
              ]}
            />
          </CardBody>
        </Card>
      )}
      {(data.scenarios || []).map((scenario) => (
        <Card key={scenario.name}>
          <CardHeader>
            <CardTitle>{scenario.name}</CardTitle>
            <CardDescription>{scenario.description}</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <MetricList
              items={[
                { label: 'Project IRR', value: fmtPct(scenario.metrics.kpis.projectIRR, 1) },
                { label: 'Equity IRR', value: fmtPct(scenario.metrics.kpis.equityIRR, 1) },
                { label: 'Average DSCR', value: fmtMultiplier(scenario.metrics.kpis.avgDSCR) },
                { label: 'Project NPV', value: fmtMillions(scenario.metrics.kpis.projectNPV, 1) },
              ]}
            />
            <div className="space-y-2">
              {scenario.appliedChanges.map((change) => (
                <div key={`${scenario.name}-${change.path}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm">
                  <div className="font-semibold text-[var(--text-main)]">{change.path}</div>
                  <div className="mt-1 text-[var(--text-muted)]">{change.reason || 'Scenario adjustment'}</div>
                  <div className="mt-2 text-[var(--text-main)]">New value: <span className="font-semibold">{String(change.value)}</span></div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
      <ViewInPageButton onClick={onViewPage} />
    </div>
  );
}

function OptimizationPanel({ data, onViewPage }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <EmptyPanel text={`Goal: ${data.goal}`} />
      {(data.recommendations || []).map((recommendation) => (
        <Card key={recommendation.title}>
          <CardHeader>
            <CardTitle>{recommendation.title}</CardTitle>
            <CardDescription>{recommendation.thesis}</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <MetricList
              items={[
                { label: 'Project IRR', value: fmtPct(recommendation.metrics.kpis.projectIRR, 1) },
                { label: 'Equity IRR', value: fmtPct(recommendation.metrics.kpis.equityIRR, 1) },
                { label: 'Average DSCR', value: fmtMultiplier(recommendation.metrics.kpis.avgDSCR) },
                { label: 'Target Tariff', value: `NGN ${fmtNumber(recommendation.metrics.kpis.targetTariff, 2)}` },
              ]}
            />
            <div className="space-y-2">
              {recommendation.appliedChanges.map((change) => (
                <div key={`${recommendation.title}-${change.path}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm">
                  <div className="font-semibold text-[var(--text-main)]">{change.path}</div>
                  <div className="mt-1 text-[var(--text-muted)]">{change.reason || 'Recommended adjustment'}</div>
                  <div className="mt-2 text-[var(--text-main)]">Set to: <span className="font-semibold">{String(change.value)}</span></div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
      <ViewInPageButton onClick={onViewPage} />
    </div>
  );
}

export default function AiChatSidebar() {
  const { current } = useProject();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    sidebarOpen,
    setSidebarOpen,
    canUseAi,
    chatMessages,
    chatBusy,
    chatError,
    clearChat,
    sendChat,
    saveArtifact,
    setLastArtifactType,
  } = useAi();
  const [draft, setDraft] = useState('');
  const [activeTab, setActiveTab] = useState('assistant');
  const [explainState, setExplainState] = useState({ loading: false, error: null, content: '', targetLabel: '' });
  const [toolState, setToolState] = useState({ active: '', loading: false, error: null, data: null });
  const [goal, setGoal] = useState('Achieve DSCR above 1.8x while keeping the tariff as low as practical.');
  const [insightsState, setInsightsState] = useState({ loading: false, error: null, data: null });
  const scrollRef = useRef(null);
  const projectId = current ? String(current._id || current.id) : null;
  const explainTargets = useMemo(() => buildExplainTargets(pathname, current), [pathname, current]);
  const openArtifactPage = (type) => {
    setLastArtifactType(type);
    setSidebarOpen(false);
    navigate(`/ai-analysis?type=${encodeURIComponent(type)}`);
  };

  useEffect(() => {
    if (!sidebarOpen || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, sidebarOpen, chatBusy]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || chatBusy || !canUseAi) return;
    const next = draft;
    setDraft('');
    await sendChat(next);
  };

  const runExplain = async (target) => {
    if (!projectId) return;
    setExplainState({ loading: true, error: null, content: '', targetLabel: target.label });
    try {
      const response = await api.aiExplain(projectId, {
        type: 'sidebar-explain',
        label: target.label,
        value: target.value,
        context: target.context,
        page: pathname,
      });
      setExplainState({ loading: false, error: null, content: normalizeAiText(response.content), targetLabel: target.label });
    } catch (error) {
      setExplainState({ loading: false, error: error.message, content: '', targetLabel: target.label });
    }
  };

  const runTool = async (kind) => {
    if (!projectId) return;
    setToolState({ active: kind, loading: true, error: null, data: null });
    try {
      let data;
      if (kind === TOOL_KEYS.scenarios) data = await api.aiGenerateScenarios(projectId);
      if (kind === TOOL_KEYS.summary) data = await api.aiGenerateSummary(projectId);
      if (kind === TOOL_KEYS.optimize) data = await api.aiOptimizeModel(projectId, goal);
      saveArtifact(kind, data, {
        projectName: current?.projectName || '',
      });
      setToolState({ active: kind, loading: false, error: null, data });
    } catch (error) {
      setToolState({ active: kind, loading: false, error: error.message, data: null });
    }
  };

  const loadInsights = async () => {
    if (!projectId) return;
    setInsightsState({ loading: true, error: null, data: null });
    try {
      const data = await api.aiGenerateInsights(projectId);
      saveArtifact('insights', data, {
        projectName: current?.projectName || '',
      });
      setInsightsState({ loading: false, error: null, data });
    } catch (error) {
      setInsightsState({ loading: false, error: error.message, data: null });
    }
  };

  if (!sidebarOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[59] bg-slate-950/25 lg:hidden" onClick={() => setSidebarOpen(false)} />
      <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[380px] flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Analysis Workspace</div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">FundCo AI</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {current?.projectName ? `Context loaded from ${current.projectName}` : 'Select a project to begin.'}
            </p>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)]">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="assistant" className="px-2">Assistant</TabsTrigger>
              <TabsTrigger value="explain" className="px-2">Explain</TabsTrigger>
              <TabsTrigger value="tools" className="px-2">Tools</TabsTrigger>
              <TabsTrigger value="insights" className="px-2">Insights</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!canUseAi ? (
            <EmptyPanel text="Run the model first. FundCo AI only activates when current assumptions and results are available." />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="assistant" className="mt-0">
                <div className="space-y-4">
                  <div ref={scrollRef} className="space-y-4">
                    {chatMessages.length === 0 && (
                      <EmptyPanel text="Ask questions about the current project, request scenarios, or draft investment commentary. The full project assumptions, BOQ, and latest model results are available to FundCo AI." />
                    )}
                    {chatMessages.map((message) => (
                      <ChatBubble key={message.id} role={message.role} content={message.content} />
                    ))}
                    {chatBusy && <EmptyPanel text="FundCo AI is preparing a response..." />}
                    {chatError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{chatError}</div>}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={5}
                      placeholder="Ask FundCo AI about the current project..."
                      disabled={chatBusy}
                      className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={clearChat} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">Clear conversation</button>
                      <Button type="submit" disabled={chatBusy || !draft.trim()}>Send</Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="explain" className="mt-0">
                <div className="space-y-4">
                  <EmptyPanel text="Use this panel to request plain-English explanations for the current page without adding AI controls to the page itself." />
                  <div className="space-y-2">
                    {explainTargets.map((target) => (
                      <button
                        key={target.label}
                        type="button"
                        onClick={() => runExplain(target)}
                        className="flex w-full items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-left text-sm hover:bg-[var(--surface-muted)]"
                      >
                        <span className="font-medium text-[var(--text-main)]">{target.label}</span>
                        <span className="text-[var(--text-muted)]">Explain</span>
                      </button>
                    ))}
                  </div>
                  {explainState.loading && <EmptyPanel text={`Preparing explanation for ${explainState.targetLabel}...`} />}
                  {explainState.error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{explainState.error}</div>}
                  {explainState.content && (
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--text-main)] whitespace-pre-wrap">
                      {explainState.content}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-0">
                <div className="space-y-4">
                  <EmptyPanel text="Run AI scenario generation, optimization suggestions, or executive summary drafting from this sidebar. Manual modeling remains unchanged." />
                  <div className="grid gap-2">
                    <Button type="button" variant="outline" onClick={() => runTool(TOOL_KEYS.scenarios)}>Generate Scenarios</Button>
                    <Button type="button" variant="outline" onClick={() => runTool(TOOL_KEYS.summary)}>Generate Executive Summary</Button>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Optimization goal</div>
                    <textarea
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      rows={4}
                      className="mt-3 w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-main)] outline-none"
                    />
                    <div className="mt-4 flex justify-end">
                      <Button type="button" onClick={() => runTool(TOOL_KEYS.optimize)} disabled={!goal.trim() || toolState.loading}>Optimize Model</Button>
                    </div>
                  </div>
                  {toolState.loading && <EmptyPanel text="FundCo AI is preparing the requested output..." />}
                  {toolState.error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{toolState.error}</div>}
                  {!toolState.loading && toolState.data && toolState.active === TOOL_KEYS.summary && (
                    <SummaryPreview data={{ ...toolState.data, content: normalizeAiText(toolState.data.content) }} onViewPage={() => openArtifactPage(TOOL_KEYS.summary)} />
                  )}
                  {!toolState.loading && toolState.data && toolState.active === TOOL_KEYS.scenarios && (
                    <ScenariosPanel data={toolState.data} onViewPage={() => openArtifactPage(TOOL_KEYS.scenarios)} />
                  )}
                  {!toolState.loading && toolState.data && toolState.active === TOOL_KEYS.optimize && (
                    <OptimizationPanel data={toolState.data} onViewPage={() => openArtifactPage(TOOL_KEYS.optimize)} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="insights" className="mt-0">
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={loadInsights} disabled={insightsState.loading}>
                      {insightsState.data ? 'Refresh Insights' : 'Generate Insights'}
                    </Button>
                  </div>
                  {!insightsState.loading && !insightsState.data && !insightsState.error && (
                    <EmptyPanel text="Generate a concise AI readout for sensitivity, key risks, and DSCR commentary." />
                  )}
                  {insightsState.loading && <EmptyPanel text="FundCo AI is analyzing the latest model run..." />}
                  {insightsState.error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{insightsState.error}</div>}
                  {insightsState.data && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Overview</CardTitle>
                          <CardDescription>{insightsState.data.headline}</CardDescription>
                        </CardHeader>
                        <CardBody className="text-sm leading-7 text-[var(--text-muted)]">{normalizeAiText(insightsState.data.tornadoDescription)}</CardBody>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Sensitive Variables</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-3">
                          {(insightsState.data.sensitiveVariables || []).map((item) => (
                            <div key={item.variable} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3">
                              <div className="font-semibold text-[var(--text-main)]">{item.variable}</div>
                              <div className="mt-1 text-sm text-[var(--text-muted)]">{item.impact}</div>
                            </div>
                          ))}
                        </CardBody>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Risks and Mitigations</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-3">
                          {(insightsState.data.risks || []).map((item, index) => (
                            <div key={`${item.risk}-${index}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3">
                              <div className="font-semibold text-[var(--text-main)]">{item.risk}</div>
                              <div className="mt-1 text-sm text-[var(--text-muted)]">{item.mitigation}</div>
                            </div>
                          ))}
                        </CardBody>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>DSCR Commentary</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                          <div className="text-sm leading-7 text-[var(--text-muted)]">{normalizeAiText(insightsState.data.dscrCommentary)}</div>
                          <ViewInPageButton onClick={() => openArtifactPage('insights')} />
                        </CardBody>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </aside>
    </>
  );
}
