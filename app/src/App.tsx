import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { ModelDesignerPage } from './pages/ModelDesigner';

type View = 'dashboard' | 'designer';

export function App() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!session) return <AuthPage />;

  if (view === 'designer') {
    return <ModelDesignerPage onDone={() => setView('dashboard')} />;
  }
  return <DashboardPage onDesign={() => setView('designer')} />;
}
