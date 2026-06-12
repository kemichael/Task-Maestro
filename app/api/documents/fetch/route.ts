import { NextRequest } from "next/server";
import { z } from "zod";
import { extractDocumentId } from "@/lib/utils/googleDocsUrl";
import { getDocumentText } from "@/lib/clients/googleDocs";
import { errorResponse, ok } from "@/lib/http/response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({ docUrl: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { docUrl } = bodySchema.parse(await req.json());
    const documentId = extractDocumentId(docUrl);
    if (!documentId) {
      throw new ValidationError("有効な Google ドキュメントの URL ではありません");
    }
    const text = await getDocumentText(documentId);
    return ok({ documentId, text });
  } catch (error) {
    return errorResponse(error);
  }
}
