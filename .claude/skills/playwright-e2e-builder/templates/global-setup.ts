// Runs once before the whole E2E suite (see playwright.config.ts `globalSetup`).
// Brings the temp SQLite test DB to the latest schema, then seeds a known baseline.
import { execSync } from "node:child_process";
import { seed, prisma } from "./seed";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "file:./e2e/.test.db";
  // Apply migrations to the throwaway DB (idempotent).
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  await seed();
  await prisma.$disconnect();
}
