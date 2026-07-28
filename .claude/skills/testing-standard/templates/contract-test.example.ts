/**
 * Consumer-driven contract test — template (fixtures-first, NO Pact broker).
 *
 * Standard: platform/11-testing-standard.md §4. Use this for a cross-repo HTTP seam
 * (one repo calling another's API: todo↔core, web↔core, MCP). Goal: the two repos can't
 * silently drift apart on the shape of a response — a provider change that breaks the
 * consumer's expectation fails CI, not production.
 *
 * The CONTRACT is a Zod schema (the platform already parses boundaries with Zod). It is the
 * single shared source of truth for the seam. Two halves test against it:
 *   1. CONSUMER side  — the consumer handles a fixture that satisfies the contract.
 *   2. PROVIDER side  — the provider's REAL response satisfies the contract.
 *
 * Fixtures-first: the contract + fixture live in the CONSUMER repo. Share the contract to the
 * provider by copy-in (small) until ≥2 independent teams own the seam — then graduate to a
 * Pact broker (deferred, standard §4). Keep the contract MINIMAL: only the fields the consumer
 * actually reads (consumer-driven), not the provider's whole payload.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── The contract: ONLY the fields THIS consumer depends on ───────────────────────────────
// Provider may return more; the consumer must not break if it does. Snake_case = API field convention.
export const userProfileContract = z.object({
  id: z.string(),
  email: z.string().email(),
  display_name: z.string(),
  created_at: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileContract>;

// A fixture that SATISFIES the contract — used to mock the provider in consumer tests.
const fixture: UserProfile = {
  id: 'usr_123',
  email: 'a@b.com',
  display_name: 'Ada',
  created_at: '2026-06-14T00:00:00.000Z',
};

// ── 1. CONSUMER side ─────────────────────────────────────────────────────────────────────
// The consumer's code parses/handles a response matching the contract. Mock fetch with the fixture.
describe('contract (consumer): GET /api/user/:id', () => {
  it('parses a response that satisfies the contract', () => {
    const parsed = userProfileContract.safeParse(fixture);
    expect(parsed.success).toBe(true);
  });

  it('rejects a response missing a depended-on field (guards against silent drift)', () => {
    const { email, ...broken } = fixture;
    expect(userProfileContract.safeParse(broken).success).toBe(false);
  });
});

// ── 2. PROVIDER side ─────────────────────────────────────────────────────────────────────
// Runs in the PROVIDER repo's CI against a real (or test-DB) response. Skipped unless the
// provider base URL is configured, so the consumer suite stays hermetic.
const PROVIDER_URL = process.env.PROVIDER_BASE_URL;
describe.skipIf(!PROVIDER_URL)('contract (provider): real response honours the contract', () => {
  it('GET /api/user/:id returns a payload satisfying the contract', async () => {
    const res = await fetch(`${PROVIDER_URL}/api/user/usr_123`, {
      headers: { authorization: `Bearer ${process.env.CORE_SERVICE_TOKEN ?? ''}` },
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    const parsed = userProfileContract.safeParse(body);
    if (!parsed.success) throw new Error(`Provider broke the contract: ${parsed.error}`);
    expect(parsed.success).toBe(true);
  });
});
