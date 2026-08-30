// Thin wrapper around fal.ai's queue REST API. Deliberately generic --
// model-specific input/output shapes live in falRecipes.ts, not here.
const FAL_QUEUE_BASE = 'https://queue.fal.run';

export interface FalSubmitResponse {
  request_id: string;
}

export interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  queue_position?: number;
}

export async function submitFalJob(falKey: string, modelId: string, input: object): Promise<FalSubmitResponse> {
  const res = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`fal.ai submit failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function getFalStatus(falKey: string, modelId: string, requestId: string): Promise<FalStatusResponse> {
  const res = await fetch(`${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${falKey}` },
  });
  if (!res.ok) {
    throw new Error(`fal.ai status check failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function getFalResult<T = unknown>(falKey: string, modelId: string, requestId: string): Promise<T> {
  const res = await fetch(`${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`, {
    headers: { Authorization: `Key ${falKey}` },
  });
  if (!res.ok) {
    throw new Error(`fal.ai result fetch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
