import { NextRequest } from "next/server";
import { z } from "zod";
import { extractCandidatesFromText } from "@/lib/services/aiExtractionService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1),
  sourceRef: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { text, sourceRef } = bodySchema.parse(await req.json());
    const candidates = await extractCandidatesFromText({
      text,
      sourceMeta: { kind: "document", ref: sourceRef },
    });
    return ok({ candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
