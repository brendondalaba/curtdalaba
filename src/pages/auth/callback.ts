import type { EmailOtpType } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { safeRedirectPath } from "@/lib/auth";

const OTP_TYPES = new Set<EmailOtpType>(["recovery", "email", "magiclink"]);

/** Where Supabase email links land (password reset). Signs the member in, then moves on. */
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const next = safeRedirectPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect(next, 303);
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await locals.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return redirect(next, 303);
  }

  return redirect("/login?link=expired", 303);
};
