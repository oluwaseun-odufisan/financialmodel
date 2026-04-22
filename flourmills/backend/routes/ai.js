// AI FEATURE - GROK
import express from 'express';
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

    await logAuditEvent(req, {
      action: 'ai.chat',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { question },
    });

    return res.json(result);
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

    await logAuditEvent(req, {
      action: 'ai.explain',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { targetType: target.type || null, targetLabel: target.label || null },
    });

    return res.json(result);
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

    await logAuditEvent(req, {
      action: 'ai.scenarios',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scenarioCount: result.scenarios.length },
    });

    return res.json(result);
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

    await logAuditEvent(req, {
      action: 'ai.optimize',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { goal, recommendationCount: result.recommendations.length },
    });

    return res.json(result);
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

    await logAuditEvent(req, {
      action: 'ai.summary',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scope: 'executive-summary' },
    });

    return res.json(result);
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

    await logAuditEvent(req, {
      action: 'ai.insights',
      entityType: 'project',
      entityId: String(project._id),
      entityName: project.projectName,
      metadata: { scope: 'reports' },
    });

    return res.json(result);
  } catch (error) {
    console.error('[ai/insights]', error);
    return res.status(500).json({ error: error.message || 'FundCo AI insights failed' });
  }
});

export default router;
