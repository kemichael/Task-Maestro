import { detectMeetingDocs } from "@/lib/services/meetingService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const meetings = await detectMeetingDocs();
    return ok({ meetings });
  } catch (error) {
    return errorResponse(error);
  }
}
