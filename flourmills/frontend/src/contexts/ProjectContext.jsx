import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const ProjectContext = createContext(null);
const CURRENT_KEY = 'fm_current_project';

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [currentId, setCurrentIdState] = useState(() => localStorage.getItem(CURRENT_KEY));
  const [loading, setLoading]   = useState(false);
  const [running, setRunning]   = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [error, setError]       = useState(null);

  const setCurrentId = (id) => {
    setCurrentIdState(id);
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else    localStorage.removeItem(CURRENT_KEY);
  };

  const current = projects.find((p) => String(p._id || p.id) === String(currentId)) || null;

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { projects } = await api.listProjects();
      setProjects(projects);
      // If current id is not in the list, either pick the first or keep it null
      const ids = projects.map((p) => String(p._id || p.id));
      if (currentId && !ids.includes(String(currentId))) {
        setCurrentId(projects[0] ? (projects[0]._id || projects[0].id) : null);
      } else if (!currentId && projects[0]) {
        setCurrentId(projects[0]._id || projects[0].id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, currentId]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  const updateAssumptionDeep = async (updateFn) => {
    if (!current) return;
    const id = current._id || current.id;
    const next = updateFn(JSON.parse(JSON.stringify(current.assumption)));
    const { project } = await api.updateProject(id, { assumption: next });
    setProjects((ps) => ps.map((p) => ((p._id || p.id) === id ? project : p)));
    return project;
  };

  const renameProject = async (name) => {
    if (!current) return;
    const id = current._id || current.id;
    const { project } = await api.updateProject(id, { projectName: name });
    setProjects((ps) => ps.map((p) => ((p._id || p.id) === id ? project : p)));
  };

  const runModel = async () => {
    if (!current) return;
    const id = current._id || current.id;
    setRunning(true); setRunProgress(10); setError(null);
    const tick = setInterval(() => setRunProgress((p) => (p < 85 ? p + 7 : p)), 180);
    try {
      const { project } = await api.runModel(id);
      setProjects((ps) => ps.map((p) => ((p._id || p.id) === id ? project : p)));
      setRunProgress(100);
      return project;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      clearInterval(tick);
      setTimeout(() => { setRunning(false); setRunProgress(0); }, 400);
    }
  };

  const createProject = async ({ projectName, template = 'flour_mills' }) => {
    const { project } = await api.createProject(projectName, template);
    setProjects((ps) => [project, ...ps]);
    setCurrentId(project._id || project.id);
    return project;
  };

  const duplicateProject = async (id, projectName) => {
    const { project } = await api.duplicateProject(id, projectName);
    setProjects((ps) => [project, ...ps]);
    setCurrentId(project._id || project.id);
    return project;
  };

  const deleteProject = async (id) => {
    await api.deleteProject(id);
    setProjects((ps) => ps.filter((p) => String(p._id || p.id) !== String(id)));
    if (String(currentId) === String(id)) {
      const remaining = projects.filter((p) => String(p._id || p.id) !== String(id));
      setCurrentId(remaining[0] ? (remaining[0]._id || remaining[0].id) : null);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects, current, currentId, setCurrentId,
        loading, error, refresh, updateAssumptionDeep,
        runModel, running, runProgress,
        createProject, duplicateProject, deleteProject, renameProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
