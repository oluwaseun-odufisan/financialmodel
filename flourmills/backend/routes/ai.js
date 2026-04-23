// AI FEATURE - GROK
import express from 'express';
import mongoose from 'mongoose';
import AiHistory from '../models/AiHistory.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';
import {
  chatWithFundCoAi,
  explainWithFundCoAi,
  generateExecutiveSummary,
  generateReportInsights,
  generateScenarioPack,
  optimizeModelWithFundCoAi,
} from '../services/aiService.js';

// AI FEATURE - GROK
const router = express.Router();
// AI FEATURE - GROK
router.use(requireAuth);

const HISTORY_TYPES = new Set(['summary', 'scenarios', 'optimize', 'insights', 'explain', 'chat']);

function getKpiSnapshot(project) {
  const kpis = project?.result?.kpis || {};
  return {
    totalCapex: kpis.totalCapex ?? null,
    targetTariff: kpis.targetTariff ?? null,
    breakevenTariff: kpis.breakevenTariff ?? null,
    projectIRR: kpis.projectIRR ?? null,
    equityIRR: kpis.equityIRR ?? null,
    projectNPV: kpis.projectNPV ?? null,
    avgDSCR: kpis.avgDSCR ?? null,
    minDSCR: kpis.minDSCR ?? null,
    paybackYear: kpis.paybackYear ?? null,
  };
}

function compactText(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function buildHistoryRecord({ req, project, type, title, description = '', prompt = '', payload }) {
  return {
    userId: req.user.id,
    userEmail: req.user.email || null,
    userName: req.user.name || null,
    projectId: project._id,
    projectName: project.projectName,
    type,
    title,
    description,
    prompt,
    payload,
    metrics: getKpiSnapshot(project),
    modelRunAt: project.lastRunAt || project.result?.computedAt || null,
  };
}

async function saveAiHistory(record) {
  const created = await AiHistory.create(record);
  return created.toObject();
}

function serializeHistory(history, includePayload = false) {
  return {
    id: String(history._id || history.id),
    type: history.type,
    title: history.title,
    description: history.description || '',
    prompt: history.prompt || '',
    projectId: String(history.projectId),
    projectName: history.projectName,
    metrics: history.metrics || {},
    modelRunAt: history.modelRunAt || null,
    savedAt: history.createdAt,
    createdAt: history.createdAt,
    ...(includePayload ? { data: history.payload || {}, payload: history.payload || {} } : {}),
  };
}

async function getOwnedProject(req, res) {
  const projectId = req.body?.projectId;
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return null;
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user.id }).lean();
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  if (!project.result) {
    res.status(400).json({ error: 'Run the model before using FundCo AI' });
    return null;
  }
  return project;
}

async function getProjectForQuery(req, res) {
  const projectId = req.query?.projectId || req.params?.projectId;
  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    res.status(400).json({ error: 'Valid projectId is required' });
    return null;
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user.id }).lean();
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

router.get('/history', async (req, res) => {
  try {
    const project = await getProjectForQuery(req, res);
    if (!project) return;

    const limit = Math.min(Math.max(Number(req.query?.limit || 30), 1), 100);
    const type = String(req.query?.type || '').trim();
    const query = {
      userId: req.user.id,
      projectId: project._id,
      ...(HISTORY_TYPES.has(type) ? { type } : {}),
    };

    const histories = await AiHistory.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ history: histories.map((item) => serializeHistory(item)) });
  } catch (error) {
    console.error('[ai/history]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI history failed' });
  }
});

router.get('/history/:id', async (req, res) => {
  try {
    const history = await AiHistory.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!history) return res.status(404).json({ error: 'AI history item not found' });

    const project = await Project.findOne({ _id: history.projectId, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    return res.json({ history: serializeHistory(history, true) });
  } catch (error) {
    console.error('[ai/history/:id]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI history item failed' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });

    const result = await chatWithFundCoAi({
      project,
      history: Array.isArray(req.body?.history) ? req.body.history : [],
      question,
    });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'chat',
      title: compactText(question, 80),
      description: compactText(result.content, 180),
      prompt: question,
      payload: result,
    }));

    await logAuditEvent(req, {
      action: 'ai.chat',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { question },
    });

    return res.json({ ...result, history: serializeHistory(history) });
  } catch (error) {
    console.error('[ai/chat]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI chat failed' });
  }
});

router.post('/explain', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const target = req.body?.target || null;
    if (!target) return res.status(400).json({ error: 'target is required' });

    const result = await explainWithFundCoAi({ project, target });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'explain',
      title: target.label || 'Model explanation',
      description: compactText(result.content, 180),
      prompt: target.context || target.label || '',
      payload: { ...result, target },
    }));

    await logAuditEvent(req, {
      action: 'ai.explain',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { targetType: target.type || null, targetLabel: target.label || null },
    });

    return res.json({ ...result, history: serializeHistory(history) });
  } catch (error) {
    console.error('[ai/explain]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI explanation failed' });
  }
});

router.post('/scenarios', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const result = await generateScenarioPack({ project });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'scenarios',
      title: `Scenario pack - ${new Date().toLocaleDateString('en-GB')}`,
      description: compactText(result.summary, 180),
      prompt: 'Generate scenarios',
      payload: result,
    }));

    await logAuditEvent(req, {
      action: 'ai.scenarios',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scenarioCount: result.scenarios.length },
    });

    return res.json({ ...result, history: serializeHistory(history, true) });
  } catch (error) {
    console.error('[ai/scenarios]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI scenario generation failed' });
  }
});

router.post('/optimize', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const goal = String(req.body?.goal || '').trim() || 'Improve bankability while preserving commercial realism.';
    const result = await optimizeModelWithFundCoAi({ project, goal });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'optimize',
      title: compactText(`Optimization - ${goal}`, 90),
      description: compactText(result.recommendations?.[0]?.thesis || goal, 180),
      prompt: goal,
      payload: result,
    }));

    await logAuditEvent(req, {
      action: 'ai.optimize',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { goal, recommendationCount: result.recommendations.length },
    });

    return res.json({ ...result, history: serializeHistory(history, true) });
  } catch (error) {
    console.error('[ai/optimize]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI optimization failed' });
  }
});

router.post('/summary', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const result = await generateExecutiveSummary({ project });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'summary',
      title: `Executive summary - ${new Date().toLocaleDateString('en-GB')}`,
      description: compactText(result.content, 180),
      prompt: 'Generate executive summary',
      payload: result,
    }));

    await logAuditEvent(req, {
      action: 'ai.summary',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scope: 'executive-summary' },
    });

    return res.json({ ...result, history: serializeHistory(history, true) });
  } catch (error) {
    console.error('[ai/summary]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI summary failed' });
  }
});

router.post('/insights', async (req, res) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const result = await generateReportInsights({ project });

    const history = await saveAiHistory(buildHistoryRecord({
      req,
      project,
      type: 'insights',
      title: `Insights - ${new Date().toLocaleDateString('en-GB')}`,
      description: compactText(result.headline || result.dscrCommentary, 180),
      prompt: 'Generate insights',
      payload: result,
    }));

    await logAuditEvent(req, {
      action: 'ai.insights',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scope: 'reports' },
    });

    return res.json({ ...result, history: serializeHistory(history, true) });
  } catch (error) {
    console.error('[ai/insights]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI insights failed' });
  }
});

export default router;
