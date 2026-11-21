# Components (AppGen) — shadcn/ui

> **Reuse-first (non-negotiable):** `@/components/ui/*` and `@/components/chat/*` are the **shared AISquared design system**. They resolve via `@/*` into the **read-only base at `/base`** — you won't see a `src/components/ui/` folder here. **Always import and use these components directly.** Do NOT rewrite, re-implement, fork, or copy them, and do NOT build wrapper components around them just to restyle — that forks the design system and makes apps drift apart. If a primitive needs adjusting, extend it via `className`/props only. Build **app-specific** composition here in this template's `src/components/`, always assembled from the shared `@/components/ui/*` primitives.

**Rules of thumb:**
- Need a table, dialog, dropdown, button, input, chart, date picker, file upload, chat message, etc.? There is already a component for it in `@/components/ui/*` — use it. Check the base directory first, before writing raw HTML or a new component.
- Never restyle a primitive by wrapping it in a look-alike. Pass `className` to the real component instead.
- One design system across every generated app: same components, same tokens, same look.

## UI Components

- **Add via CLI**: `bunx shadcn@latest add <component>`. For prompt-kit: `bunx shadcn@latest add "https://prompt-kit.com/c/<name>.json"`. Always use `bunx`, never `npx`.
- **Import**: Named exports from `@/components/ui/<name>`.
- **Styling**: Tailwind + `cn()` from `@/lib/utils`. Use CSS variables (`bg-background`, `text-foreground`, etc.) for dark mode consistency. No custom CSS files unless necessary.
- **Icons**: `lucide-react`.
- **Primitives**: Base UI (`@base-ui/react`). Do not edit or wrap the primitives in `@/components/ui/` — use them as-is and extend via `className`/props.
- **No ghost props**: Check component source for actual props. Do not invent `loading`, `asChild`, etc. unless the source has them.

## Table

