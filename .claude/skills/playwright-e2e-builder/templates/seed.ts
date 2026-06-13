// Deterministic test data, seeded directly through Prisma (the apps use server actions,
// NOT a REST CRUD API — so there is nothing to POST to). Adapt the model names to the
// project's schema. Run standalone: `DATABASE_URL=file:./e2e/.test.db tsx e2e/seed.ts`
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Wipe mutable tables so each run starts clean. Order matters for FK constraints. */
export async function reset() {
  await prisma.task.deleteMany();
}

/** Insert a known baseline. Return ids the tests rely on. */
export async function seed() {
  await reset();
  const done = await prisma.task.create({
    data: { title: "Seeded done task", date: "2026-06-13", done: true, completedAt: new Date() },
  });
  const open = await prisma.task.create({
    data: { title: "Seeded open task", date: "2026-06-13", done: false },
  });
  return { doneId: done.id, openId: open.id };
}

// Allow `tsx e2e/seed.ts` to run it directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => console.log("seeded"))
    .finally(() => prisma.$disconnect());
}

export { prisma };
