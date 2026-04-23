// AI FEATURE - GROK
import { derive } from './seedData.js';
import { runModel, runSensitivity } from './financialEngine.js';

// AI FEATURE - GROK
const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
// AI FEATURE - GROK
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4';
// AI FEATURE - GROK
const GROK_TIMEOUT_MS = Number(process.env.GROK_TIMEOUT_MS || 90000);
// AI FEATURE - GROK
const aiCache = new Map();

function getGrokApiKey() {
  const apiKey = process.env.GROK_API_KEY?.trim();
  if (!apiKey) throw new Error('GROK_API_KEY is not configured on the backend.');
  return apiKey;
}

function pruneCache() {
  if (aiCache.size <= 60) return;
  const firstKey = aiCache.keys().next().value;
  if (firstKey) aiCache.delete(firstKey);
}

function extractMessageText(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, '').replace(/```$/, '').trim();
}

function normalizePlainTextResponse(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trimEnd()
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseJsonReply(text) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`AI returned invalid JSON. Raw response: ${cleaned.slice(0, 400)}`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getProjectAiContext(project) {
  return {
    projectId: String(project._id || project.id || ''),
    projectName: project.projectName,
    template: project.template,
    lastRunAt: project.lastRunAt || null,
    assumption: project.assumption,
    boq: project.assumption?.boq || {},
    result: project.result,
  };
}

function flattenLeafPaths(obj, prefix = '') {
  const rows = [];
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) return;
    if (value && typeof value === 'object') {
      rows.push(...flattenLeafPaths(value, path));
      return;
    }
    rows.push({ path, value, type: typeof value });
  });
  return rows;
}

function hasPath(obj, path) {
  const parts = String(path || '').split('.');
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return false;
    cursor = cursor[part];
  }
  return true;
}

function getPathValue(obj, path) {
  return String(path || '')
    .split('.')
    .reduce((cursor, part) => (cursor && typeof cursor === 'object' ? cursor[part] : undefined), obj);
}

function coerceValue(nextValue, currentValue) {
  if (typeof currentValue === 'number') {
    const numeric = Number(nextValue);
    if (Number.isFinite(numeric)) return numeric;
    return currentValue;
  }
  if (typeof currentValue === 'boolean') {
    if (typeof nextValue === 'boolean') return nextValue;
    if (typeof nextValue === 'string') return nextValue.toLowerCase() === 'true';
    return Boolean(nextValue);
  }
  return nextValue === null || nextValue === undefined ? currentValue : String(nextValue);
}

function setPathValue(obj, path, nextValue) {
  const parts = String(path || '').split('.');
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor?.[parts[index]];
    if (!cursor || typeof cursor !== 'object') return false;
  }
  const leaf = parts[parts.length - 1];
  if (!cursor || typeof cursor !== 'object' || !(leaf in cursor)) return false;
  cursor[leaf] = coerceValue(nextValue, cursor[leaf]);
  return true;
}

function applyAssumptionChanges(baseAssumption, changes = []) {
  const next = clone(baseAssumption);
  const appliedChanges = [];
  const skippedChanges = [];

  changes.forEach((change) => {
    const path = String(change?.path || '').trim();
    if (!path || !hasPath(next, path)) {
      skippedChanges.push({
        path,
        value: change?.value,
        reason: change?.reason || 'Unknown path',
        status: 'skipped',
      });
      return;
    }

    const previousValue = getPathValue(next, path);
    const ok = setPathValue(next, path, change?.value);
    if (!ok) {
      skippedChanges.push({
        path,
        value: change?.value,
        reason: change?.reason || 'Failed to apply value',
        status: 'skipped',
      });
      return;
    }

    appliedChanges.push({
      path,
      previousValue,
      value: getPathValue(next, path),
      reason: change?.reason || '',
      status: 'applied',
    });
  });

  return {
    nextAssumption: derive(next),
    appliedChanges,
    skippedChanges,
  };
}

function summarizeModel(result) {
  const years = result?.financials?.years || [];
  return {
    years,
    kpis: result?.kpis || {},
    annualRevenue: years.map((year, index) => ({
      year,
      revenue: result?.financials?.incomeStatement?.revenue?.[index] ?? null,
      ebitda: result?.financials?.incomeStatement?.ebitda?.[index] ?? null,
      profitAfterTax: result?.financials?.incomeStatement?.profitAfterTax?.[index] ?? null,
      dscr: result?.kpis?.dscrByYear?.[index] ?? null,
    })),
  };
}

function simulateChanges(project, changes) {
  const { nextAssumption, appliedChanges, skippedChanges } = applyAssumptionChanges(project.assumption, changes);
  const result = runModel(nextAssumption);
  const sensitivity = runSensitivity(nextAssumption);
  return {
    appliedChanges,
    skippedChanges,
    assumption: nextAssumption,
    result: { ...result, sensitivity },
  };
}

async function callGrokChat({ cacheKey, systemPrompt, userPrompt, messages = [], temperature = 0.2 }) {
  if (cacheKey && aiCache.has(cacheKey)) return aiCache.get(cacheKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROK_TIMEOUT_MS);

  try {
    const response = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getGrokApiKey()}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        stream: false,
        store: false,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FundCo AI request failed (${response.status}): ${text.slice(0, 400)}`);
    }

    const payload = await response.json();
    const content = extractMessageText(payload?.choices?.[0]?.message?.content);
    if (!content) throw new Error('FundCo AI returned an empty response.');

    if (cacheKey) {
      aiCache.set(cacheKey, content);
      pruneCache();
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('FundCo AI request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getCoreSystemPrompt() {
  return [
    'You are FundCo AI, an institutional-grade financial modeling copilot.',
    'You are helping analysts work on a project finance model.',
    'Never claim you changed the model unless explicitly asked to propose changes.',
    'All actual calculations are done by the financial engine, not by you.',
    'Use clear, professional, concise language suitable for a finance team.',
    'For non-JSON replies, use plain text only with no markdown syntax, no hash headings, no bullet markers, and no fenced blocks.',
    'When asked for JSON, return valid JSON only with no markdown fences and no commentary.',
  ].join(' ');
}

export async function chatWithFundCoAi({ project, history = [], question }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const messages = history
    .slice(-12)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || ''),
    }));

  const content = await callGrokChat({
    systemPrompt: getCoreSystemPrompt(),
    messages,
    userPrompt: [
      'You always have the full current project context below.',
      'Answer the user naturally and practically in plain text only.',
      'Do not use markdown, bullets, asterisks, or hash headings.',
      'If the user asks for a what-if outcome, explain the directional effect clearly and note that exact outputs require a scenario run unless concrete simulation data is already available.',
      `FULL_PROJECT_JSON=${projectContext}`,
      `USER_QUESTION=${question}`,
    ].join('\n\n'),
    temperature: 0.3,
  });

  return { content: normalizePlainTextResponse(content) };
}

