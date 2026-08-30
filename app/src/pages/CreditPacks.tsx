import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/apiClient';

interface CreditPackOption {
  id: string;
  label: string;
  credits: number;
  priceLabel: string;
}

export function CreditPacksPage({ onBack }: { onBack: () => void }) {
  const [packs, setPacks] = useState<CreditPackOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ creditPacks: CreditPackOption[] }>('/credit-packs')
      .then((r) => setPacks(r.creditPacks))
      .catch((e) => setError(String(e)));
  }, []);

  async function handleBuy(packId: string) {
    setError(null);
    setBusyPackId(packId);
    try {
      const { checkoutUrl } = await apiPost<{ checkoutUrl: string }>('/billing/checkout', { packId });
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(String(e));
      setBusyPackId(null);
    }
  }

  return (
    <div className="library-screen">
      <h1>Buy Credits</h1>
      {error && <p className="auth-error">{error}</p>}
      {packs === null && <p className="designer-loading">Loading…</p>}
      {packs && (
        <div className="pack-grid">
          {packs.map((p) => (
            <div key={p.id} className="pack-card">
              <div className="pack-label">{p.label}</div>
              <div className="pack-credits">{p.credits.toLocaleString()} credits</div>
              <div className="pack-price">{p.priceLabel}</div>
              <button disabled={busyPackId === p.id} onClick={() => handleBuy(p.id)}>
                {busyPackId === p.id ? 'Redirecting…' : 'Buy'}
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={onBack}>Back to dashboard</button>
    </div>
  );
}
