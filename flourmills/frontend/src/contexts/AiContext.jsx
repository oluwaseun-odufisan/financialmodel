// AI FEATURE - GROK
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useProject } from './ProjectContext.jsx';

// AI FEATURE - GROK
const AI_STATE_KEY = 'fm_ai_state_v1';
// AI FEATURE - GROK
const AiContext = createContext(null);

function readStoredState() {
  try {
    const raw = localStorage.getItem(AI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buildLocalHistoryFromArtifacts(projectId, artifacts = {}) {
  return ['summary', 'scenarios', 'optimize', 'insights']
    .map((type) => {
      const artifact = artifacts[type];
      if (!artifact) return null;
      return {
        id: artifact.historyId || `local-${projectId}-${type}-${artifact.savedAt || ''}`,
        type,
        title: artifact.title || {
          summary: 'Executive summary',
          scenarios: 'Scenario pack',
          optimize: 'Optimization review',
          insights: 'Insights',
        }[type],
        description: artifact.description || '',
        prompt: artifact.meta?.prompt || '',
        projectId,
        projectName: artifact.meta?.projectName || '',
        metrics: artifact.metrics || artifact.data?.baseCase?.metrics?.kpis || artifact.data?.currentCase?.kpis || {},
        savedAt: artifact.savedAt,
        createdAt: artifact.savedAt,
        localOnly: !artifact.historyId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime());
}

export function AiProvider({ children }) {
  const { current } = useProject();
  const stored = useMemo(() => readStoredState(), []);
  const [sidebarOpen, setSidebarOpen] = useState(stored.sidebarOpen || false);
  const [messagesByProject, setMessagesByProject] = useState(stored.messagesByProject || {});
  const [artifactsByProject, setArtifactsByProject] = useState(stored.artifactsByProject || {});
  const [historyByProject, setHistoryByProject] = useState({});
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(null);

  const projectKey = current ? String(current._id || current.id) : 'none';
  const chatMessages = messagesByProject[projectKey] || [];
  const projectArtifacts = artifactsByProject[projectKey] || {};
  const localArtifactHistory = buildLocalHistoryFromArtifacts(projectKey, projectArtifacts);
  const projectHistory = (historyByProject[projectKey] || localArtifactHistory).length > 0
    ? historyByProject[projectKey] || localArtifactHistory
    : localArtifactHistory;
  const canUseAi = !!current?.result;

  useEffect(() => {
    localStorage.setItem(
      AI_STATE_KEY,
      JSON.stringify({
        sidebarOpen,
        messagesByProject,
        artifactsByProject,
      })
    );
  }, [artifactsByProject, messagesByProject, sidebarOpen]);

  const appendMessage = (projectId, message) => {
    setMessagesByProject((prev) => {
      const existing = prev[projectId] || [];
      return {
        ...prev,
        [projectId]: [...existing, message].slice(-24),
      };
    });
  };

  const sendChat = async (question) => {
    if (!canUseAi || !current) return;
    const trimmed = String(question || '').trim();
    if (!trimmed) return;

    const currentProjectId = String(current._id || current.id);
    const history = (messagesByProject[currentProjectId] || []).slice(-10);
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    appendMessage(currentProjectId, userMessage);
    setChatBusy(true);
    setChatError(null);
    try {
      const response = await api.aiChat(currentProjectId, trimmed, history);
      appendMessage(currentProjectId, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        createdAt: new Date().toISOString(),
      });
      setSidebarOpen(true);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatBusy(false);
    }
  };

  const clearChat = () => {
    if (!current) return;
    const currentProjectId = String(current._id || current.id);
    setMessagesByProject((prev) => {
      const next = { ...prev };
      delete next[currentProjectId];
      return next;
    });
  };

  const saveArtifact = (type, data, meta = {}) => {
    if (!current || !type || !data) return null;
    const currentProjectId = String(current._id || current.id);
    const historyRecord = data.history || null;
    const record = {
      type,
      data: data.payload || data.data || data,
      meta,
      historyId: historyRecord?.id || null,
      title: historyRecord?.title || meta.title || '',
      description: historyRecord?.description || meta.description || '',
      metrics: historyRecord?.metrics || current?.result?.kpis || {},
      savedAt: historyRecord?.savedAt || new Date().toISOString(),
    };

    setArtifactsByProject((prev) => ({
      ...prev,
      [currentProjectId]: {
        ...(prev[currentProjectId] || {}),
        [type]: record,
        lastType: type,
      },
    }));

    if (historyRecord) {
      setHistoryByProject((prev) => {
        const existing = prev[currentProjectId] || [];
        const withoutDuplicate = existing.filter((item) => item.id !== historyRecord.id);
        return {
          ...prev,
          [currentProjectId]: [historyRecord, ...withoutDuplicate].slice(0, 80),
        };
      });
    }

    return record;
  };

  const setLastArtifactType = (type) => {
    if (!current || !type) return;
    const currentProjectId = String(current._id || current.id);
    setArtifactsByProject((prev) => ({
      ...prev,
      [currentProjectId]: {
        ...(prev[currentProjectId] || {}),
        lastType: type,
      },
    }));
  };

  const getArtifact = (type) => {
    if (!type) return null;
    return projectArtifacts[type] || null;
  };

  const loadHistory = useCallback(async ({ force = false, limit = 40, type = '' } = {}) => {
    if (!current) return [];
    const currentProjectId = String(current._id || current.id);
    if (!force && !type && historyByProject[currentProjectId]) return historyByProject[currentProjectId];

    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const response = await api.aiListHistory(currentProjectId, limit, type);
      const remoteHistory = response.history || [];
      const localHistory = buildLocalHistoryFromArtifacts(currentProjectId, artifactsByProject[currentProjectId] || {});
      const remoteIds = new Set(remoteHistory.map((item) => item.id));
      const history = [...remoteHistory, ...localHistory.filter((item) => !remoteIds.has(item.id))];
      if (!type) {
        setHistoryByProject((prev) => ({
          ...prev,
          [currentProjectId]: history,
        }));
      }
      return history;
    } catch (error) {
      const fallback = buildLocalHistoryFromArtifacts(currentProjectId, artifactsByProject[currentProjectId] || {});
      setHistoryByProject((prev) => ({
        ...prev,
        [currentProjectId]: fallback,
      }));
      setHistoryError(error.status === 404 ? null : error.message);
      return fallback;
    } finally {
      setHistoryBusy(false);
    }
  }, [artifactsByProject, current, historyByProject]);

  const openHistoryItem = useCallback(async (historyId) => {
    if (!current || !historyId) return null;
    if (String(historyId).startsWith('local-')) {
      const currentProjectId = String(current._id || current.id);
      const local = buildLocalHistoryFromArtifacts(currentProjectId, artifactsByProject[currentProjectId] || {}).find((item) => item.id === historyId);
      return local;
    }
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const response = await api.aiGetHistory(historyId);
      const history = response.history;
      if (!history) return null;

      const currentProjectId = String(current._id || current.id);
      const record = {
        type: history.type,
        data: history.payload || history.data || {},
        meta: {
          projectName: history.projectName,
          fromHistory: true,
        },
        historyId: history.id,
        title: history.title,
        description: history.description,
        metrics: history.metrics || {},
        savedAt: history.savedAt || history.createdAt,
      };

      setArtifactsByProject((prev) => ({
        ...prev,
        [currentProjectId]: {
          ...(prev[currentProjectId] || {}),
          [history.type]: record,
          lastType: history.type,
        },
      }));
      setHistoryByProject((prev) => {
        const existing = prev[currentProjectId] || [];
        const withoutDuplicate = existing.filter((item) => item.id !== history.id);
        return {
          ...prev,
          [currentProjectId]: [history, ...withoutDuplicate].slice(0, 80),
        };
      });
      return history;
    } catch (error) {
      setHistoryError(error.message);
      return null;
    } finally {
      setHistoryBusy(false);
    }
  }, [artifactsByProject, current]);

  const availableArtifactTypes = ['summary', 'scenarios', 'optimize', 'insights'].filter((type) => !!projectArtifacts[type]);
  const lastArtifactType = projectArtifacts.lastType || availableArtifactTypes[0] || null;

  return (
    <AiContext.Provider
      value={{
        canUseAi,
        sidebarOpen,
        setSidebarOpen,
        chatMessages,
        chatBusy,
        chatError,
        sendChat,
        clearChat,
        saveArtifact,
        getArtifact,
        availableArtifactTypes,
        lastArtifactType,
        setLastArtifactType,
        history: projectHistory,
        historyBusy,
        historyError,
        loadHistory,
        openHistoryItem,
      }}
    >
      {children}
    </AiContext.Provider>
  );
}

export const useAi = () => useContext(AiContext);
