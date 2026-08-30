import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LandingPage } from './pages/Landing';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { ModelDesignerPage } from './pages/ModelDesigner';
import { PersonaStudioPage } from './pages/PersonaStudio';
import { VideoLibraryPage } from './pages/VideoLibrary';
import { CreditPacksPage } from './pages/CreditPacks';

type View =
  | { name: 'dashboard' }
  | { name: 'designer' }
  | { name: 'studio'; personaId: string }
  | { name: 'library' }
  | { name: 'credits' };

export function App() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>({ name: 'dashboard' });
  const [showAuth, setShowAuth] = useState(false);

  if (loading) return <div className="loading-screen">Loading…</div>;

  if (!session) {
    return showAuth ? <AuthPage onBack={() => setShowAuth(false)} /> : <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (view.name === 'designer') {
    return <ModelDesignerPage onDone={(personaId) => setView({ name: 'studio', personaId })} />;
  }
  if (view.name === 'studio') {
    return <PersonaStudioPage personaId={view.personaId} onBack={() => setView({ name: 'dashboard' })} />;
  }
  if (view.name === 'library') {
    return <VideoLibraryPage onBack={() => setView({ name: 'dashboard' })} />;
  }
  if (view.name === 'credits') {
    return <CreditPacksPage onBack={() => setView({ name: 'dashboard' })} />;
  }
  return (
    <DashboardPage
      onDesign={() => setView({ name: 'designer' })}
      onOpenPersona={(personaId) => setView({ name: 'studio', personaId })}
      onOpenLibrary={() => setView({ name: 'library' })}
      onOpenCredits={() => setView({ name: 'credits' })}
    />
  );
}
