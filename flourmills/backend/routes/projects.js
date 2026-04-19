import express from 'express';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { runModel, runSensitivity } from '../services/financialEngine.js';
import { getTemplate, derive } from '../services/seedData.js';
import { buildExcelWorkbook, buildPdfStream } from '../services/exportService.js';

const router = express.Router();
router.use(requireAuth);

/** GET /api/projects — list the user's projects, newest first */
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ projects });
  } catch (e) {
    console.error('[projects/list]', e);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * POST /api/projects
 * Body:
 *   {
 *     projectName: string,
 *     template:    'flour_mills' | 'blank'   (default: 'flour_mills')
 *   }
 */
router.post('/', async (req, res) => {
  try {
    const { projectName, template } = req.body || {};
    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const tpl = template === 'blank' ? 'blank' : 'flour_mills';
    const assumption = getTemplate(tpl, projectName.trim());
    assumption.projectName = projectName.trim();

    const project = await Project.create({
      userId: req.user.id,
      projectName: projectName.trim(),
      template: tpl,
      location: assumption.location || {},
      assumption,
      result: null,
    });
    res.json({ project });
  } catch (e) {
    console.error('[projects/create]', e);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/** GET /api/projects/:id */
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (e) {
    console.error('[projects/get]', e);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/** PUT /api/projects/:id — patch assumption tree and/or projectName */
router.put('/:id', async (req, res) => {
  try {
    const { assumption, projectName } = req.body || {};
    const patch = {};
    if (assumption) {
      patch.assumption = derive(assumption);
      patch.result = null;          // invalidate previous run
      patch.lastRunAt = null;
    }
    if (projectName) {
      patch.projectName = String(projectName).trim();
      if (patch.assumption) patch.assumption.projectName = patch.projectName;
    }
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      patch,
      { new: true }
    ).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (e) {
    console.error('[projects/update]', e);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/** POST /api/projects/:id/run — execute the engine and persist result */
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
    res.json({ project: project.toObject() });
  } catch (e) {
    console.error('[projects/run]', e);
    res.status(500).json({ error: 'Model run failed: ' + e.message });
  }
});

/** POST /api/projects/:id/duplicate — clone a project */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const src = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!src) return res.status(404).json({ error: 'Project not found' });
    const newName = (req.body?.projectName || `${src.projectName} (copy)`).trim();
    const assumption = JSON.parse(JSON.stringify(src.assumption));
    assumption.projectName = newName;
    const project = await Project.create({
      userId: req.user.id,
      projectName: newName,
      template: src.template || 'flour_mills',
      location: src.location || {},
      assumption,
      result: null,
    });
    res.json({ project });
  } catch (e) {
    console.error('[projects/duplicate]', e);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

/** DELETE /api/projects/:id */
router.delete('/:id', async (req, res) => {
  try {
    const r = await Project.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  } catch (e) {
    console.error('[projects/delete]', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

/** GET /api/projects/:id/export/excel */
router.get('/:id/export/excel', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.result) return res.status(400).json({ error: 'Run the model before exporting' });
    const wb = await buildExcelWorkbook(project);
    const filename = `${(project.projectName || 'project').replace(/[^\w]+/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('[projects/export/excel]', e);
    res.status(500).json({ error: 'Export failed: ' + e.message });
  }
});

/** GET /api/projects/:id/export/pdf */
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.result) return res.status(400).json({ error: 'Run the model before exporting' });
    const filename = `${(project.projectName || 'project').replace(/[^\w]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    buildPdfStream(project, res);
  } catch (e) {
    console.error('[projects/export/pdf]', e);
    res.status(500).json({ error: 'Export failed: ' + e.message });
  }
});

export default router;