Use shadcn `Table` for all tabular data:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>ID</TableHead>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((row) => (
      <TableRow key={row.id}>
        <TableCell>{row.id}</TableCell>
        <TableCell>{row.name}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Forms (`@tanstack/react-form`)

Use **`@tanstack/react-form`** only. No `react-hook-form` or `formik`.

Per-field `validators` take Zod directly via `onChange`/`onBlur`. **Do not** import `zodValidator` or pass `validatorAdapter` — older API, causes runtime errors.

```tsx
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateUserForm({ onSubmit }: { onSubmit: (v: { name: string; email: string }) => void }) {
  const form = useForm({
    defaultValues: { name: "", email: "" },
    onSubmit: async ({ value }) => onSubmit(value),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <form.Field
        name="email"
        validators={{ onChange: z.string().email("Valid email required") }}
      >
        {(f) => (
          <div>
            <Input
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
            {f.state.meta.errors?.[0] && (
              <p className="text-destructive text-sm">{f.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
```

### Gotchas

- **Select null**: `@base-ui/react` Select does not accept `null` as `value`. Use `""` (empty string) for "nothing selected" and coerce on submit.
- **`asChild`**: Not every shadcn/Base UI component supports it. Check `src/components/ui/<name>.tsx` for `Slot`/`asChild` in props before using. If absent, wrap with your own element instead.

## Layout — single-page (default) vs multi-page

Every app starts **single-page** using **`AppShell`** (wired in `src/routes/_protected.tsx`): a minimal padded container with **no sidebar and no header**. Keep it for single-page apps (a dashboard, a one-screen tool) — a nav bar is pointless with one page.

**The moment the app needs a second page, it is multi-page — make the full switch in ONE step.** Triggers: the user says "add a page", "add navigation", "make it multi-page", asks for another screen / section / tab, or describes multiple distinct views. Do **not** just add the page and wait for a separate "add navigation" request — *adding a second page is itself the request to go multi-page*. In the same change:

1. In `src/routes/_protected.tsx`, swap `<AppShell>` for `<AppLayout>` (import from `@/components/layout/app-layout`). This adds the sidebar + header.
2. Create each page: `src/routes/<name>.tsx` with `createFileRoute`.
3. Register **every** page (the existing one *and* the new one) in the `routes` array in `src/components/layout/index.ts` (`title`, `url`, `icon` from `lucide-react`). The sidebar links and breadcrumb read from this — **a page is unreachable until it is registered here.**

- **Branding**: import `APP_NAME`/`APP_DESCRIPTION` from `@/lib/constants`. Never hardcode.
- **Flush layout**: wrap a route's root element with `data-flush` to remove shell padding (`p-0`) for full-bleed pages. Works in both `AppShell` and `AppLayout`.


## Chat Assistant

```tsx
<ChatAssistant workflowId={id} />
```

One component, one required prop. Handles messages, sessions, history, Markdown, typing indicator automatically.

| Prop | Type | Default | Description |
|---|---|---|---|
| `workflowId` | `string` | **required** | Workflow to connect to |
| `name` | `string?` | workflow `card_title` → `"Assistant"` | Header title |
| `assistantName` | `string?` | workflow `responder_name` → `name` | Per-message label |
| `fullPage` | `boolean?` | `false` | Edge-to-edge, no border |
| `emptyMessage` | `string?` | workflow `welcome_message` → default | Empty state text |

- **No `workflowId`?** Ask the user — never guess or hardcode.
- **Full-page chat**: `<div data-flush className="h-full"><ChatAssistant workflowId={id} fullPage /></div>`

Chat building blocks (import via `@/components/chat/*`):
- **`ChatAssistant`** (template) — platform-connected chat. Required prop `workflowId`; wires the workflow + session hooks and renders the shared `ChatPanel`. Also takes optional `name`, `assistantName`, `fullPage`, `emptyMessage`, `notReadyMessage`.
- **`ChatPanel`** (base, shared) — the presentational chat surface: header, history sheet, sticky message list, auto-resizing composer (built from prompt-kit `PromptInput` + `ChatContainer`). Prop-driven; `ChatAssistant` is its wiring wrapper. Use directly only for chat UI without the platform workflow.
- **`MessageBubble`** / **`ChatMarkdown`** (base, shared) — a single message row and the Markdown renderer. Composed by `ChatPanel`; import directly if you need them standalone.

Prompt-kit chat-UI primitives in `src/components/ui/` — reusable building blocks for
assistant UIs. Reach for these instead of hand-rolling chat scaffolding:

- **Streaming / rendering:** `markdown`, `code-block`, `response-stream` (typewriter/fade streaming text), `text-shimmer` (shimmering placeholder text), `jsx-preview` (render streamed JSX live)
- **Agent reasoning:** `reasoning` (collapsible thinking block), `chain-of-thought` (multi-step reasoning trace), `thinking-bar`, `steps` (collapsible step list)
- **Tool calls:** `tool` — renders a tool invocation with input/output/error states, collapsible. Prefer this for any tool-calling UI.
- **Citations / media:** `source` (hover-card citation chip), `image`
- **Prompt input:** `prompt-input` (auto-resizing input + action buttons), `prompt-suggestion`
- **Message chrome:** `chat-container`, `message`, `message-scroller`, `bubble`, `scroll-button`, `loader`, `system-message` (action/error/warning banner), `feedback-bar`

## Design quality — avoid AI "slop"

Generated UIs drift toward generic defaults. Actively counter these — it's the difference between "obviously AI" and considered:

**Use the design system, not ad-hoc values.** Style with tokens (`bg-card`, `text-muted-foreground`, `border-border`, `ring-foreground/10`, the spacing scale) — never hardcoded hex, `#000`, or one-off pixel values. Stick to one neutral family; don't mix warm and cool grays in the same app.

**Color restraint.** One accent max, and it's the theme's `primary`. Avoid the tell-tale "AI" look: purple/blue gradient glows, neon outer shadows, oversaturated fills, gradient-filled headings. When a shadow implies elevation keep it soft and tinted to the surface — most groupings need only `border` / `divide-y` / whitespace, not a card.

**Typography.** Use the system font (Google Sans Flex) already wired into the tokens — do not import Inter or add ad-hoc font links. Control hierarchy with weight and color, not just size; headings shouldn't scream. Cap body copy around `max-w-[65ch]`.

**Layout variety.** Skip the reflexive centered-hero + three-equal-cards row. Prefer asymmetry: split content/asset, left-aligned headers over centered data, varied column spans. Build structure with CSS Grid, not flex percentage math (`w-[calc(33%-1rem)]`). For full-height sections use `min-h-[100dvh]`, never `h-screen` (prevents mobile viewport jump).

**Every state, not just the happy path.** Ship empty, loading, and error states for any data view. Loading = `Skeleton` shapes that match the real layout, not a lone spinner. Empty states say how to populate. Errors report inline.

**Realistic content.** No `John Doe`, `Acme`, `Nexus`, `99.99%`, `123-4567`. Use believable, varied names and organic numbers (`47.2%`, `$18,240`). Trade filler adjectives ("Seamless", "Elevate", "Next-Gen") for concrete verbs. Never use emoji as UI — use `lucide-react` icons. For placeholder images use `https://picsum.photos/seed/<seed>/<w>/<h>`, not Unsplash hotlinks.

**Motion, sparingly.** Prefer CSS transitions on `transform` / `opacity` (the design system already animates most primitives). Don't pull in heavy animation libraries or perpetual/looping motion unless the app genuinely calls for it.

**Self-review before you finish.** Do a quick QA pass on new or changed pages:
- **Contrast & dark mode:** text meets ~4.5:1 and the page works in both themes (you used tokens — verify nothing hardcoded slipped in).
- **Keyboard & focus:** every interactive element is Tab-reachable with a visible focus ring; dialogs/menus trap focus.
- **Touch targets:** interactive controls are ~40px or larger.
- **Hierarchy:** one clear primary action per view; consistent spacing/radii; headings in order.
- **Charts:** series use the `--chart-*` tokens, axes/legends are labeled, and there's a loading + empty state.

If the `accessibility-review`, `design-critique`, or `dataviz` skills are available in your environment, run them on new pages — they automate these checks and catch contrast, keyboard, and chart-color issues.

## Component Categories (reference)

**Layout:** card, page-header, separator, tabs, accordion, collapsible, sheet, sidebar, resizable, aspect-ratio, item, marker
**Forms:** button, button-group, input, input-group, input-otp, textarea, select, native-select, checkbox, radio-group, switch, slider, calendar, date-picker, field, label, toggle, toggle-group, combobox, file-upload
**Feedback:** alert, alert-dialog, toast (sonner), skeleton, progress, spinner, loader, empty
**Overlays:** dialog, drawer, popover, tooltip, dropdown-menu, context-menu, hover-card, menubar
**Data:** table, data-table, stat-card, badge, avatar, chart, attachment
**Navigation:** breadcrumb, navigation-menu, pagination
**Chat / prompt-kit:** chat-container, message, message-scroller, bubble, markdown, code-block, scroll-button, loader, response-stream, text-shimmer, jsx-preview, reasoning, chain-of-thought, thinking-bar, steps, tool, source, image, prompt-input, prompt-suggestion, system-message, feedback-bar
**Other:** command (cmdk), carousel, scroll-area, direction, kbd

> New in this design-system update — `attachment`, `file-upload` (+ `use-file-upload` hook in `@/hooks`), `message`, `message-scroller`, `bubble`, `data-table` (TanStack Table), `date-picker`, `marker`. Chart uses **Recharts v3**. New prompt-kit chat components — `reasoning`, `chain-of-thought`, `tool` (tool-call UI), `steps`, `source`, `response-stream`, `prompt-input`, `prompt-suggestion`, `system-message`, `image`, `text-shimmer`, `thinking-bar`, `feedback-bar`, `jsx-preview`. Use these instead of hand-rolling equivalents.
