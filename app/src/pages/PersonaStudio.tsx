import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiGet, apiPost } from '../lib/apiClient';
import type { BackgroundPreset, JobPollResult, MotionPreset, Persona, Still, Upscale, Video } from '../types';

type Step = 'setup' | 'rendering' | 'picking' | 'upscaling' | 'upscaled' | 'animating' | 'video';

export function PersonaStudioPage({ personaId, onBack }: { personaId: string; onBack: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [backgrounds, setBackgrounds] = useState<BackgroundPreset[]>([]);
  const [motionPresets, setMotionPresets] = useState<MotionPreset[]>([]);
  const [step, setStep] = useState<Step>('setup');
  const [backgroundPresetId, setBackgroundPresetId] = useState('');
  const [useCustomBackground, setUseCustomBackground] = useState(false);
  const [customBackground, setCustomBackground] = useState('');
  const [outfitPrompt, setOutfitPrompt] = useState('');
  const [stills, setStills] = useState<Still[]>([]);
  const [selectedStillId, setSelectedStillId] = useState<string | null>(null);
  const [upscale, setUpscale] = useState<Upscale | null>(null);
  const [selectedMotion, setSelectedMotion] = useState('');
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    apiGet<{ persona: Persona }>(`/personas/${personaId}`)
      .then((r) => setPersona(r.persona))
      .catch((e) => setError(String(e)));
    apiGet<{ backgrounds: BackgroundPreset[] }>('/backgrounds')
      .then((r) => {
        setBackgrounds(r.backgrounds);
        if (r.backgrounds.length) setBackgroundPresetId(r.backgrounds[0].id);
      })
      .catch((e) => setError(String(e)));
    apiGet<{ motionPresets: MotionPreset[] }>('/motion-presets')
      .then((r) => {
        setMotionPresets(r.motionPresets);
        if (r.motionPresets.length) setSelectedMotion(r.motionPresets[0].id);
      })
      .catch((e) => setError(String(e)));
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [personaId]);

  function pollJob(jobId: string, onSettled: (result: JobPollResult) => void, onFailStep: Step) {
    pollRef.current = window.setInterval(async () => {
      try {
        const result = await apiGet<JobPollResult>(`/jobs/${jobId}`);
        if (result.job.status === 'succeeded' || result.job.status === 'failed') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (result.job.status === 'failed') {
            setError(result.error ?? 'Generation failed.');
            setStep(onFailStep);
            return;
          }
          onSettled(result);
        }
      } catch (e) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setError(String(e));
        setStep(onFailStep);
      }
    }, 2500);
  }

  async function handleGenerateStills(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { jobId } = await apiPost<{ jobId: string }>(`/personas/${personaId}/stills`, {
        backgroundPresetId: useCustomBackground ? undefined : backgroundPresetId,
        customBackgroundPrompt: useCustomBackground ? customBackground : undefined,
        outfitPrompt,
      });
      setStep('rendering');
      pollJob(
        jobId,
        (result) => {
          setStills(result.stills ?? []);
          setSelectedStillId(null);
          setStep('picking');
        },
        'setup'
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpscale() {
    if (!selectedStillId) return;
    setError(null);
    setBusy(true);
    try {
      const { jobId } = await apiPost<{ jobId: string }>(`/stills/${selectedStillId}/upscale`);
      setStep('upscaling');
      pollJob(
        jobId,
        (result) => {
          if (result.upscale) setUpscale(result.upscale);
          setVideo(null);
          setStep('upscaled');
        },
        'picking'
      );
    } catch (e) {
      setError(String(e));
      setStep('picking');
    } finally {
      setBusy(false);
    }
  }

  async function handleAnimate(e: FormEvent) {
    e.preventDefault();
    if (!upscale) return;
    setError(null);
    setBusy(true);
    try {
      const { jobId } = await apiPost<{ jobId: string }>(`/upscales/${upscale.id}/animate`, { motionPreset: selectedMotion });
      setStep('animating');
      pollJob(
        jobId,
        (result) => {
          if (result.video) setVideo(result.video);
          setStep('video');
        },
        'upscaled'
      );
    } catch (e) {
      setError(String(e));
      setStep('upscaled');
    } finally {
      setBusy(false);
    }
  }

  if (!persona || !backgrounds.length || !motionPresets.length) return <p className="designer-loading">Loading…</p>;

  if (persona.lora_status !== 'ready') {
    return (
      <div className="designer-screen">
        <p className="designer-status">This model's identity isn't locked yet.</p>
        <button onClick={onBack}>Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="designer-screen">
      <h1>Build the frame</h1>
      {error && <p className="auth-error">{error}</p>}

      {step === 'setup' && (
        <form className="designer-form" onSubmit={handleGenerateStills}>
          <label className="studio-toggle">
            <input type="checkbox" checked={useCustomBackground} onChange={(e) => setUseCustomBackground(e.target.checked)} />
            Write my own background
          </label>
          {useCustomBackground ? (
            <label>
              Custom background
              <textarea
                value={customBackground}
                onChange={(e) => setCustomBackground(e.target.value)}
                maxLength={300}
                rows={2}
                required
              />
            </label>
          ) : (
            <label>
              Background
              <select value={backgroundPresetId} onChange={(e) => setBackgroundPresetId(e.target.value)}>
                {backgrounds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Outfit
            <textarea
              value={outfitPrompt}
              onChange={(e) => setOutfitPrompt(e.target.value)}
              maxLength={300}
              rows={2}
              required
              placeholder="e.g. tailored ivory blazer over a silk slip dress"
            />
          </label>
          <button type="submit" disabled={busy}>
            Render 4 stills
          </button>
        </form>
      )}

      {step === 'rendering' && <p className="designer-status">Rendering stills at full resolution…</p>}

      {step === 'picking' &&
        (stills.length === 0 ? (
          <div>
            <p className="designer-status">All renders were rejected by content guardrails. Try adjusting your background or outfit.</p>
            <button onClick={() => setStep('setup')}>Back to setup</button>
          </div>
        ) : (
          <div className="candidate-grid">
            {stills.map((s) => (
              <button
                key={s.id}
                type="button"
                className={'candidate-card' + (selectedStillId === s.id ? ' selected' : '')}
                onClick={() => s.imageUrl && setSelectedStillId(s.id)}
                disabled={!s.imageUrl}
              >
                {s.imageUrl ? <img src={s.imageUrl} alt="Still" /> : <span className="candidate-rejected">Rejected by guardrails</span>}
              </button>
            ))}
            <button className="designer-primary" disabled={!selectedStillId || busy} onClick={handleUpscale}>
              Upscale this still
            </button>
          </div>
        ))}

      {step === 'upscaling' && <p className="designer-status">Upscaling…</p>}

      {step === 'upscaled' && upscale && (
        <div>
          <img className="studio-final" src={upscale.imageUrl} alt="Upscaled still" />
          <form className="designer-form" onSubmit={handleAnimate}>
            <label>
              Motion
              <select value={selectedMotion} onChange={(e) => setSelectedMotion(e.target.value)}>
                {motionPresets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy}>
              Animate
            </button>
          </form>
          <button onClick={onBack}>Back to dashboard</button>
        </div>
      )}

      {step === 'animating' && <p className="designer-status">Animating — this can take a minute or two…</p>}

      {step === 'video' && video && (
        <div>
          <video className="studio-video" src={video.videoUrl} controls playsInline />
          <p className="designer-status">Video ready. Library and download arrive in Phase 5.</p>
          <button onClick={() => setStep('upscaled')}>Try another motion</button>
          <button onClick={onBack}>Back to dashboard</button>
        </div>
      )}
    </div>
  );
}
