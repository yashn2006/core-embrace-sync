import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const VAPID_PUBLIC_KEY_CONST =
  "BEBlIct0jXDFx2q7QhUdJ8uqXeDQleMgx3Br1uYA5JzbY4LruPyjEKzSj5i9C8qaq_25REJOXH0rjemcuAaGblY";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: VAPID_PUBLIC_KEY_CONST };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) => {
    if (!data.endpoint || !data.p256dh || !data.auth) throw new Error("Invalid subscription");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Upsert by endpoint (unique per device)
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          org_id: "00000000-0000-0000-0000-000000000001",
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });