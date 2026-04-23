import express from 'express';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { runModel, runSensitivity } from '../services/financialEngine.js';
import { getTemplate, derive } from '../services/seedData.js';
import { buildExcelWorkbook, buildPdfStream } from '../services/exportService.js';
import { logAuditEvent } from '../services/auditService.js';
import {
  handlePresentationDraft,
  handlePresentationExport,
  handlePresentationHistory,
  handlePresentationHistoryItem,
} from './presentations.js';

const router = express.Router();
router.use(requireAuth);

function getProjectId(project) {
  return String(project._id || project.id);
}

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json({ projects });
  } catch (error) {
    console.error('[projects/list]', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { projectName, template } = req.body || {};
    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const selectedTemplate = template === 'blank' ? 'blank' : 'flour_mills';
    const assumption = getTemplate(selectedTemplate, projectName.trim());
    assumption.projectName = projectName.trim();

    const project = await Project.create({
      userId: req.user.id,
      projectName: projectName.trim(),
      template: selectedTemplate,
      location: assumption.location || {},
      assumption,
      result: null,
    });

    await logAuditEvent(req, {
      action: 'project.create',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { template: selectedTemplate },
    });

    res.json({ project });
  } catch (error) {
    console.error('[projects/create]', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (error) {
    console.error('[projects/get]', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { assumption, projectName } = req.body || {};
    const patch = {};
    const changedFields = [];

    if (assumption) {
      patch.assumption = derive(assumption);
      patch.result = null;
      patch.lastRunAt = null;
      changedFields.push('assumption');
    }

    if (projectName) {
      patch.projectName = String(projectName).trim();
      if (patch.assumption) patch.assumption.projectName = patch.projectName;
      changedFields.push('projectName');
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      patch,
      { new: true }
    ).lean();

    if (!project) return res.status(404).json({ error: 'Project not found' });

    await logAuditEvent(req, {
      action: 'project.update',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { changedFields },
    });

    res.json({ project });
  } catch (error) {
    console.error('[projects/update]', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const assumption = derive(JSON.parse(JSON.stringify(project.assumption)));
    const result = runModel(assumption);
    const sensitivity = runSensitivity(assumption);
    project.assumption = assumption;
    project.result = { ...result, sensitivity };
    project.lastRunAt = new Date();
    await project.save();

    await logAuditEvent(req, {
      action: 'project.run',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: {
        runAt: project.lastRunAt.toISOString(),
        projectIRR: project.result?.kpis?.projectIRR ?? null,
        equityIRR: project.result?.kpis?.equityIRR ?? null,
      },
    });

    res.json({ project: project.toObject() });
  } catch (error) {
    console.error('[projects/run]', error);
    res.status(500).json({ error: `Model run failed: ${error.message}` });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const source = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!source) return res.status(404).json({ error: 'Project not found' });

    const newName = (req.body?.projectName || `${source.projectName} (copy)`).trim();
    const assumption = JSON.parse(JSON.stringify(source.assumption));
    assumption.projectName = newName;

    const project = await Project.create({
      userId: req.user.id,
      projectName: newName,
      template: source.template || 'flour_mills',
      location: source.location || {},
      assumption,
      result: null,
    });

    await logAuditEvent(req, {
      action: 'project.duplicate',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { sourceProjectId: getProjectId(source), sourceProjectName: source.projectName },
    });

    res.json({ project });
  } catch (error) {
    console.error('[projects/duplicate]', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await Project.deleteOne({ _id: req.params.id, userId: req.user.id });

    await logAuditEvent(req, {
      action: 'project.delete',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { deletedAt: new Date().toISOString() },
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error('[projects/delete]', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/:id/export/excel', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.result) return res.status(400).json({ error: 'Run the model before exporting' });

    const workbook = await buildExcelWorkbook(project);
    const filename = `${(project.projectName || 'project').replace(/[^\w]+/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

    await logAuditEvent(req, {
      action: 'project.export.excel',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { format: 'excel', scope: 'full', filename },
    });
  } catch (error) {
    console.error('[projects/export/excel]', error);
    res.status(500).json({ error: `Export failed: ${error.message}` });
  }
});

router.get('/:id/export/pdf', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.result) return res.status(400).json({ error: 'Run the model before exporting' });

    const scope = req.query.scope === 'summary' ? 'summary' : 'full';
    const suffix = scope === 'summary' ? '_deal_summary' : '_full_report';
    const filename = `${(project.projectName || 'project').replace(/[^\w]+/g, '_')}${suffix}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await logAuditEvent(req, {
      action: 'project.export.pdf',
      entityType: 'project',
      entityId: getProjectId(project),
      entityName: project.projectName,
      metadata: { format: 'pdf', scope, filename },
    });

    buildPdfStream(project, res, { scope, exportedBy: req.user?.name || req.user?.email || 'System user' });
  } catch (error) {
    console.error('[projects/export/pdf]', error);
    res.status(500).json({ error: `Export failed: ${error.message}` });
  }
});

router.get('/:id/presentation/history', handlePresentationHistory);
router.get('/:id/presentation/history/:historyId', handlePresentationHistoryItem);
router.post('/:id/presentation/draft', handlePresentationDraft);
router.post('/:id/presentation/export', handlePresentationExport);

export default router;
