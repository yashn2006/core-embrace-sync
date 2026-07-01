import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Owner-only: create a new user (rep or owner) with email + password.
 * Auto-confirms email so the user can log in immediately.
 */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; name: string; role: "owner" | "rep" }) => {
    if (!data.email || !data.password || !data.name) throw new Error("Missing fields");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (data.role !== "owner" && data.role !== "rep") throw new Error("Invalid role");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Authorize: only owner can create users
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden: owner only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");

    const userId = created.user.id;

    // Profile is auto-created by handle_new_user trigger; upsert to ensure name.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, org_id: DEFAULT_ORG_ID, name: data.name, email: data.email }, { onConflict: "id" });

    // Grant role (trigger inserts 'rep' by default; upgrade to owner if requested)
    if (data.role === "owner") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, org_id: DEFAULT_ORG_ID, role: "owner" }, { onConflict: "user_id,role" });
    }

    return { id: userId, email: data.email, name: data.name, role: data.role };
  });

export const adminDeactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: "owner" | "rep" }) => data)
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove existing rows then insert new one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, org_id: DEFAULT_ORG_ID, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });