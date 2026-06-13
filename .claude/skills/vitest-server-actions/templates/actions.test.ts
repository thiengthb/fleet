// Example: testing Next.js server actions by mocking the Prisma singleton + next/cache.
// Mirrors the real shape of `todo/app/actions.ts`. Copy + adapt to the action under test.
//
// Rule: hoisted `vi.mock(...)` calls MUST come before importing the action.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

// Mock the prisma singleton (lib/db.ts exports `prisma`) and Next's cache helpers.
vi.mock("@/lib/db", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// If the action redirects: vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addTask, setEmotion } from "@/app/actions";

const db = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(db);
  vi.clearAllMocks();
});

describe("addTask", () => {
  it("trims the title, creates the task, and revalidates /", async () => {
    await addTask("  Buy milk  ", "2026-06-13");
    expect(db.task.create).toHaveBeenCalledWith({
      data: { title: "Buy milk", date: "2026-06-13" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("ignores an empty/whitespace title (inline guard)", async () => {
    await addTask("   ");
    expect(db.task.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setEmotion", () => {
  it("only scores a task that is done (spec guard)", async () => {
    // arrange the read the action performs before deciding to write
    db.task.findUnique.mockResolvedValue({ id: "t1", done: false, emotion: null } as never);
    await setEmotion("t1", "happy" as never);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("toggling the same emotion clears it", async () => {
    db.task.findUnique.mockResolvedValue({ id: "t1", done: true, emotion: "happy" } as never);
    await setEmotion("t1", "happy" as never);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { emotion: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
