const TOKEN_KEY = 'fm_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/* ============================================= */
/*  NEW: Dynamic API base URL for Vercel + Local */
/* ============================================= */
const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000')   // ← change port if your backend uses something else
  : '/_/backend';   // ← this is what Vercel Experimental Services uses

async function request(path, options = {}) {
  const url = API_BASE + path;                    // ← automatically adds /_/backend in production

  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new Error('Session expired');
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.error || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  if (!res.ok) {
    const error = new Error(`Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res;
}

async function extractBlobError(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return data.error || fallbackMessage;
  }
  try {
    const text = await response.text();
    return text || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export const api = {
  login:    (email, password)        => request('/api/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, name)  => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  me:       ()                       => request('/api/auth/me'),
  listProjects:  ()                  => request('/api/projects'),
  getProject:    (id)                => request(`/api/projects/${id}`),
  createProject: (projectName, template) => request('/api/projects', { method: 'POST', body: JSON.stringify({ projectName, template }) }),
  updateProject: (id, patch)         => request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  runModel:      (id)                => request(`/api/projects/${id}/run`, { method: 'POST' }),
  duplicateProject: (id, projectName)=> request(`/api/projects/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ projectName }) }),
  deleteProject: (id)                => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // === Downloads (blob responses) ===
  downloadExcel: async (id, filename = 'project.xlsx') => {
    const token = getToken();
    const url = `${API_BASE}/api/projects/${id}/export/excel`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) throw new Error(await extractBlobError(res, 'Excel export failed'));
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  },

  downloadPdf: async (id, filename = 'project.pdf', scope = 'full') => {
    const token = getToken();
    const url = `${API_BASE}/api/projects/${id}/export/pdf?scope=${encodeURIComponent(scope)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) throw new Error(await extractBlobError(res, 'PDF export failed'));
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  },

  // AI FEATURE - GROK
  aiChat: (projectId, question, history = []) =>
    request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ projectId, question, history }),
    }),
  // AI FEATURE - GROK
  aiExplain: (projectId, target) =>
    request('/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ projectId, target }),
    }),
  // AI FEATURE - GROK
  aiGenerateScenarios: (projectId) =>
    request('/api/ai/scenarios', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  // AI FEATURE - GROK
  aiOptimizeModel: (projectId, goal) =>
    request('/api/ai/optimize', {
      method: 'POST',
      body: JSON.stringify({ projectId, goal }),
    }),
  // AI FEATURE - GROK
  aiGenerateSummary: (projectId) =>
    request('/api/ai/summary', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  // AI FEATURE - GROK
  aiGenerateInsights: (projectId) =>
    request('/api/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  // AI FEATURE - GROK
  aiListHistory: (projectId, limit = 40, type = '') => {
    const params = new URLSearchParams({ projectId, limit: String(limit) });
    if (type) params.set('type', type);
    return request(`/api/ai/history?${params.toString()}`).catch((error) => {
      if (error.status === 404) return { history: [], unavailable: true };
      throw error;
    });
  },
  // AI FEATURE - GROK
  aiGetHistory: (historyId) => request(`/api/ai/history/${historyId}`),

  getPresentationPresets: () => request('/api/presentations/presets'),
  generatePresentationDraft: (projectId, options = {}) =>
    request('/api/presentations/draft', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...options }),
    }).catch((error) => {
      if (error.status !== 404) throw error;
      return request(`/api/projects/${projectId}/presentation/draft`, {
        method: 'POST',
        body: JSON.stringify({ projectId, ...options }),
      });
    }),
  listPresentationHistory: (projectId, limit = 20) =>
    request(`/api/presentations/history?${new URLSearchParams({ projectId, limit: String(limit) }).toString()}`).catch((error) => {
      if (error.status !== 404) throw error;
      return request(`/api/projects/${projectId}/presentation/history?${new URLSearchParams({ limit: String(limit) }).toString()}`);
    }),
  getPresentationHistory: (projectId, historyId) =>
    request(`/api/presentations/history/${historyId}`).catch((error) => {
      if (error.status !== 404) throw error;
      return request(`/api/projects/${projectId}/presentation/history/${historyId}`);
    }),
  downloadPresentation: async (projectId, filename = 'presentation.pptx', options = {}) => {
    const token = getToken();
    const requestExport = (path) => fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ projectId, ...options }),
    });

    let res = await requestExport('/api/presentations/export');
    if (res.status === 404) res = await requestExport(`/api/projects/${projectId}/presentation/export`);

    if (!res.ok) throw new Error(await extractBlobError(res, 'Presentation export failed'));
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  },
};
