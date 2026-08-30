import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { apiGet } from '../lib/apiClient';
import type { Persona } from '../types';

export function DashboardPage({ onDesign }: { onDesign: () => void }) {
  const { user, signOut } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setBalance(data?.balance ?? 0));
    apiGet<{ personas: Persona[] }>('/personas')
      .then((r) => setPersonas(r.personas))
      .catch(() => {});
  }, [user]);

  return (
    <div className="dashboard-screen">
      <h1>Classygem</h1>
      <p>Signed in as {user?.email}</p>
      <p>Credits: {balance === null ? '…' : balance}</p>
      <button onClick={onDesign}>Design a new model</button>

      <div className="persona-list">
        {personas.length === 0 && <p className="dashboard-note">No models yet.</p>}
        {personas.map((p) => (
          <div key={p.id} className="persona-row">
            <span>
              {p.age_range} · {p.style_vibe ?? 'no vibe set'}
            </span>
            <span className="persona-status">{p.status}</span>
          </div>
        ))}
      </div>

      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
