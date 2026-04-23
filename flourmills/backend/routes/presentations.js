import express from 'express';
import PresentationHistory from '../models/PresentationHistory.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';
import { buildPresentationDraft, buildPresentationPptx, PRESENTATION_PRESETS } from '../services/presentationService.js';

const router = express.Router();
router.use(requireAuth);

function getProjectId(project) {
  return String(project._id || project.id);
}

async function getRunnableProject(req, res, projectId) {
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
    res.status(400).json({ error: 'Run the model before generating a presentation' });
    return null;
  }
  return project;
}

function getKpiSnapshot(project) {
  const kpis = project?.result?.kpis || {};
  return {
    totalCapex: kpis.totalCapex ?? null,
    targetTariff: kpis.targetTariff ?? null,
    projectIRR: kpis.projectIRR ?? null,
    equityIRR: kpis.equityIRR ?? null,
    projectNPV: kpis.projectNPV ?? null,
    avgDSCR: kpis.avgDSCR ?? null,
    minDSCR: kpis.minDSCR ?? null,
    paybackYear: kpis.paybackYear ?? null,
  };
}

function serializeHistory(item, includeDraft = false) {
  return {
    id: String(item._id || item.id),
    projectId: String(item.projectId),
    projectName: item.projectName,
    title: item.title,
    status: item.status,
    presetId: item.presetId,
    presetName: item.presetName,
    audience: item.audience,
    aiAssisted: item.aiAssisted,
    slideCount: item.slideCount,
    metrics: item.metrics || {},
    modelRunAt: item.modelRunAt || null,
    exportedAt: item.exportedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(includeDraft ? { draft: item.draft || {} } : {}),
  };
}

async function savePresentationHistory(req, project, draft, status = 'draft') {
  const title = `${project.projectName || 'Project'} presentation - ${new Date().toLocaleDateString('en-GB')}`;
  const item = await PresentationHistory.create({
    userId: req.user.id,
    userEmail: req.user.email || null,
    userName: req.user.name || null,
    projectId: project._id,
    projectName: project.projectName,
    title,
    status,
    presetId: draft.preset?.id || 'fundco-classic',
    presetName: draft.preset?.name || 'FundCo Classic',
    audience: draft.audience || 'Investment Committee',
    aiAssisted: !!draft.aiAssisted,
    slideCount: Array.isArray(draft.slides) ? draft.slides.filter((slide) => slide.included !== false).length : 0,
    draft,
    metrics: getKpiSnapshot(project),
    modelRunAt: project.lastRunAt || project.result?.computedAt || null,
    exportedAt: status === 'exported' ? new Date() : null,
  });
  return item.toObject();
}

export async function handlePresentationDraft(req, res) {
  try {
    const project = await getRunnableProject(req, res, req.body?.projectId || req.params?.id);
    if (!project) return;

    const draft = await buildPresentationDraft(project, {
      presetId: req.body?.presetId,
      audience: req.body?.audience,
      useAi: req.body?.useAi !== false,
    });
    const history = await savePresentationHistory(req, project, draft, 'draft');

    await logAuditEvent(req, {
      action: 'presentation.draft',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: {
        presetId: draft.preset.id,
        audience: draft.audience,
        aiAssisted: draft.aiAssisted,
        slideCount: draft.slides.length,
        historyId: String(history._id),
      },
    });

    res.json({ draft, history: serializeHistory(history) });
  } catch (error) {
    console.error('[presentations/draft]', error);
    res.status(500).json({ error: error.message || 'Presentation draft failed' });
  }
}

export async function handlePresentationExport(req, res) {
  try {
    const project = await getRunnableProject(req, res, req.body?.projectId || req.params?.id);
    if (!project) return;

    const slides = Array.isArray(req.body?.slides) ? req.body.slides : null;
    const draft = {
      preset: PRESENTATION_PRESETS.find((preset) => preset.id === req.body?.presetId) || PRESENTATION_PRESETS[0],
      audience: req.body?.audience || 'Investment Committee',
      aiAssisted: !!req.body?.aiAssisted,
      generatedAt: req.body?.generatedAt || new Date().toISOString(),
      slides: slides || [],
    };
    const buffer = await buildPresentationPptx(project, {
      presetId: req.body?.presetId,
      audience: req.body?.audience,
      slides,
    });

    const history = await savePresentationHistory(req, project, draft, 'exported');
    const filename = `${(project.projectName || 'project').replace(/[^\w]+/g, '_')}_presentation.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Presentation-History-Id', String(history._id));
    res.send(buffer);

    await logAuditEvent(req, {
      action: 'presentation.export.pptx',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: {
        format: 'pptx',
        filename,
        presetId: req.body?.presetId || null,
        slideCount: slides ? slides.filter((slide) => slide.included !== false).length : null,
        historyId: String(history._id),
      },
    });
  } catch (error) {
    console.error('[presentations/export]', error);
    res.status(500).json({ error: error.message || 'Presentation export failed' });
  }
}

export async function handlePresentationHistory(req, res) {
  try {
    const project = await getRunnableProject(req, res, req.query?.projectId || req.params?.id);
    if (!project) return;

    const limit = Math.min(Math.max(Number(req.query?.limit || 20), 1), 80);
    const rows = await PresentationHistory.find({ userId: req.user.id, projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ history: rows.map((item) => serializeHistory(item)) });
  } catch (error) {
    console.error('[presentations/history]', error);
    res.status(500).json({ error: error.message || 'Presentation history failed' });
  }
}

export async function handlePresentationHistoryItem(req, res) {
  try {
    const item = await PresentationHistory.findOne({ _id: req.params.historyId, userId: req.user.id }).lean();
    if (!item) return res.status(404).json({ error: 'Presentation history item not found' });

    const project = await Project.findOne({ _id: item.projectId, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({ history: serializeHistory(item, true) });
  } catch (error) {
    console.error('[presentations/history/:id]', error);
    res.status(500).json({ error: error.message || 'Presentation history item failed' });
  }
}

router.get('/presets', (_req, res) => {
  res.json({ presets: PRESENTATION_PRESETS });
});

router.get('/history', handlePresentationHistory);
router.get('/history/:historyId', handlePresentationHistoryItem);
router.post('/draft', handlePresentationDraft);
router.post('/export', handlePresentationExport);

export default router;