export async function explainWithFundCoAi({ project, target }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const cacheKey = `explain:${String(project._id || project.id)}:${project.result?.computedAt || 'na'}:${JSON.stringify(target)}`;

  const content = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Explain the requested model value or visual in plain English for a finance user.',
      'Use plain text only and no markdown.',
      'Use exactly these section labels on separate lines: What it is, What drives it, What to watch.',
      'Place one concise paragraph under each section label.',
      `EXPLAIN_TARGET=${JSON.stringify(target)}`,
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.2,
  });

  return { content: normalizePlainTextResponse(content) };
}

export async function generateScenarioPack({ project }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const editablePaths = flattenLeafPaths(project.assumption)
    .map((row) => `${row.path} (${row.type}) = ${JSON.stringify(row.value)}`)
    .join('\n');
  const cacheKey = `scenarios:${String(project._id || project.id)}:${project.result?.computedAt || 'na'}`;

  const raw = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Create 3 to 5 realistic additive scenario definitions for the existing project model.',
      'Use only editable assumption paths from the list provided.',
      'Return JSON with this shape:',
      '{"summary":"...","scenarios":[{"name":"...","description":"...","changes":[{"path":"...","value":123,"reason":"..."}]}]}',
      'Include practical scenarios such as optimistic, pessimistic, high diesel, delayed commissioning, or similar institutionally relevant cases.',
      `EDITABLE_ASSUMPTION_PATHS=\n${editablePaths}`,
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.3,
  });

  const parsed = parseJsonReply(raw);
  const scenarios = Array.isArray(parsed?.scenarios) ? parsed.scenarios.slice(0, 5) : [];

  const baseCase = {
    name: 'Base Case',
    description: 'Current saved project result.',
    metrics: summarizeModel(project.result),
    appliedChanges: [],
    skippedChanges: [],
  };

  const modeledScenarios = scenarios.map((scenario) => {
    const simulation = simulateChanges(project, scenario.changes || []);
    return {
      name: scenario.name || 'Scenario',
      description: scenario.description || '',
      metrics: summarizeModel(simulation.result),
      appliedChanges: simulation.appliedChanges,
      skippedChanges: simulation.skippedChanges,
    };
  });

  return {
    summary: parsed?.summary || 'Scenario set generated by FundCo AI.',
    baseCase,
    scenarios: modeledScenarios,
  };
}

