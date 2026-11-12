// Browser-side fetch helper that unwraps the { success, data | error } envelope.
export async function api(path, { method = 'GET', body, formData } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return json.data;
}
