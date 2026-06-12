# Components

What separates a "smart, well-composed" component from a tangle of props and conditionals. The throughline: **components compose; they don't configure.**

## Table of contents
1. Composition over configuration
2. The container / presentational split
3. shadcn/ui — how to actually use it
4. `cn()` and variants (cva)
5. Forms done right
6. Accessibility specifics
7. What "smart" means (and what it doesn't)

---

## 1. Composition over configuration

The trap: a component grows a new prop for every variation until it's an unreadable switchboard (`<Card hasHeader hasFooter headerSize="lg" showDivider ...>`). The fix is to let consumers compose children instead.

```tsx
// Configuration (rigid, grows forever):
<Card title="Words" subtitle="N3" action={<Button/>} footer={...} />

// Composition (flexible, reads like the markup it produces):
<Card>
  <Card.Header>
    <Card.Title>Words</Card.Title>
    <Card.Description>N3</Card.Description>
    <Button className="ml-auto">Add</Button>
  </Card.Header>
  <Card.Content>{children}</Card.Content>
</Card>
```
shadcn/ui already ships components in this compound shape (`Card`, `CardHeader`, `CardContent`…). Follow it. When you build your own composite, expose the *slots* a consumer needs rather than a prop for each.

**Pass `children` to invert control.** A layout that takes `children` instead of a `content` prop lets callers put anything inside without you anticipating it — and in Next.js it lets a server component pass server-rendered children into a client wrapper.

---

## 2. Container / presentational split

Separate *getting the data* from *showing it*. The presentational component takes plain props and is trivial to reuse, preview, and test; the container wires data in.

```tsx
// presentational — no data source, no fetch, pure props
export function WordList({ words, onSelect }: { words: Word[]; onSelect: (w: Word) => void }) {
  if (words.length === 0) return <EmptyState .../>;
  return <ul>{words.map(w => <WordRow key={w.id} word={w} onClick={() => onSelect(w)} />)}</ul>;
}

// container — owns fetching/state (a server component, or a client component using useQuery)
export async function WordListContainer({ level }: { level: string }) {
  const words = await getWords(level);
  return <WordList words={words} onSelect={...} />;
}
```
Don't over-apply it — a tiny component that fetches one thing doesn't need splitting. Apply it when the presentational half is reusable or the data logic is non-trivial.

---

## 3. shadcn/ui — how to actually use it

The mental model: **these are not a dependency, they're your code.** `npx shadcn@latest add dialog` copies the source into `components/ui/`. You own it, edit it, and it never breaks on an upstream release.

- **Add only what you use.** Don't bulk-add 40 components. Each one is code you now maintain.
- **Edit the primitive to match your brand**, don't wrap it in another layer. Change `button.tsx`'s variants rather than making `BrandButton` that wraps `Button`.
- **Theme through CSS variables** (`--primary`, `--radius`, …) in your globals, set in OKLCH. One edit re-skins everything.
- **`sonner` for toasts** (the old `toast` is deprecated). Mount `<Toaster />` once at the root; call `toast(...)` anywhere.
- **`data-slot` attributes** exist on every primitive for targeted styling — use them instead of fragile descendant selectors.
- React 19: shadcn dropped `forwardRef`; `ref` is a normal prop. Don't reintroduce `forwardRef` in new components.

When you need a component shadcn doesn't have, build it *in the same style* (Radix primitive + Tailwind + `cva`) so it feels native to the set.

---

## 4. `cn()` and variants

`cn()` (clsx + tailwind-merge) merges class names and resolves Tailwind conflicts so the last wins — essential for letting consumers override:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```
Always spread an incoming `className` last: `cn("p-4 rounded-lg", className)` so callers can override.

For multi-variant components, use **`class-variance-authority` (cva)** instead of nested ternaries:
```tsx
const badge = cva("inline-flex items-center rounded-full text-xs font-medium", {
  variants: {
    tone: { neutral: "bg-muted text-foreground", success: "bg-green-100 text-green-800" },
    size: { sm: "px-2 py-0.5", md: "px-2.5 py-1" },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});
type BadgeProps = VariantProps<typeof badge> & React.ComponentProps<"span">;
export function Badge({ tone, size, className, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone, size }), className)} {...props} />;
}
```
This is how shadcn does it — readable, type-safe, no boolean prop soup.

---

## 5. Forms done right

Use **React Hook Form + Zod** (`@hookform/resolvers`) with shadcn's `Form` components. RHF keeps re-renders minimal; Zod gives one schema for both client validation and parsing.

```tsx
const schema = z.object({ email: z.string().email(), level: z.enum(["N5","N4","N3"]) });
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
```
Principles:
- **Validate on submit, re-validate on change** after the first error — not aggressive validation that yells while the user is still typing.
- **Errors next to the field**, in plain language ("Enter a valid email", not "email: invalid").
- **Disable the submit button while pending** and show a spinner *in* the button; never let a double-click double-submit.
- **Label every input** (shadcn `FormLabel` wires `htmlFor`/`id` for you). Placeholder is not a label.
- In Next.js, a **Server Action** + `useActionState` validates server-side too — never trust client validation alone (see security).

---

## 6. Accessibility specifics

Radix (under shadcn) handles focus traps, roving tabindex, and ARIA roles for dialogs/menus/etc. Your job is to not break it and to cover the rest:

- **Semantic elements first.** A clickable thing is a `<button>`; a navigation is `<nav>`; a real heading hierarchy (`h1`→`h2`, no skips). Don't `onClick` a `<div>`.
- **Keyboard:** every interactive element reachable and operable by keyboard; visible `focus-visible` ring (never `outline: none` without a replacement).
- **Names:** icon-only buttons need `aria-label`. Images need `alt` (empty `alt=""` for decorative).
- **State:** reflect loading/expanded/selected with `aria-busy`/`aria-expanded`/`aria-selected`, not just visuals.
- **Contrast:** ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI boundaries. OKLCH makes lightness easy to reason about.
- **Live regions:** announce async results (toast with `role="status"`, or `aria-live`) so screen-reader users learn a save succeeded.

---

## 7. What "smart" means

A "smart component" is **not** one stuffed with logic. It's one that:
- **Encapsulates a concern fully** — owns its data, states, and edge cases so the consumer just drops it in (`<UserMenu />` handles fetching the user, the loading skeleton, the signed-out case).
- **Has a small, honest API** — props describe intent, not implementation.
- **Degrades gracefully** — renders something sensible for empty/error/loading without the parent micromanaging.
- **Is observable but not chatty** — exposes the few callbacks a parent needs (`onSelect`), not its internals.

The dumb/smart pairing from §2 is how you get there: a smart *container* wrapping dumb, reusable *presentational* parts. Smartness lives in one place; reusability lives in the other.
