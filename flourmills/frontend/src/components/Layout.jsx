import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '../contexts/ProjectContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Badge, Button, Progress } from './ui/Primitives.jsx';
import NewProjectModal from './NewProjectModal.jsx';
import { api } from '../lib/api.js';
import {
  BarChart3,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Sliders,
  SunMedium,
  TrendingDown,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

const navItems = [
  { to: '/', label: 'Deal Summary', short: 'Summary', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', short: 'Projects', icon: FolderKanban },
  { to: '/assumptions', label: 'Assumption', short: 'Assumption', icon: Sliders },
  { to: '/boq', label: 'BOQ', short: 'BOQ', icon: FileStack },
  { to: '/monthly', label: 'M.Calculation', short: 'M.Calculation', icon: Calculator },
  { to: '/depreciation', label: 'Depreciation', short: 'Depreciation', icon: TrendingDown },
  { to: '/financials', label: 'Financials', short: 'Financials', icon: BarChart3 },
  { to: '/reports', label: 'Reports', short: 'Reports', icon: FileText },
];

const THEME_KEY = 'fm_theme';
const SIDEBAR_KEY = 'fm_sidebar_collapsed';

function useOutsideClick(ref, onClose) {
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

function AppSidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapsed }) {
  const content = (
    <div className="flex h-full flex-col bg-primary text-white">
      <div className="border-b border-white/10 px-4 py-5">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white">
            <Building2 size={18} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">FundCo Finance</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/55">Model Workspace</div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-5">
        {!collapsed && <div className="mb-3 px-3 text-[10px] uppercase tracking-[0.22em] text-white/50">Navigation</div>}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={mobileOpen ? onCloseMobile : undefined}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-xl px-3 py-3 text-sm transition-colors',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive ? 'bg-white text-primary' : 'text-white/72 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <Icon size={18} />
                {!collapsed && <span className="truncate font-medium">{item.short}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-20 hidden border-r border-slate-900/20 lg:block',
          collapsed ? 'w-[90px]' : 'w-[248px]'
        )}
      >
        {content}
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={onCloseMobile} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] -translate-x-full border-r border-slate-900/20 shadow-2xl transition-transform lg:hidden',
          mobileOpen && 'translate-x-0'
        )}
      >
        <div className="flex items-center justify-end bg-primary px-4 py-3">
          <button type="button" onClick={onCloseMobile} className="rounded-xl p-2 text-white/75 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {content}
      </aside>
    </>
  );
}

