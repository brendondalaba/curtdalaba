/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    supabase: import("@/lib/supabase").SupabaseServerClient;
    user: { id: string; email: string } | null;
    isAdmin: boolean;
  }
}
