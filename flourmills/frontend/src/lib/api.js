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
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res;
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

    if (!res.ok) throw new Error('Excel export failed');
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  },

  downloadPdf: async (id, filename = 'project.pdf') => {
    const token = getToken();
    const url = `${API_BASE}/api/projects/${id}/export/pdf`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) throw new Error('PDF export failed');
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  },
};