function ProjectSwitcher({ onNewProject }) {
  const { projects, current, setCurrentId } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-[240px] max-w-[360px] items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5 text-left hover:bg-[var(--surface-muted)]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Project</div>
          <div className="truncate text-sm font-semibold text-[var(--text-main)]">{current?.projectName || 'No project selected'}</div>
        </div>
        <ChevronDown size={14} className="shrink-0 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 shadow-2xl">
          <div className="max-h-80 space-y-1 overflow-auto">
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No projects yet. Create one to get started.</div>
            ) : (
              projects.map((project) => {
                const id = project._id || project.id;
                const isCurrent = String(current?._id || current?.id) === String(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setCurrentId(id);
                      setOpen(false);
                    }}
                    className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-[var(--surface-muted)]', isCurrent && 'bg-primary-50')}
                  >
                    <div className="mt-0.5 w-4 shrink-0">{isCurrent && <Check size={14} className="text-primary" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-sm', isCurrent ? 'font-semibold text-primary' : 'font-medium text-[var(--text-main)]')}>{project.projectName}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{project.template === 'blank' ? 'Blank model' : 'Flour Mills preset'}</span>
                        <span>&middot;</span>
                        <span>{project.result ? 'Run complete' : 'Awaiting run'}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 border-t border-[var(--border-soft)] pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNewProject();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium text-primary hover:bg-[var(--surface-muted)]"
            >
              <Plus size={14} />
              New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm text-[var(--text-main)] hover:bg-[var(--surface-muted)]"
    >
      {isDark ? <SunMedium size={16} className="text-amber-500" /> : <Moon size={16} className="text-primary" />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

function PdfExportModal({ open, onClose, onSelect, busy }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
        <div className="border-b border-[var(--border-soft)] px-6 py-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">PDF Export</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Select export scope</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Choose the exact package you want to generate from the current project.</p>
        </div>

        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            onClick={() => onSelect('summary')}
            disabled={busy}
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-left hover:border-primary hover:bg-primary-50 disabled:opacity-60"
          >
            <div className="text-base font-semibold text-[var(--text-main)]">Deal Summary only</div>
            <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Executive summary for board or management review.</div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('full')}
            disabled={busy}
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-left hover:border-primary hover:bg-primary-50 disabled:opacity-60"
          >
            <div className="text-base font-semibold text-[var(--text-main)]">Export everything</div>
            <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Complete package including assumptions, schedules, financials, and monthly outputs.</div>
          </button>
        </div>

        <div className="flex justify-end border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function AppNavbar({ onNewProject, theme, onToggleTheme, onOpenMobileSidebar }) {
  const { current, running, runProgress, runModel } = useProject();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exportBusy, setExportBusy] = useState(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setUserMenuOpen(false));

  const hasResult = !!current?.result;
  const projectId = current ? current._id || current.id : null;

  const handleRun = async () => {
    try {
      await runModel();
    } catch (error) {
      alert(`Model run failed: ${error.message}`);
    }
  };

  const handleExcel = async () => {
    setExportBusy(' excel');
    try {
      await api.downloadExcel(projectId, `${current.projectName.replace(/\s+/g, '_')}.xlsx`);
    } catch (error) {
      alert(error.message);
    } finally {
      setExportBusy(null);
    }
  };

  const handlePdfExport = async (scope) => {
    setExportBusy('pdf');
    try {
      const suffix = scope === 'summary' ? '_deal_summary' : '_full_report';
      await api.downloadPdf(projectId, `${current.projectName.replace(/\s+/g, '_')}${suffix}.pdf`, scope);
      setPdfModalOpen(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setExportBusy(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--surface)]">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="inline-flex rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <ProjectSwitcher onNewProject={onNewProject} />

          {current && (
            hasResult ? (
              <Badge variant="success" className="hidden md:inline-flex">
                <CheckCircle2 size={11} className="mr-1" />
                Run complete
              </Badge>
            ) : (
              <Badge variant="warning" className="hidden md:inline-flex">
                <AlertCircle size={11} className="mr-1" />
                Awaiting run
              </Badge>
            )
          )}

          <div className="ml-auto flex items-center gap-2">
            {running && (
              <div className="hidden min-w-[210px] items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 md:flex">
                <Progress value={runProgress} className="flex-1" />
                <span className="text-xs text-[var(--text-muted)]">{runProgress}%</span>
              </div>
            )}

            <Button variant="outline" onClick={onNewProject} className="hidden sm:inline-flex">
              <Plus size={14} />
              New
            </Button>

            {hasResult && (
              <>
                <Button variant="outline" onClick={handleExcel} disabled={!!exportBusy} className="hidden lg:inline-flex">
                  <FileSpreadsheet size={16} />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={() => setPdfModalOpen(true)} disabled={!!exportBusy} className="hidden lg:inline-flex">
                  <FileText size={16} />
                  Export PDF
                </Button>
              </>
            )}

            <Button onClick={handleRun} disabled={running || !current}>
              <Play size={16} />
              {running ? 'Running...' : 'Run Model'}
            </Button>

            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] pl-2 pr-3 hover:bg-[var(--surface-muted)]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-medium text-[var(--text-main)]">{user?.name || 'User'}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{user?.email}</div>
                </div>
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] py-2 shadow-2xl">
                  <div className="border-b border-[var(--border-soft)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--text-main)]">{user?.name || 'User'}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">{user?.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[var(--text-main)] hover:bg-[var(--surface-muted)]"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <PdfExportModal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} onSelect={handlePdfExport} busy={exportBusy === 'pdf'} />
    </>
  );
}

export default function Layout() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="flex min-h-full bg-[var(--shell-bg)] text-[var(--text-main)]">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div className={cn('hidden lg:block', sidebarCollapsed ? 'w-[90px]' : 'w-[248px]')} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppNavbar
          onNewProject={() => setNewProjectOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}
