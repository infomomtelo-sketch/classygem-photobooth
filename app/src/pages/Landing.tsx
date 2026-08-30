import { useEffect, useState } from 'react';
import { apiGet } from '../lib/apiClient';

interface CreditPackOption {
  id: string;
  label: string;
  credits: number;
  priceLabel: string;
}

const STEPS = [
  {
    title: 'Design',
    body: 'Pick her age, hair, build, skin tone, and style — or describe her in your own words. Eight candidate faces come back for you to choose from.',
  },
  {
    title: 'Lock the Identity',
    body: 'The face you choose is trained into a private model of her own, so every future render is unmistakably her.',
  },
  {
    title: 'Style the Frame',
    body: 'Studio seamless, a rooftop at golden hour, a runway — pick a backdrop or write your own, add an outfit, and render at full resolution.',
  },
  {
    title: 'Upscale',
    body: 'Every still is sharpened before it ever reaches the camera — quality here carries through to the finished video.',
  },
  {
    title: 'Animate',
    body: 'A slow turn, a walk toward camera, hair in the wind — choose a motion and watch a five-second vertical video come to life.',
  },
  {
    title: 'Library',
    body: "Every video lives in your library, ready to download and post wherever you like. We don't schedule or post anything for you.",
  },
];

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [packs, setPacks] = useState<CreditPackOption[]>([]);

  useEffect(() => {
    apiGet<{ creditPacks: CreditPackOption[] }>('/credit-packs')
      .then((r) => setPacks(r.creditPacks))
      .catch(() => {});
  }, []);

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-masthead">Classygem</div>
        <h1 className="landing-headline">
          A fashion video studio
          <br />
          for a face that doesn't exist.
        </h1>
        <p className="landing-sub">
          Design a synthetic model once. Generate her in any outfit, any backdrop, in motion — then download and post
          it yourself.
        </p>
        <button className="landing-cta" onClick={onGetStarted}>
          Design Your Model
        </button>
      </header>

      <section className="landing-steps">
        <h2 className="landing-kicker">The Process</h2>
        <ol className="landing-step-list">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="landing-step-no">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-trust">
        <h2 className="landing-kicker">No Real People. Ever.</h2>
        <p>
          Every model on Classygem is generated from text, not a photo — there is no upload, and there never was a
          person to upload. Every prompt and every render passes through content guardrails before it reaches you,
          and every persona is built to read as an adult. This is a studio for imagined people, not real ones.
        </p>
      </section>

      {packs.length > 0 && (
        <section className="landing-pricing">
          <h2 className="landing-kicker">Credits</h2>
          <div className="landing-pack-row">
            {packs.map((p) => (
              <div key={p.id} className="landing-pack">
                <div className="landing-pack-price">{p.priceLabel}</div>
                <div className="landing-pack-label">{p.label}</div>
                <div className="landing-pack-credits">{p.credits.toLocaleString()} credits</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="landing-footer">
        <button className="landing-cta" onClick={onGetStarted}>
          Design Your Model
        </button>
        <p className="landing-footnote">Classygem — an AI fashion video studio.</p>
      </footer>
    </div>
  );
}
