import { ApiError, ValidationError } from "@/lib/errors";

const MAX_BODY_CHARS = 200_000;

/** Standard error body: { error: { code, message } } */
export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Read and parse a JSON request body, or throw a 400 ValidationError. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new ValidationError("Request body is too large.");
  if (text.trim().length === 0) throw new ValidationError("Request body must be JSON.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body is not valid JSON.");
  }
}

/**
 * Run an API handler and convert failures into JSON errors.
 *  • ApiError (validation, missing NLP resource)  -> its own status + message
 *  • anything else -> generic 500; details are logged on the server only
 */
export async function handleJsonRoute(
  request: Request,
  handler: (body: unknown) => unknown | Promise<unknown>,
): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const result = await handler(body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.status, error.code, error.message);
    console.error("[ai-quest] Unexpected API error:", error);
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong on the server. Please try again.");
  }
}
