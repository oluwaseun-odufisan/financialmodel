import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label } from './ui/Primitives.jsx';
import { useProject } from '../contexts/ProjectContext.jsx';
import { X, FileText, FilePlus2, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils.js';

export default function NewProjectModal({ open, onClose }) {
  const { createProject } = useProject();
  const nav = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [template, setTemplate] = useState('flour_mills');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setProjectName(''); setTemplate('flour_mills'); setError(null); setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) { setError('Project name is required'); return; }
    setLoading(true); setError(null);
    try {
      await createProject({ projectName: name, template });
      onClose();
      nav(template === 'blank' ? '/assumptions' : '/'); // blank → go straight to inputs
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-white border border-border rounded-lg shadow-card w-full max-w-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Create New Project</h2>
            <p className="text-xs text-muted mt-0.5">Choose a starting point</p>
          </div>
          <button
            onClick={() => !loading && onClose()}
            className="text-muted hover:text-ink p-1 rounded hover:bg-offwhite"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                autoFocus
                placeholder="e.g. Acme Industries Mini-Grid"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Starting Template</Label>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <TemplateCard
                  icon={FileText}
                  title="Flour Mills preset"
                  description="Reference model pre-filled with 3 MW Solar + BESS values. Edit anywhere."
                  bullet={[
                    'Full BOQ (₦1.96B grand total)',
                    '10 % tariff escalation from year 3',
                    'Senior debt 90 % + equity 10 %',
                    '10-year model, straight-line depreciation',
                  ]}
                  selected={template === 'flour_mills'}
                  onClick={() => setTemplate('flour_mills')}
                  disabled={loading}
                />
                <TemplateCard
                  icon={FilePlus2}
                  title="Start from scratch"
                  description="Empty template with all fields set to zero. You enter every value yourself."
                  bullet={[
                    'All capex, tariff, opex at 0',
                    '10-year structure, change anytime',
                    'Ideal for a fresh mini-grid model',
                    'Run the engine once you fill inputs',
                  ]}
                  selected={template === 'blank'}
                  onClick={() => setTemplate('blank')}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-offwhite rounded-b-lg flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !projectName.trim()}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                       : <>Create Project</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplateCard({ icon: Icon, title, description, bullet, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative text-left border rounded-lg p-4 transition-colors bg-white',
        selected ? 'border-primary bg-primary-50' : 'border-border hover:border-primary-100',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn(
          'w-8 h-8 rounded flex items-center justify-center',
          selected ? 'bg-primary text-white' : 'bg-offwhite text-primary'
        )}>
          <Icon size={16} />
        </div>
        {selected && <CheckCircle2 size={16} className="text-primary" />}
      </div>
      <div className="mt-3 font-semibold text-sm text-ink">{title}</div>
      <div className="text-xs text-muted mt-1 leading-relaxed">{description}</div>
      <ul className="mt-3 space-y-1">
        {bullet.map((b, i) => (
          <li key={i} className="text-[11px] text-muted flex items-start gap-1.5">
            <span className="text-primary mt-0.5">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
