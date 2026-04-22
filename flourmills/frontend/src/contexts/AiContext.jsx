// AI FEATURE - GROK
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function AiProvider({ children }) {
  const { current } = useProject();
  const stored = useMemo(() => readStoredState(), []);
  const [sidebarOpen, setSidebarOpen] = useState(stored.sidebarOpen || false);
  const [messagesByProject, setMessagesByProject] = useState(stored.messagesByProject || {});
  const [artifactsByProject, setArtifactsByProject] = useState(stored.artifactsByProject || {});
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(null);

  const projectKey = current ? String(current._id || current.id) : 'none';
  const chatMessages = messagesByProject[projectKey] || [];
  const projectArtifacts = artifactsByProject[projectKey] || {};
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
    const record = {
      type,
      data,
      meta,
      savedAt: new Date().toISOString(),
    };

    setArtifactsByProject((prev) => ({
      ...prev,
      [currentProjectId]: {
        ...(prev[currentProjectId] || {}),
        [type]: record,
        lastType: type,
      },
    }));

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
      }}
    >
      {children}
    </AiContext.Provider>
  );
}

export const useAi = () => useContext(AiContext);
