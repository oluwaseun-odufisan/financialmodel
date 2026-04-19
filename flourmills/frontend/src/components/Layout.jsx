import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Button, Progress, Badge } from './ui/Primitives.jsx';
import NewProjectModal from './NewProjectModal.jsx';
import { api } from '../lib/api.js';
import {
  LayoutDashboard, Sliders, FileStack, Calculator, TrendingDown,
  BarChart3, FileSpreadsheet, FileText, Play, LogOut, ChevronDown,
  CheckCircle2, AlertCircle, FolderKanban, Plus, Check
} from 'lucide-react';
import { cn } from '../lib/utils.js';

const navItems = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/projects',     label: 'Projects',     icon: FolderKanban },
  { to: '/assumptions',  label: 'Assumptions',  icon: Sliders },
  { to: '/boq',          label: 'BOQ',          icon: FileStack },
  { to: '/monthly',      label: 'Monthly Calc', icon: Calculator },
  { to: '/depreciation', label: 'Depreciation', icon: TrendingDown },
  { to: '/financials',   label: 'Financials',   icon: BarChart3 },
  { to: '/reports',      label: 'Reports',      icon: FileText },
];

function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-border flex flex-col">
      <div className="px-5 h-16 flex items-center border-b border-border">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-ink leading-tight">
            Flour Mills
            <div className="text-[10px] font-normal text-muted uppercase tracking-wider">Finance Model</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-primary bg-primary-50 border-r-2 border-primary font-semibold'
                    : 'text-muted hover:text-ink hover:bg-offwhite'
                }`
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-border text-[10px] text-muted">
        v1.0 · Project Finance Engine
      </div>
    </aside>
  );
}

function ProjectSwitcher({ onNewProject }) {
  const { projects, current, setCurrentId } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-3 flex items-center gap-2 rounded-md border border-border bg-white hover:bg-offwhite min-w-0 max-w-xs"
      >
        <div className="flex flex-col text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted leading-none">Project</div>
          <div className="text-sm font-semibold text-ink truncate">
            {current?.projectName || 'No project selected'}
          </div>
        </div>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute top-12 left-0 w-80 bg-white border border-border rounded-md shadow-card py-1 z-50">
          <div className="max-h-80 overflow-auto">
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted text-center">
                No projects yet. Create one to get started.
              </div>
            ) : (
              projects.map((p) => {
                const id = p._id || p.id;
                const isCurrent = String(current?._id || current?.id) === String(id);
                return (
                  <button
                    key={id}
                    onClick={() => { setCurrentId(id); setOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-offwhite',
                      isCurrent && 'bg-primary-50'
                    )}
                  >
                    <div className="w-4 mt-0.5 shrink-0">
                      {isCurrent && <Check size={14} className="text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm truncate', isCurrent ? 'font-semibold text-primary' : 'text-ink')}>
                        {p.projectName}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                        <span>{p.template === 'blank' ? 'Blank' : 'Flour Mills preset'}</span>
                        <span className="text-border">·</span>
                        {p.result
                          ? <span className="text-emerald-700">Ran</span>
                          : <span className="text-amber-700">Not run</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); onNewProject(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-offwhite text-sm text-primary font-medium"
            >
              <Plus size={14} /> New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ onNewProject }) {
  const { current, running, runProgress, runModel } = useProject();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResult = !!current?.result;
  const projId = current ? (current._id || current.id) : null;

  const handleRun = async () => {
    try { await runModel(); }
    catch (e) { alert('Model run failed: ' + e.message); }
  };

  const handleExcel = async () => {
    setExportBusy('excel');
    try { await api.downloadExcel(projId, `${current.projectName.replace(/\s+/g, '_')}.xlsx`); }
    catch (e) { alert(e.message); } finally { setExportBusy(null); }
  };
  const handlePdf = async () => {
    setExportBusy('pdf');
    try { await api.downloadPdf(projId, `${current.projectName.replace(/\s+/g, '_')}.pdf`); }
    catch (e) { alert(e.message); } finally { setExportBusy(null); }
  };

  return (
    <header className="h-16 bg-white border-b border-border shrink-0">
      <div className="h-full px-6 flex items-center gap-3">
        <ProjectSwitcher onNewProject={onNewProject} />

        <Button variant="outline" size="md" onClick={onNewProject}>
          <Plus size={14} /> New
        </Button>

        {current && (hasResult ? (
          <Badge variant="success" className="ml-1">
            <CheckCircle2 size={11} className="mr-1" /> Run complete
          </Badge>
        ) : (
          <Badge variant="warning" className="ml-1">
            <AlertCircle size={11} className="mr-1" /> Not run
          </Badge>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {running && (
            <div className="w-48 flex items-center gap-3 mr-2">
              <Progress value={runProgress} className="flex-1" />
              <span className="text-xs text-muted">{runProgress}%</span>
            </div>
          )}
          {hasResult && (
            <>
              <Button variant="outline" size="md" onClick={handleExcel} disabled={!!exportBusy}>
                <FileSpreadsheet size={16} />
                {exportBusy === 'excel' ? 'Exporting…' : 'Export Excel'}
              </Button>
              <Button variant="outline" size="md" onClick={handlePdf} disabled={!!exportBusy}>
                <FileText size={16} />
                {exportBusy === 'pdf' ? 'Exporting…' : 'Export PDF'}
              </Button>
            </>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleRun}
            disabled={running || !current}
          >
            <Play size={16} />
            {running ? 'Running…' : 'Run Model'}
          </Button>

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="h-10 pl-2 pr-3 flex items-center gap-2 rounded-md border border-border hover:bg-offwhite"
            >
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-xs font-semibold">
                {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs text-muted">{user?.email?.split('@')[0]}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white border border-border rounded-md shadow-card py-1 z-50">
                <div className="px-3 py-2 text-xs text-muted border-b border-border truncate">{user?.email}</div>
                <button
                  onClick={() => { logout(); nav('/login'); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-offwhite flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div className="h-full flex bg-offwhite">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onNewProject={() => setNewProjectOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}
