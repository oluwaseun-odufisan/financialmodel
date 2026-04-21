import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Badge, Button } from '../components/ui/Primitives.jsx';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/Table.jsx';
import NewProjectModal from '../components/NewProjectModal.jsx';
import { Calendar, CheckCircle2, Copy, FolderOpen, Play, Plus, Trash2 } from 'lucide-react';
import { fmtDate, fmtMillions, fmtPct } from '../lib/utils.js';

export default function Projects() {
  const { projects, loading, setCurrentId, currentId, duplicateProject, deleteProject, runModelById } = useProject();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const summary = useMemo(() => {
    const completed = projects.filter((project) => project.result).length;
    return { total: projects.length, completed, awaiting: projects.length - completed };
  }, [projects]);

  const openProject = (project) => {
    setCurrentId(project._id || project.id);
    navigate('/');
  };

  const handleDuplicate = async (project) => {
    setBusyId(project._id || project.id);
    try {
      await duplicateProject(project._id || project.id);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (project) => {
    if (!confirm(`Delete "${project.projectName}"? This cannot be undone.`)) return;
    setBusyId(project._id || project.id);
    try {
      await deleteProject(project._id || project.id);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickRun = async (project) => {
    const id = project._id || project.id;
    setCurrentId(id);
    setBusyId(id);
    try {
      await runModelById(id);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Projects</div>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-main)]">Project board</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-main)]">{summary.total}</span> total
            <span className="mx-2 text-[var(--border-soft)]">&middot;</span>
            <span className="font-semibold text-[var(--text-main)]">{summary.completed}</span> completed
            <span className="mx-2 text-[var(--border-soft)]">&middot;</span>
            <span className="font-semibold text-[var(--text-main)]">{summary.awaiting}</span> awaiting run
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            New Project
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--text-muted)]">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
            <FolderOpen size={24} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[var(--text-main)]">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text-muted)]">
            Create a project to begin working through assumptions, BOQ, schedules, and exports.
          </p>
          <Button className="mt-6" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden border border-[var(--border-soft)] bg-[var(--surface)]">
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Status</TH>
                <TH align="right">Total Capex</TH>
                <TH align="right">Project IRR</TH>
                <TH>Last Run</TH>
                <TH>Updated</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {projects.map((project) => {
                const id = project._id || project.id;
                const isCurrent = String(currentId) === String(id);
                const isBusy = busyId === id;
                return (
                  <TR key={id}>
                    <TD>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openProject(project)} className="truncate font-semibold text-[var(--text-main)] hover:text-primary">
                            {project.projectName}
                          </button>
                          {isCurrent && <Badge variant="primary">Current</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {project.template === 'blank' ? 'Blank model structure' : 'Flour Mills preset reference model'}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      {project.result ? (
                        <Badge variant="success">
                          <CheckCircle2 size={11} className="mr-1" />
                          Run complete
                        </Badge>
                      ) : (
                        <Badge variant="warning">Awaiting run</Badge>
                      )}
                    </TD>
                    <TD align="right">{project.result?.kpis?.totalCapex ? fmtMillions(project.result.kpis.totalCapex, 1) : '-'}</TD>
                    <TD align="right">{project.result?.kpis?.projectIRR != null ? fmtPct(project.result.kpis.projectIRR, 1) : '-'}</TD>
                    <TD>{project.lastRunAt ? fmtDate(project.lastRunAt) : '-'}</TD>
                    <TD>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Calendar size={12} className="text-[var(--text-muted)]" />
                        {fmtDate(project.updatedAt)}
                      </span>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openProject(project)}>
                          <FolderOpen size={14} />
                          Open
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleQuickRun(project)} disabled={isBusy}>
                          <Play size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDuplicate(project)} disabled={isBusy}>
                          <Copy size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(project)} disabled={isBusy} className="text-red-600 hover:border-red-200 hover:text-red-700">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
