// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://curtdalaba.com",
  // Every page is per-user and behind a login, so nothing is prerendered.
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  // Auth state lives in Supabase cookies; Astro sessions (and their KV binding) aren't needed.
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
