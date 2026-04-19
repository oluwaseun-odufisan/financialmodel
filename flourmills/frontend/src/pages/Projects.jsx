import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext.jsx';
import { Button, Card, CardBody, Badge } from '../components/ui/Primitives.jsx';
import NewProjectModal from '../components/NewProjectModal.jsx';
import {
  Plus, FolderOpen, Copy, Trash2, Play, CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import { fmtMillions, fmtDate, fmtPct } from '../lib/utils.js';

export default function Projects() {
  const { projects, loading, setCurrentId, currentId, duplicateProject, deleteProject, runModel } = useProject();
  const nav = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const onOpen = (p) => {
    setCurrentId(p._id || p.id);
    nav('/');
  };

  const onDuplicate = async (p) => {
    setBusy(p._id || p.id);
    try { await duplicateProject(p._id || p.id); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const onDelete = async (p) => {
    if (!confirm(`Delete "${p.projectName}"? This cannot be undone.`)) return;
    setBusy(p._id || p.id);
    try { await deleteProject(p._id || p.id); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const onQuickRun = async (p) => {
    setCurrentId(p._id || p.id);
    setBusy(p._id || p.id);
    try { await runModel(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="text-sm text-muted mt-1">
            Each project is independent.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Project
        </Button>
      </div>

      {loading ? (
        <Card><CardBody className="py-10 text-center text-sm text-muted">Loading projects…</CardBody></Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <div className="inline-flex w-12 h-12 bg-primary-50 rounded-full items-center justify-center mb-3">
              <FolderOpen size={22} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-ink">No projects yet</h2>
            <p className="text-sm text-muted mt-1 max-w-md mx-auto">
              Use the Flour Mills preset as a reference,
              or start from scratch and enter every value in Assumptions.
            </p>
            <Button className="mt-5" size="lg" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Create Your First Project
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const id = p._id || p.id;
            const isCurrent = String(currentId) === String(id);
            const hasResult = !!p.result;
            const busyMe = busy === id;
            return (
              <Card key={id} className={isCurrent ? 'border-primary ring-1 ring-primary-50' : ''}>
                <CardBody className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onOpen(p)}
                        className="text-left font-semibold text-ink hover:text-primary truncate min-w-0"
                        title={p.projectName}
                      >
                        {p.projectName}
                      </button>
                      {isCurrent && <Badge variant="primary" className="shrink-0">Current</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="neutral">
                        {p.template === 'blank' ? 'Blank' : 'Flour Mills preset'}
                      </Badge>
                      {hasResult
                        ? <Badge variant="success"><CheckCircle2 size={10} className="mr-1" /> Ran</Badge>
                        : <Badge variant="warning"><AlertCircle size={10} className="mr-1" /> Not run</Badge>}
                    </div>
                  </div>

                  <dl className="text-xs divide-y divide-border">
                    <div className="flex justify-between py-1.5">
                      <dt className="text-muted">Total Capex</dt>
                      <dd className="num font-medium">
                        {p.result?.kpis?.totalCapex ? fmtMillions(p.result.kpis.totalCapex, 1) : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <dt className="text-muted">Project IRR</dt>
                      <dd className="num font-medium">
                        {p.result?.kpis?.projectIRR != null ? fmtPct(p.result.kpis.projectIRR, 1) : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <dt className="text-muted">Last run</dt>
                      <dd className="font-medium">{p.lastRunAt ? fmtDate(p.lastRunAt) : '—'}</dd>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <dt className="text-muted flex items-center gap-1"><Calendar size={10} /> Updated</dt>
                      <dd className="font-medium">{fmtDate(p.updatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" onClick={() => onOpen(p)} className="flex-1">
                      <FolderOpen size={12} /> Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onQuickRun(p)} disabled={busyMe}>
                      <Play size={12} /> Run
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDuplicate(p)} disabled={busyMe} title="Duplicate">
                      <Copy size={12} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(p)} disabled={busyMe} title="Delete" className="text-red-600 hover:text-red-700 hover:border-red-200">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