export async function optimizeModelWithFundCoAi({ project, goal }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const editablePaths = flattenLeafPaths(project.assumption)
    .map((row) => `${row.path} (${row.type}) = ${JSON.stringify(row.value)}`)
    .join('\n');
  const cacheKey = `optimize:${String(project._id || project.id)}:${project.result?.computedAt || 'na'}:${goal}`;

  const raw = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Recommend exactly 3 optimization options for the current project.',
      'Use only existing editable assumption paths.',
      'Each option must include a concise title, why it helps, and exact assumption values to test.',
      'Return JSON with this shape:',
      '{"goal":"...","recommendations":[{"title":"...","thesis":"...","changes":[{"path":"...","value":123,"reason":"..."}]}]}',
      `USER_GOAL=${goal}`,
      `EDITABLE_ASSUMPTION_PATHS=\n${editablePaths}`,
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.2,
  });

  const parsed = parseJsonReply(raw);
  const recommendations = Array.isArray(parsed?.recommendations) ? parsed.recommendations.slice(0, 3) : [];

  return {
    goal: parsed?.goal || goal,
    currentCase: summarizeModel(project.result),
    recommendations: recommendations.map((recommendation) => {
      const simulation = simulateChanges(project, recommendation.changes || []);
      return {
        title: recommendation.title || 'Optimization option',
        thesis: recommendation.thesis || '',
        appliedChanges: simulation.appliedChanges,
        skippedChanges: simulation.skippedChanges,
        metrics: summarizeModel(simulation.result),
      };
    }),
  };
}

export async function generateExecutiveSummary({ project }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const cacheKey = `summary:${String(project._id || project.id)}:${project.result?.computedAt || 'na'}`;

  const content = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Write a polished one-page executive investment summary for the current project.',
      'Use a formal tone suitable for internal investment committee or lender review.',
      'Use plain text only and no markdown.',
      'Use exactly these section labels on separate lines: Project Overview, Economics, Coverage and Credit, Key Risks, Recommendation.',
      'Place one concise paragraph under each section label.',
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.3,
  });

  return { content: normalizePlainTextResponse(content) };
}

function getSensitivityInputs(project) {
  const scenarios = Array.isArray(project.result?.sensitivity) ? project.result.sensitivity : [];
  const baseCase = scenarios.find((scenario) => scenario.scenario === 'Base Case') || scenarios[0] || null;
  if (!baseCase) return [];

  return scenarios
    .filter((scenario) => scenario.scenario !== baseCase.scenario)
    .map((scenario) => ({
      scenario: scenario.scenario,
      deltaProjectIRR: (scenario.projectIRR || 0) - (baseCase.projectIRR || 0),
      deltaEquityIRR: (scenario.equityIRR || 0) - (baseCase.equityIRR || 0),
      deltaAvgDSCR: (scenario.avgDSCR || 0) - (baseCase.avgDSCR || 0),
      deltaProjectNPV: (scenario.projectNPV || 0) - (baseCase.projectNPV || 0),
    }))
    .sort((a, b) => Math.abs(b.deltaProjectIRR) - Math.abs(a.deltaProjectIRR))
    .slice(0, 5);
}

export async function generateReportInsights({ project }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const sensitivityInputs = JSON.stringify(getSensitivityInputs(project));
  const cacheKey = `insights:${String(project._id || project.id)}:${project.result?.computedAt || 'na'}`;

  const raw = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Return a concise institution-ready AI insights pack as JSON only.',
      'Use this shape exactly:',
      '{"headline":"...","tornadoDescription":"...","sensitiveVariables":[{"variable":"...","impact":"..."}],"risks":[{"risk":"...","mitigation":"..."}],"dscrCommentary":"..."}',
      'Keep sensitiveVariables to 5 items and risks to 3 items.',
      `SENSITIVITY_DRIVER_INPUTS=${sensitivityInputs}`,
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.2,
  });

  return parseJsonReply(raw);
}

// AI FEATURE - GROK
export async function generatePresentationNarrative({ project, audience, slideOutline }) {
  const projectContext = JSON.stringify(getProjectAiContext(project));
  const cacheKey = `presentation:${String(project._id || project.id)}:${project.result?.computedAt || project.lastRunAt || 'na'}:${audience}`;

  const raw = await callGrokChat({
    cacheKey,
    systemPrompt: getCoreSystemPrompt(),
    userPrompt: [
      'Improve the presentation narrative for an institutional project finance PowerPoint.',
      'Use only the supplied slide ids. Do not invent financial numbers.',
      'All numeric outputs must come from FULL_PROJECT_JSON. Do not override or recalculate them.',
      'Return JSON only with this shape:',
      '{"slides":[{"id":"...","title":"...","subtitle":"...","narrative":"...","bullets":["..."]}]}',
      'Keep titles short, subtitles practical, narrative concise, and bullets decision-focused.',
      'Avoid markdown, hype, generic AI language, and unsupported claims.',
      `AUDIENCE=${audience}`,
      `SLIDE_OUTLINE=${JSON.stringify(slideOutline)}`,
      `FULL_PROJECT_JSON=${projectContext}`,
    ].join('\n\n'),
    temperature: 0.2,
  });

  const parsed = parseJsonReply(raw);
  return {
    slides: Array.isArray(parsed?.slides) ? parsed.slides : [],
  };
}
