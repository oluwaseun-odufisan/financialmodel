import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label } from './ui/Primitives.jsx';
import { useProject } from '../contexts/ProjectContext.jsx';
import { CheckCircle2, FilePlus2, FileText, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils.js';

export default function NewProjectModal({ open, onClose }) {
  const { createProject } = useProject();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [template, setTemplate] = useState('flour_mills');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setProjectName('');
    setTemplate('flour_mills');
    setError(null);
    setLoading(false);
  }, [open]);

  if (!open) return null;

  const onSubmit = async (event) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject({ projectName: name, template });
      onClose();
      navigate(template === 'blank' ? '/assumptions' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={(event) => event.target === event.currentTarget && !loading && onClose()}>
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Create Project</div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Start a new modeling workspace</h2>
          </div>
          <button type="button" onClick={() => !loading && onClose()} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-6 px-6 py-6">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                autoFocus
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                disabled={loading}
                className="mt-1.5"
                placeholder="e.g. Flour Mills Ogun Solar Project"
              />
            </div>

            <div>
              <Label>Starting Template</Label>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <TemplateCard
                  icon={FileText}
                  title="Flour Mills preset"
                  description="Use the current reference structure with enterprise assumptions already preloaded."
                  bullets={[
                    'Preset BOQ and financing structure',
                    'Commercial tariff escalation included',
                    'Straight-line depreciation schedule',
                    'Ready for immediate model run',
                  ]}
                  selected={template === 'flour_mills'}
                  onClick={() => setTemplate('flour_mills')}
                  disabled={loading}
                />
                <TemplateCard
                  icon={FilePlus2}
                  title="Start from scratch"
                  description="Begin with a blank model and enter every assumption manually."
                  bullets={[
                    'Zeroed commercial assumptions',
                    'Editable 10-year structure',
                    'Useful for custom scenarios',
                    'Takes you directly to inputs',
                  ]}
                  selected={template === 'blank'}
                  onClick={() => setTemplate('blank')}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>}
          </div>

          <div className="flex items-center justify-end gap-2 rounded-b-[28px] border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !projectName.trim()}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplateCard({ icon: Icon, title, description, bullets, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-2xl border bg-[var(--surface)] p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary-50' : 'border-[var(--border-soft)] hover:border-primary-100',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', selected ? 'bg-primary text-white' : 'bg-[var(--surface-muted)] text-primary')}>
          <Icon size={18} />
        </div>
        {selected && <CheckCircle2 size={16} className="text-primary" />}
      </div>

      <div className="mt-4 text-sm font-semibold text-[var(--text-main)]">{title}</div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{description}</div>

      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
