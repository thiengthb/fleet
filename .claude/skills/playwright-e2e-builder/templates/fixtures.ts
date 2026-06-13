// Custom fixtures: page objects + a Prisma-backed `db` seeding helper.
// NOTE: no REST ApiClient/Bearer token — data is seeded through Prisma (see seed.ts).
import { test as base, expect } from "@playwright/test";
import { TodayPage } from "./pages/today-page";
import { reset, seed, prisma } from "./seed";

type Fixtures = {
  todayPage: TodayPage;
  db: { reset: typeof reset; seed: typeof seed; prisma: typeof prisma };
};

export const test = base.extend<Fixtures>({
  todayPage: async ({ page }, use) => {
    await use(new TodayPage(page));
  },

  // Per-test data control. Call db.reset()/db.seed() in the test or a beforeEach.
  db: async ({}, use) => {
    await use({ reset, seed, prisma });
  },
});

export { expect };
