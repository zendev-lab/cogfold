import { fail } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { requirePersonalUser } from "$lib/server/personal-auth";
import {
  personalConversationSnapshot,
  requirePersonalConversation,
  submitPersonalConversation,
} from "$lib/server/personal-sessions";
import type { Actions, PageServerLoad } from "./$types";
export const load: PageServerLoad = async ({ locals, params }) => {
  const userId = requirePersonalUser(locals.sessionToken);
  requirePersonalConversation(userId, params.sessionId);
  try {
    return {
      snapshot: await personalConversationSnapshot(userId, params.sessionId),
      submissionId: randomUUID(),
    };
  } catch {
    return { snapshot: null, submissionId: randomUUID() };
  }
};
export const actions: Actions = {
  default: async ({ locals, params, request }) => {
    const userId = requirePersonalUser(locals.sessionToken);
    const form = await request.formData();
    const prompt = String(form.get("prompt") ?? "").trim();
    const submissionId = String(form.get("submissionId") ?? "");
    if (!prompt || prompt.length > 32_000 || !/^[a-f0-9-]{36}$/u.test(submissionId))
      return fail(400, { failed: true });
    try {
      await submitPersonalConversation(userId, params.sessionId, prompt, submissionId);
      return { sent: true };
    } catch {
      return fail(503, { failed: true });
    }
  },
};
