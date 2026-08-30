import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { ModelDesignerPage } from './pages/ModelDesigner';
import { PersonaStudioPage } from './pages/PersonaStudio';

type View = { name: 'dashboard' } | { name: 'designer' } | { name: 'studio'; personaId: string };

export function App() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>({ name: 'dashboard' });

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!session) return <AuthPage />;

  if (view.name === 'designer') {
    return <ModelDesignerPage onDone={(personaId) => setView({ name: 'studio', personaId })} />;
  }
  if (view.name === 'studio') {
    return <PersonaStudioPage personaId={view.personaId} onBack={() => setView({ name: 'dashboard' })} />;
  }
  return (
    <DashboardPage
      onDesign={() => setView({ name: 'designer' })}
      onOpenPersona={(personaId) => setView({ name: 'studio', personaId })}
    />
  );
}
