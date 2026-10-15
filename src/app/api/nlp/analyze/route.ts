import { handleJsonRoute } from "@/lib/api-utils";
import { parseNlpRequest } from "@/lib/validation";
import { analyzeText } from "@/lib/nlp/nlp-service";

export const dynamic = "force-dynamic";

/** POST /api/nlp/analyze  { text, operations[] } -> tokens + only the requested outputs */
export async function POST(request: Request) {
  return handleJsonRoute(request, (body) => {
    const { text, operations } = parseNlpRequest(body);
    return analyzeText(text, operations);
  });
}
