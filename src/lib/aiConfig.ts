// Lightweight AI helpers that don't pull in the Anthropic SDK (that loads on demand from ./ai).
import { useStore } from '../store/store';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', blurb: 'Most capable — best explanations (default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', blurb: 'Fast and very capable, lower cost' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', blurb: 'Fastest and cheapest' },
];

export function aiReady(): boolean {
  return !!useStore.getState().settings.ai.key.trim();
}

export const loadAi = () => import('./ai');
