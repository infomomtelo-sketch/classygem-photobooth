import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setBalance(data?.balance ?? 0));
  }, [user]);

  return (
    <div className="dashboard-screen">
      <h1>Classygem</h1>
      <p>Signed in as {user?.email}</p>
      <p>Credits: {balance === null ? '…' : balance}</p>
      <p className="dashboard-note">The model designer arrives in Phase 2.</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
