import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { useProject } from './contexts/ProjectContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Projects from './pages/Projects.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assumptions from './pages/Assumptions.jsx';
import BOQ from './pages/BOQ.jsx';
import MonthlyCalc from './pages/MonthlyCalc.jsx';
import Depreciation from './pages/Depreciation.jsx';
import Financials from './pages/Financials.jsx';
import Reports from './pages/Reports.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-muted">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** For pages that require a current project. Falls through to /projects if none. */
function RequireProject({ children }) {
  const { current, loading } = useProject();
  if (loading) return <div className="text-sm text-muted">Loading projects…</div>;
  if (!current) return <Navigate to="/projects" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/projects" element={<Projects />} />
        <Route path="/"             element={<RequireProject><Dashboard /></RequireProject>} />
        <Route path="/assumptions"  element={<RequireProject><Assumptions /></RequireProject>} />
        <Route path="/boq"          element={<RequireProject><BOQ /></RequireProject>} />
        <Route path="/monthly"      element={<RequireProject><MonthlyCalc /></RequireProject>} />
        <Route path="/depreciation" element={<RequireProject><Depreciation /></RequireProject>} />
        <Route path="/financials"   element={<RequireProject><Financials /></RequireProject>} />
        <Route path="/reports"      element={<RequireProject><Reports /></RequireProject>} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
