import { useEffect, useState } from 'react';
import { apiGet } from '../lib/apiClient';
import type { LibraryVideo, MotionPreset } from '../types';

export function VideoLibraryPage({ onBack }: { onBack: () => void }) {
  const [videos, setVideos] = useState<LibraryVideo[] | null>(null);
  const [motionLabels, setMotionLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ videos: LibraryVideo[] }>('/videos')
      .then((r) => setVideos(r.videos))
      .catch((e) => setError(String(e)));
    apiGet<{ motionPresets: MotionPreset[] }>('/motion-presets')
      .then((r) => setMotionLabels(Object.fromEntries(r.motionPresets.map((m) => [m.id, m.label]))))
      .catch(() => {});
  }, []);

  return (
    <div className="library-screen">
      <h1>Your Library</h1>
      {error && <p className="auth-error">{error}</p>}
      {videos === null && <p className="designer-loading">Loading…</p>}
      {videos && videos.length === 0 && <p className="dashboard-note">No videos yet — animate a still to see it here.</p>}
      {videos && videos.length > 0 && (
        <div className="library-grid">
          {videos.map((v) => (
            <div key={v.id} className="library-card">
              <video src={v.videoUrl} controls playsInline />
              <div className="library-meta">
                <span>{v.personaLabel}</span>
                <span className="persona-status">{motionLabels[v.motion_preset] ?? v.motion_preset}</span>
              </div>
              <a className="library-download" href={v.videoUrl} download>
                Download MP4
              </a>
            </div>
          ))}
        </div>
      )}
      <button onClick={onBack}>Back to dashboard</button>
    </div>
  );
}
