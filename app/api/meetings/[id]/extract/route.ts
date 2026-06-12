import { NextRequest } from "next/server";
import { extractMeetingCandidates } from "@/lib/services/meetingService";
import { errorResponse, ok } from "@/lib/http/response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meetingId = Number(id);
    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      throw new ValidationError("議事録 ID が不正です");
    }
    const candidates = await extractMeetingCandidates(meetingId);
    return ok({ candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
