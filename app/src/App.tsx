import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';

export function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  return session ? <DashboardPage /> : <AuthPage />;
}
