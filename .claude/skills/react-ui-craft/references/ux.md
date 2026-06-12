# UX & Interaction States

The difference between a demo and a product is the states nobody screenshots. A screen that only renders the happy path is unfinished. This file is the checklist for the experience *around* the data.

## Table of contents
1. The five states every data view needs
2. Loading: skeletons over spinners
3. Empty states: an invitation, not a void
4. Errors: direction, not apology
5. Optimistic & pending UI
6. Feedback & perceived performance
7. Forms UX
8. Microcopy

---

## 1. The five states

For any view that depends on data, design all of these *before* you finish:

1. **Loading** — first fetch, nothing yet.
2. **Empty** — succeeded, but zero results.
3. **Error** — failed; recoverable or not.
4. **Partial / paginated** — some data, more loading (infinite scroll, "load more").
5. **Ideal** — the populated happy path.

A quick way to not forget: write the component to take a discriminated union state, and let the type force you to handle each case.
```tsx
type Async<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "empty" }
  | { status: "ready"; data: T };
```
With TanStack Query you get `isPending`/`isError`/`data` for free — branch on them explicitly; don't render `data.map` while `data` may be undefined.

---

## 2. Loading: skeletons over spinners

- **Skeletons** (gray placeholder shapes matching the real layout) beat centered spinners for content areas: they communicate structure, reduce layout shift, and feel faster. shadcn ships a `Skeleton`.
- **Spinners** are fine for buttons, small inline actions, and indeterminate waits where layout is unknown.
- **Match the skeleton to the real content's shape** — same number of rows, same rough sizes — so the swap doesn't jump.
- **Avoid flicker:** for very fast loads, a 150–200ms delay before showing a skeleton prevents a flash. For Next.js, `loading.tsx` + `<Suspense>` give streaming skeletons at the route level.
- Don't block the *whole* page on the slowest piece. Stream/suspend sections independently so fast content paints first.

---

## 3. Empty states: an invitation, not a void

An empty list is a chance to orient and activate the user, not a blank box.
- Say plainly what would be here and **how to create the first item** — with the action right there (a button).
- Distinguish **"nothing yet"** (new user → onboarding tone, primary CTA) from **"no matches"** (a filter returned nothing → offer to clear the filter).
- One short line + one action. No giant illustrations required; clarity beats decoration.

```tsx
<EmptyState
  title="No words in this deck yet"
  description="Add your first word to start reviewing."
  action={<Button onClick={onAdd}>Add a word</Button>}
/>
```

---

## 4. Errors: direction, not apology

- **Say what happened and what to do next**, in the interface's voice. "Couldn't load your decks. Check your connection and try again." — with a **Retry** button. Not "Oops! Something went wrong 😢".
- **Match severity to placement:** a field error sits by the field; a failed action shows a toast; a failed page-load shows an inline error region with retry; a crashed subtree is caught by an **Error Boundary** so the rest of the app survives.
- **Never dump raw stack traces or API error bodies** at users (and never leak them in production — see security). Log the detail; show a human message.
- **Preserve user input on error.** A failed form submit must not wipe what they typed.

---

## 5. Optimistic & pending UI

For actions the user expects to succeed (toggling a like, adding to a list), update the UI immediately and reconcile when the server responds — it feels instant.

React 19 / Next.js:
```tsx
const [optimistic, addOptimistic] = useOptimistic(items, (state, next) => [...state, next]);
// in the action: addOptimistic(newItem); then await the real mutation
```
TanStack Query: use `onMutate` to snapshot + apply the optimistic change, `onError` to roll back, `onSettled` to invalidate.

Rules: **always handle rollback** on failure (and tell the user it reverted), and only be optimistic when failure is rare and reversible. For a payment, don't be optimistic — show real pending state.

For non-optimistic mutations, show **pending state on the control** (disabled + spinner) and keep the rest of the page interactive.

---

## 6. Feedback & perceived performance

- **Every action gets a reaction within ~100ms** — a hover state, a press state, a pending indicator. Silence feels broken.
- **Confirm success** — a toast (`sonner`), a checkmark, a state change. Don't leave the user guessing whether it worked. Keep the confirming verb consistent with the action ("Publish" → "Published").
- **Perceived speed > raw speed:** optimistic updates, skeletons, streaming, and prefetching on hover/intent make an app *feel* fast even when the network isn't.
- **Avoid layout shift (CLS):** reserve space for images (`width`/`height` or aspect-ratio) and async content so things don't jump.
- **Debounce expensive reactive work** (search-as-you-type → debounce ~300ms), but reflect intent instantly (show the typed query and a subtle loading hint immediately).

---

## 7. Forms UX

(See components.md for the RHF+Zod mechanics; this is the experience.)
- **One column, logical order, grouped sections.** Don't make people zig-zag.
- **Validate kindly:** don't error a field the user hasn't finished. Validate on blur/submit; once a field has errored, re-validate as they fix it.
- **Inline, specific errors** under the field, in plain language. Summarize at top only for long forms.
- **Show requirements up front** (password rules, formats) rather than only after failure.
- **Disable + spinner on submit**; keep input intact on failure; focus the first invalid field.
- **Autofocus** the first field on a dedicated form page; respect autofill; use correct `type`/`inputmode`/`autocomplete` so mobile keyboards and password managers work.

---

## 8. Microcopy

Words are UI. (The `frontend-design` skill covers this for marketing copy; here it's functional UI text.)
- **Name things by what the user controls**, not by the system's internals. "Notifications", not "webhook config".
- **Buttons say what they do**, as a verb: "Save changes", "Add word" — not "Submit"/"OK". Keep the verb consistent through the flow.
- **Sentence case, plain verbs, no filler.** Specific beats clever.
- **Empty states and errors give direction** (covered above). Tooltips explain, they don't decorate.
- **Be consistent:** the same concept has the same name everywhere. Inconsistent vocabulary is how users get lost.
