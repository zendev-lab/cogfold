import { error } from "@sveltejs/kit";
import { getCurrentHubSession } from "./auth.ts";
import { getDatabase } from "./db.ts";
import {
  authenticatePersonalBinding,
  PersonalAccessError,
} from "@zendev-lab/spark-hub-coordination/personal";

export function requirePersonalUser(sessionToken: string | null) {
  const session = getCurrentHubSession(getDatabase(), sessionToken);
  if (!session) error(401, "A Hub user session is required for personal data.");
  return session.userId;
}

export function personalError(caught: unknown): never {
  if (caught instanceof PersonalAccessError) {
    error(caught.code === "unauthorized" ? 401 : caught.code === "conflict" ? 409 : 403, {
      message: caught.message,
      code: caught.code,
    });
  }
  if (caught instanceof Error && "code" in caught) {
    if (caught.code === "conflict") error(409, { message: caught.message, code: "conflict" });
    if (caught.code === "not_found") error(404, { message: caught.message, code: "not_found" });
    if (caught.code === "invalid_input" || caught.code === "invalid_relation")
      error(422, { message: caught.message, code: String(caught.code) });
  }
  if (caught instanceof Error && caught.name === "ZodError")
    error(400, { message: "Personal tool input is invalid.", code: "invalid_input" });
  throw caught;
}

export function requirePersonalDevice(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    error(401, "Personal device authorization is required.");
  try {
    return authenticatePersonalBinding(getDatabase(), authorization.slice(7));
  } catch (caught) {
    personalError(caught);
  }
}
