import path from "node:path";
import { defineConfig } from "@playwright/test";

// Playwright loads this config via Node, so prefer CJS-friendly primitives.
// We also assume this is executed with CWD=web (via `pnpm -C web e2e`).
const repoRoot = path.resolve(process.cwd(), "..");
const e2eVarRoot = path.join(repoRoot, "var-e2e");

const config = defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Keep the e2e run deterministic by starting with a clean, isolated var root.
    command:
      "node -e \"require('fs').rmSync(process.env.APP_VAR_ROOT,{recursive:true,force:true})\" && pnpm db:migrate && pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_VAR_ROOT: e2eVarRoot,
    },
  },
});

export = config;
