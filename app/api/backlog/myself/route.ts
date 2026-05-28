import { getMyself } from "@/lib/clients/backlog";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getMyself();
    return ok({
      userId: user.id,
      name: user.name,
      loginId: user.userId,
      mailAddress: user.mailAddress,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
