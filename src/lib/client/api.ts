/** Browser-side helper for calling the AI Quest JSON API with friendly error messages. */

export class ClientApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientApiError("Could not reach the AI Quest server. Check that the app is still running and try again.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // non-JSON body; handled below
  }

  if (!response.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ClientApiError(
      err?.message ?? `The server returned an unexpected response (HTTP ${response.status}).`,
      response.status,
      err?.code,
    );
  }
  if (data === null) throw new ClientApiError("The server returned an empty response.");
  return data as T;
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
