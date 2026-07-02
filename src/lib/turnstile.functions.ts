import { createServerFn } from "@tanstack/react-start";

export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data || typeof data.token !== "string" || data.token.length < 10) {
      throw new Error("Missing verification token");
    }
    return { token: data.token };
  })
  .handler(async ({ data }) => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      // Fail-open only in dev with no secret configured
      return { success: true, skipped: true as const };
    }
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", data.token);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!json.success) {
      throw new Error("Human verification failed. Please try again.");
    }
    return { success: true as const };
  });