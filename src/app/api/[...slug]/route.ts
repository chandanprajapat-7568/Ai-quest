import { jsonError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/** Unknown /api/* paths return a JSON 404 instead of an HTML page. */
const notFound = () => jsonError(404, "NOT_FOUND", "This API endpoint does not exist.");

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
