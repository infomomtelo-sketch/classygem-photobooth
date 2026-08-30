export const MOTION_PRESET_IDS = [
  'slow_turn',
  'walking_toward_camera',
  'hair_in_wind',
  'subtle_idle',
  'over_shoulder_look',
] as const;

export type MotionPresetId = (typeof MOTION_PRESET_IDS)[number];

export interface MotionPreset {
  id: MotionPresetId;
  label: string;
  promptFragment: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'slow_turn', label: 'Slow Turn', promptFragment: 'slow graceful turn, subtle head and body rotation, gentle motion' },
  {
    id: 'walking_toward_camera',
    label: 'Walking Toward Camera',
    promptFragment: 'walking confidently toward the camera, natural gait, fashion runway motion',
  },
  {
    id: 'hair_in_wind',
    label: 'Hair in Wind',
    promptFragment: 'hair gently moving in the wind, subtle fabric movement, soft breeze',
  },
  {
    id: 'subtle_idle',
    label: 'Subtle Idle',
    promptFragment: 'subtle idle motion, gentle breathing, natural micro-movements, minimal motion',
  },
  {
    id: 'over_shoulder_look',
    label: 'Over-Shoulder Look',
    promptFragment: 'turning to look back over the shoulder, elegant slow motion',
  },
];

export function getMotionPreset(id: string): MotionPreset | undefined {
  return MOTION_PRESETS.find((m) => m.id === id);
}
