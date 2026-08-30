import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiGet, apiPost } from '../lib/apiClient';
import type { Candidate, JobPollResult, Persona, PersonaOptions } from '../types';

type Step = 'form' | 'generating' | 'picking' | 'training' | 'done';

export function ModelDesignerPage({ onDone }: { onDone: () => void }) {
  const [options, setOptions] = useState<PersonaOptions | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [ageRange, setAgeRange] = useState('');
  const [hair, setHair] = useState('');
  const [build, setBuild] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [styleVibe, setStyleVibe] = useState('');
  const [freeText, setFreeText] = useState('');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    apiGet<PersonaOptions>('/options')
      .then((opts) => {
        setOptions(opts);
        setAgeRange(opts.ageRanges[0]);
      })
      .catch((e) => setError(String(e)));
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function pollJob(jobId: string, onSettled: (result: JobPollResult) => void) {
    pollRef.current = window.setInterval(async () => {
      try {
        const result = await apiGet<JobPollResult>(`/jobs/${jobId}`);
        if (result.job.status === 'succeeded' || result.job.status === 'failed') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (result.job.status === 'failed') {
            setError(result.error ?? 'Generation failed.');
            setStep('form');
            return;
          }
          onSettled(result);
        }
      } catch (e) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setError(String(e));
        setStep('form');
      }
    }, 2500);
  }

  async function handleCreatePersona(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { persona: created } = await apiPost<{ persona: Persona }>('/personas', {
        age_range: ageRange,
        hair: hair || undefined,
        build: build || undefined,
        skin_tone: skinTone || undefined,
        style_vibe: styleVibe || undefined,
        free_text: freeText || undefined,
      });
      setPersona(created);
      setStep('generating');
      const { jobId } = await apiPost<{ jobId: string }>(`/personas/${created.id}/face-candidates`);
      pollJob(jobId, (result) => {
        setCandidates(result.candidates ?? []);
        setStep('picking');
      });
    } catch (e) {
      setError(String(e));
      setStep('form');
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectAndLock() {
    if (!persona || !selectedCandidateId) return;
    setError(null);
    setBusy(true);
    try {
      await apiPost(`/personas/${persona.id}/select-candidate`, { candidateId: selectedCandidateId });
      setStep('training');
      const { jobId } = await apiPost<{ jobId: string }>(`/personas/${persona.id}/lock-identity`);
      pollJob(jobId, (result) => {
        if (result.persona) setPersona(result.persona);
        setStep('done');
      });
    } catch (e) {
      setError(String(e));
      setStep('picking');
    } finally {
      setBusy(false);
    }
  }

  if (!options) return <p className="designer-loading">Loading…</p>;

  return (
    <div className="designer-screen">
      <h1>Design your model</h1>
      {error && <p className="auth-error">{error}</p>}

      {step === 'form' && (
        <form className="designer-form" onSubmit={handleCreatePersona}>
          <label>
            Age range
            <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} required>
              {options.ageRanges.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hair
            <select value={hair} onChange={(e) => setHair(e.target.value)}>
              <option value="">No preference</option>
              {options.hair.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Build
            <select value={build} onChange={(e) => setBuild(e.target.value)}>
              <option value="">No preference</option>
              {options.build.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Skin tone
            <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)}>
              <option value="">No preference</option>
              {options.skinTone.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Style vibe
            <select value={styleVibe} onChange={(e) => setStyleVibe(e.target.value)}>
              <option value="">No preference</option>
              {options.styleVibe.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Describe her further (optional)
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={500} rows={3} />
          </label>
          <button type="submit" disabled={busy}>
            Generate 8 faces
          </button>
        </form>
      )}

      {step === 'generating' && <p className="designer-status">Generating candidate faces…</p>}

      {step === 'picking' && (
        <div className="candidate-grid">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              className={'candidate-card' + (selectedCandidateId === c.id ? ' selected' : '')}
              onClick={() => setSelectedCandidateId(c.id)}
            >
              <img src={c.imageUrl} alt="Candidate face" />
            </button>
          ))}
          <button className="designer-primary" disabled={!selectedCandidateId || busy} onClick={handleSelectAndLock}>
            Lock this identity
          </button>
        </div>
      )}

      {step === 'training' && <p className="designer-status">Training the identity LoRA — this can take a few minutes…</p>}

      {step === 'done' && (
        <div>
          <p className="designer-status">Identity locked. Outfit and background generation arrives in Phase 3.</p>
          <button onClick={onDone}>Back to dashboard</button>
        </div>
      )}
    </div>
  );
}
