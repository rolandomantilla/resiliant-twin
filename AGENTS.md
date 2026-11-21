# AppGen Template

React app in a coding sandbox. Generated code is shown to end users as a live application.

## Critical Rules

- **Audience is non-technical.** Describe changes in terms of what users see. Implement everything — don't explain the plan.
- **OpenCode runs in API mode** — produce complete, self-contained responses. That means don't trail off into a plan you never carry out; it does not mean you cannot ask. See "Asking the builder".
- **Ask for information, never for permission.** Use the `question` tool when the next step depends on something only the builder knows. Never use it to confirm work you were already asked to do.
- **Do exactly what is asked — no more.** Match scope precisely.
- **Load `frontend-design` skill ONLY for UI pages** — skip for DB/backend tasks.
- **Never start a dev server** — one is already running on port 5173.
- **Do not run `bun run build` for routine checks.** HMR, LSP diagnostics and the dev server are the per-edit check. When server-only code leaks into the client, the dev server fails with `[import-protection] Import denied in client environment` and names the file and line: fix it right away (see the `createServerOnlyFn` rule). Run `bun run build` only when the user asks for a publish check or a publish failed.
- **Keep `importProtection` in `vite.config.ts`, and keep `tanstackStart()` before `tsconfigPaths()`.** That is what makes the dev server catch client leaks. Never remove or loosen it to make an error go away.
- **Server-only modules go under `src/server/`.** Client code (components, routes, code outside handlers) may not import anything there except `@/server/auth` and `@/server/protectedServerFn`; the dev server blocks the rest. Put server functions the client calls in `src/services/`.
- **Do not run full `bun run check` after every change.** Format only the files you touched: `bunx biome format --write <files>` right after writing them.
- **Batch independent steps.** Run unrelated reads and commands together in one round, not one at a time.
- **Prefer small targeted edits** over rewriting whole files.
- **Never re-read a file already in context** — it has not changed unless you changed it. This includes a file you just created or edited this turn: trust the `Write`/`Edit` success, don't re-read to verify.
- **No throwaway bash.** Never run a command whose output you discard or that only passes time (`sleep`, re-`cat` to `/dev/null`). To check for errors rely on HMR/LSP, or read the one file you changed.
- **After 3 failed attempts at the same fix, stop and reassess** the approach instead of retrying variations.
- **Playwright results can lie.** If a playwright tool's output contains an error message, treat the step as failed regardless of the reported status; on environment/browser errors do not retry, skip browser verification and rely on the dev server + LSP.
- **Do not run `bun install`** — dependencies are pre-installed.
- **Package manager is bun.** Use `bun run`, `bunx`. Replace `npx` with `bunx`.
- **Import `createServerFn` from `@tanstack/react-start`** — NOT `@tanstack/start`. Build error otherwise.
- **Use `.inputValidator()`, never `.validator()`** — runtime crash.
- **Use `method: "POST"` for all mutations** — no DELETE support.
- **Never use `pgEnum`** — use `text("col").$type<"a" | "b">()` instead.
- **Never run `drizzle-kit push`** — hangs. Use `bun run db:generate` + `bun run db:migrate`.
- **Always use Neon database for data storage.** Never in-memory arrays, `useState<Array>`, `Map`, `localStorage`.
- **Auth is platform-only.** Do not build standalone auth (no users table, no bcryptjs, no password hashing).
- **Never hand-roll roles or permissions** — the prebaked RBAC in base covers it. If an app ends up with any access control of its own anyway, call `agentic_coding_set_rbac_enabled`. See "Roles and permissions".
- **Do not change the font (Google Sans Flex).**
- **Dynamic-import `@/lib/db` and `@/env/server` inside handlers** — a module-level import breaks the client bundle.
- **Wrap server-only helpers in `createServerOnlyFn`** (from `@tanstack/react-start`). Any function outside a `createServerFn` handler that imports `@/lib/db`, `@/env/server`, `@/server/*` helpers (such as `requireAppAccess`), `drizzle-orm` or `@tanstack/react-start/server` must be `const helper = createServerOnlyFn(async (...) => { ... })`. A plain `async function` helper stays in the client bundle and publish fails. Keep the `requireAppAccess("read"|"write")` call in each handler, not inside the helper.
- **Raw `integer()` needs `.references()`** to be a real foreign key.
- **`@tabler/icons-react` → Vite 500.** Package is not installed. Import icons from `lucide-react` (e.g. `Search`, not `IconSearch`).

## Asking the builder

You can ask. The `question` tool posts a short wizard into the chat and waits for
the answer, so reach for it when the next step turns on something only the
builder knows.

| Situation | What to do |
|---|---|
| Information you cannot infer — which roles they need, which of two readings of a vague request they meant | Ask |
| Something you can work out from the app, the schema, or the conversation so far | Work it out; don't spend their attention |
| Work they already asked for | Do it. Never ask for permission or confirmation |

Put every question you have into **one** call rather than coming back three
times. Offer concrete options, leave the free-text row available so they are not
trapped in your list, and word them for a non-technical reader.

If the tool is genuinely unavailable, say plainly what you need and stop. Do not
quietly guess and build on the guess.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19, SSR) |
| Language | TypeScript (strict) |
| Bundler | Vite 7 |
| Routing | TanStack Router (file-based) |
| UI | shadcn/ui, Tailwind CSS v4 |
| Icons | Lucide (`lucide-react`) |
| Forms | TanStack Form, Zod |
| Charts | Recharts |
| DB | Drizzle ORM + Neon HTTP (`@neondatabase/serverless`) |
| State | None — no app-level stores |
| Linting | Biome |

## Shared base — reuse first, don't recreate

This template is a thin overlay on a **shared base**. At runtime the base is baked **read-only** at `/base`; your imports reach it through the `@/*` alias, which resolves to **both** your local `./src/*` **and** `../../base/src/*`. Many `@/…` imports therefore resolve to base files that are **not** in this folder — reuse them, don't reimplement, and never try to edit base files.

**Reuse from base** (`@/…` resolves into `/base`, read-only):

| Need | Import |
|---|---|
| UI primitives (shadcn) | `@/components/ui/*` |
| Class merge / utils | `@/lib/utils` (`cn`) |
| DB access | `@/lib/db` (`getDb`) |
| Platform API fetch | `@/lib/apiFetch` |
| Server-only: auth, cookies, platform, S3, env | `@/server/*`, `@/server/s3/client`, `@/env/server` |
| Platform services | `@/services/connectors`, `@/services/workflows`, `@/services/capabilitiesService`, `@/services/common` |
| tRPC core (init / context / client) | `@/integrations/trpc` |

**Reuse what already ships in THIS template's `src/`** (platform infra — reuse, keep shared behavior intact):

- Platform hooks: `@/hooks/useAuth`, `useConnectors`, `useExecuteModel`, `useWorkflows`, `useCapabilities`, `useChatAssistant`, `usePaginatedQuerySource`, `useDataAppSessions`, `useAPIMutation`, `useQueryWrapper`
- Chat UI: `@/components/chat/*` (`<ChatAssistant/>`)
- tRPC router composition: `src/integrations/trpc/router.ts`
- Branding: `@/lib/constants` (`APP_NAME`)

**Build CUSTOM here** (this template's `src/` — where your app lives):

- Pages/routes under `src/routes/`
- App-specific components in `src/components/`
- Domain hooks (`src/hooks/use<Domain>.ts`) and services (`src/services/db/<domain>Service.ts`)
- DB schema + migrations (`src/server/db/schema.ts`, `src/server/db/migrations/`)

**UI components available** (import `@/components/ui/<name>`; this is the full set — do not spend rounds listing the directory): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, chat-container, checkbox, code-block, collapsible, combobox, command, context-menu, dialog, direction, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, loader, markdown, menubar, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, scroll-button, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip. Hooks: `use-mobile`, `useErrorToast`.

**Deep-dive base docs** — read on demand; these are **not** auto-loaded (they live outside this folder at `/base`):

- `/base/src/server/AGENTS.md` — auth, cookies, platform API, **S3 (AWS SDK v3)**
- `/base/src/services/AGENTS.md` — `createServerFn` services + DB CRUD patterns
- `/base/src/server/db/AGENTS.md` — Drizzle schema + migration workflow
- `/base/src/server/trpc/AGENTS.md` + `/base/src/integrations/trpc/AGENTS.md` — tRPC routers + React usage
- `/base/src/lib/AGENTS.md` — shared utilities

## Server Functions

**All server calls use `createServerFn`** from `@tanstack/react-start`. Dynamic-import dependencies inside handlers. **Protect non-public handlers**: call `await requireAppAccess("read")` or `await requireAppAccess("write")` (from `@/server/protectedServerFn`) at the top, `"write"` for anything that changes data. Never the `protectedServerFn` wrapper for handlers importing `@/lib/db` or `@/server/s3/client` (it breaks the client build; see `/base/src/server/AGENTS.md`):

```tsx
export const listItems = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAppAccess } = await import("@/server/protectedServerFn");
  await requireAppAccess("read");
  const { getDb } = await import("@/lib/db");
  const { items } = await import("@/server/db/schema");
  const { desc } = await import("drizzle-orm");
  const db = await getDb();
  return db.select().from(items).orderBy(desc(items.createdAt));
});

export const createItem = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const { items } = await import("@/server/db/schema");
    const db = await getDb();
    const [row] = await db.insert(items).values(data).returning();
    return row;
  });

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const { items } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    await db.delete(items).where(eq(items.id, id));
  });
```

## Application Layout

- **`__root.tsx`** — auth guard in `beforeLoad`. Never remove it.
- **Home route is the app's main page — replace the placeholder.** `src/routes/_protected/index.tsx` ships as a "Welcome to {APP_NAME}" placeholder. The preview always opens at `/`, so the FIRST/primary page you build MUST be edited directly into `_protected/index.tsx` — never leave the placeholder, and never build the main page as a separate route while `/` still shows "Welcome…". The user must see their generated app at `/`, not an empty Dashboard.
- **Keep the nav in sync with the home route.** When `/` becomes the main page, rename the default `routes` entry in `src/components/layout/index.ts` (title/icon) to match it — do not add a second entry that duplicates `/`. Only add new `routes` entries for genuinely separate secondary pages.
- Additional pages: `src/routes/<name>.tsx` with `createFileRoute`, then add a nav entry to `src/components/layout/index.ts`.
- Use `data-flush` for full-page layouts (removes padding).

## Database (Drizzle + Neon HTTP)

Enabled when `DATABASE_URL` is set. Apps without DB boot normally.

### When to provision

| Signal | Action |
|---|---|
| "save", "store", "track", CRUD, records | Call `agentic_coding_request_database` MCP tool first |
| Ephemeral UI state, toggles | `useState` / `useReducer` |

### Provisioning

```
agentic_coding_request_database(app_id: "<value of $APPGEN_APP_ID env var>")
```

Idempotent. Do not ask for confirmation — execute directly.

### After provisioning — exact order

1. `bun run db:status` — must print `state=connected`. A missing-file/module error (not a connection error) means a local runner was deleted; restore it with `cp /base/src/server/db/migrate.ts /base/src/server/db/status.ts src/server/db/` — never hand-rewrite them.
2. Define tables in `src/server/db/schema.ts` — **it does not exist yet; create it with `Write`, never `Read` it first** (single file)
3. `bun run db:generate`
4. `bun run db:migrate`
5. `bun run db:status` — verify table in list
6. Write service in `src/services/db/<domain>Service.ts`
7. Wire UI with `useQuery`/`useMutation`. Gate with `useCapabilities()`.

Recovery details (missing `_journal.json`/`meta/`, `DATABASE_URL` unset): see `/base/src/server/db/AGENTS.md`.

### Schema and relations examples

See [`/base/src/server/db/AGENTS.md`](/base/src/server/db/AGENTS.md) before writing `schema.ts` (it also covers the migration recovery cases). **Do not `cat` `/base/src/server/db/schema.ts`** — it is commented-out boilerplate, not needed. Key trap: `relations()` must be declared on **both** sides or `with: { ... }` silently returns nothing.

### Members are managed in the published app

Role *definitions* travel to production as migrations. Members and their
assignments never travel: preview writes to the dev database and stays there.

So if the builder says "make Ravi a manager", tell them that has to be done on
the Members screen of the published app. Doing it in preview assigns a role in a
database the published app never sees.

### Files you own

- `src/server/db/schema.ts`, `src/server/db/migrations/`, `src/services/db/<domain>Service.ts`

### Files you DON'T touch

- `src/lib/db.ts` (`@/lib/db`, base-owned), `drizzle.config.ts`, `src/server/db/migrate.ts`, `src/server/db/status.ts`, `.env.local` — `drizzle.config.ts` is template-root-owned (no base copy). The runners (`migrate.ts`/`status.ts`) are local scaffolded files invoked by exact path in package.json (the `/base` overlay never applies to script paths); if a runner is missing, restore it from `/base/src/server/db/`, never reimplement it

### DB-backed page pattern

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCapabilities } from "@/hooks/useCapabilities";
import { listItems, deleteItem } from "@/services/db/itemService";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/items")({ component: ItemsPage });

function ItemsPage() {
  const queryClient = useQueryClient();
  const { data: caps, isLoading: capsLoading } = useCapabilities();
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
    enabled: caps?.databaseEnabled === true,
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteItem({ data: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  if (capsLoading) return <Skeleton className="h-64 w-full" />;
  if (!caps?.databaseEnabled) return <p>Database not configured.</p>;
  if (itemsLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      {items?.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

Rules:
- All hooks MUST be called before any early return.
- Use `enabled: caps?.databaseEnabled === true` to skip DB queries when DB is off.
- Use `<Skeleton>` for loading states.
- Invalidate queries after mutations.

## Roles and permissions (prebaked RBAC)

Everything here already exists in base. **Never hand-roll roles**: no `roles` table of your own, no permission strings scattered in components, no `if (user.isAdmin)`.

### When to add it

| Signal | Action |
|---|---|
| "roles", "permissions", "admin vs staff", "only managers can…", "read-only users" | Follow the exact order below |
| "invite people", "add a user" | That is AIS invitations, not RBAC. Nothing to build |
| One user, no mention of who can do what | Do nothing |

**Preconditions.** RBAC needs a database: if `DATABASE_URL` is unset, provision one first. If the app has no sign-in (`AIS_AUTH_ENABLED` is `false`), say that roles cannot apply because every visitor is anonymous, and stop.

**If the builder has not said which roles they need, ask before you build any.**
"Set up roles and permissions" on its own opens the conversation; it is not a
licence to invent an org chart. Ask which roles they want and what each should be
able to do, with options drawn from what this app actually does. The Admin /
Viewer / Manager example below is an illustration, not a default to fall back on.
See "Asking the builder".

### Exact order

1. `bun run db:status` — must print `state=connected`.
2. Confirm `src/server/db/rbacSchema.ts` and `src/server/db/guard-rbac-schema.ts` exist. They ship with this template. If either is missing, restore it with `cp /base/src/server/db/rbacSchema.ts /base/src/server/db/guard-rbac-schema.ts src/server/db/` — never hand-write them, the column names are a contract.
3. Add `rbacSchema.ts` to `drizzle.config.ts`, which lists only the app's own
   schema by default:
   `schema: ["./src/server/db/schema.ts", "./src/server/db/rbacSchema.ts"]`

   This is the step that creates the RBAC tables. Apps that never ask for roles
   leave the config alone and never get them, which is what keeps "the tables
   exist" a reliable signal that this app uses RBAC.
4. `bun run db:generate` then `bun run db:migrate`.
5. Declare the app's permissions in `src/lib/permissions.ts`:
   ```ts
   import type { PermissionCatalog } from "@/lib/rbac";
   export const PERMISSION_CATALOG: PermissionCatalog = [
     { feature: "Expenses", permissions: [
       { key: "expenses.view", label: "View expenses" },
       { key: "expenses.approve", label: "Approve expenses", description: "Sign off someone else's claim" },
     ]},
   ];
   ```
   Keys are `feature.action`. Use the same strings in step 8.

   **If the app calls a data passthrough, its key goes in here too.** Anything
   using `usePaginatedQuerySource`, `useQuerySource`, `connectors.executeModel`
   or `workflows.run` needs `data.query`, `ai.ask` or `workflows.run` in the
   catalog, granted to the roles that need that data. Those endpoints run what
   they are handed, so until the key is on a role any member of the app can call
   them directly. `rbac:check` fails if the app calls one and the key is missing.

   **Name every read-only permission `<feature>.view`.** Viewer is seeded from
   exactly those keys, so a read permission spelled `expenses.read` or
   `expenses.list` leaves Viewer unable to see that feature.

   This seeding happens once. A key you add after setup reaches no existing role
   except the ones holding `*`, see "Adding a permission after setup".
6. Create the roles as a **data migration**, never at runtime:
   ```
   bunx drizzle-kit generate --custom --name=rbac_roles
   ```
   Fill the generated file with the two built-in roles plus the ones the builder
   actually described:
   ```sql
   INSERT INTO "app_roles" ("name", "description", "permissions", "is_default")
   VALUES
     ('Admin', 'Full access, including managing roles and members.', ARRAY['*']::text[], false),
     ('Viewer', 'Can view data but not change it.', ARRAY['expenses.view']::text[], true),
     ('Manager', 'Approves expenses.', ARRAY['expenses.view', 'expenses.approve']::text[], false)
   ON CONFLICT ("name") DO NOTHING;
   ```
   Then `bun run db:migrate`.

   `renderRolesMigration(createDefaultRoles(PERMISSION_CATALOG))` in
   `@/server/rbac/seed` renders Admin and Viewer for you; add the builder's own
   roles to the array before rendering.

   **Why a migration and not a seed.** You only ever touch the dev database.
   Publishing runs migrations against production and nothing else, so roles
   created any other way never reach the published app and every request there
   is refused.

   **Restoring roles after a revert.** Reverting the app brings the role tables
   back empty, so it reports that roles are not set up in this environment and
   every gated request is refused. Run `bun run db:seed-roles`: it replays the
   `app_roles` `INSERT`s out of the roles migration and nothing else, and is safe to run
   twice. Do NOT reach for `bun run db:migrate` here. The revert empties
   drizzle's journal, so the migrator treats the roles migration as pending and
   fails on its first `CREATE TABLE`.

   **Roles are starters, not fixtures.** Admin and Viewer are a starting point:
   rename them, reshape them, add the builder's own roles. Nothing is special
   cased by name. What the app guarantees instead is the two jobs: exactly one
   role is `is_default`, and at least one role holds `*` or `rbac.manage` with
   at least one member holding it. The server refuses any change that would
   break either, so the last way back in cannot be removed.

   The Roles screen shows a lock on any role that can manage roles and does not
   offer to edit or delete it, since that role can hand out every other
   permission. The lock is derived from the permissions, not stored: reshape a
   role through a migration and it unlocks as soon as it stops managing.

   Later role changes are new migrations; never edit one that has already been
   applied.

7. Nothing to do: `rbac: rbacRouter` is already registered in
   `src/integrations/trpc/router.ts`. Do not remove or rename that key, the
   hooks call `t.rbac.*`.
8. Gate the procedures that need it, reads as well as writes:
   ```ts
   import { permissionProcedure } from "@/integrations/trpc/init";
   list: permissionProcedure("expenses.view").query(/* … */)
   approve: permissionProcedure("expenses.approve").mutation(/* … */)
   ```

   **A query needs gating as much as a mutation.** The floor below only catches
   mutations, so a query left on `protectedProcedure` is served to every member
   whatever role they hold, and the `expenses.view` key you just put in the
   catalog does nothing at all. See "The floor".

   tRPC is not the only seam. A server function or `/api/*` route that
   changes data is admin-only until it declares a permission too.

   **In a gated handler, `requirePermission` replaces `requireAppAccess`.** It
   checks access itself. Leaving both in place refuses the call before the
   permission is ever read, so a Manager holding `expenses.approve` is turned
   away by the floor:
   ```ts
   export const approveExpense = createServerFn({ method: "POST" })
     .inputValidator((id: string) => id)
     .handler(async ({ data: id }) => {
       const { requirePermission } = await import("@/server/protectedServerFn");
       await requirePermission("expenses.approve");
       const { getDb } = await import("@/lib/db");
       // …
     });
   ```
   Handlers with no permission of their own keep `await requireAppAccess("read" | "write")`.
   Say `"write"` for anything that changes data, whatever the HTTP method:
   `createServerFn()` defaults to GET, so a write that never declared
   `method: "POST"` would otherwise read as a read and skip the floor.
   For anything not declared `method: "GET"` that still means admin-only, so a
   handler you forget to gate refuses rather than runs.

   The `protectedServerFn` wrapper takes the permission as a second argument,
   since its check runs before the handler body and a `requirePermission` call
   inside is never reached:
   ```ts
   export const archive = protectedServerFn({ method: "POST" }, "expenses.archive")
     .handler(async () => {
       // …
     });
   ```
9. Mount the screens **inside the app's layout**, not as loose pages. Adding
   them makes this a multi-page app, so three things change together:

   a. One route under `_protected`, beside the app's other pages. The page is
      `RbacSettingsPage`, a Members tab and a Roles & permissions tab; `useRbac`
      wires it to the rbac router.
   ```tsx
   // src/routes/_protected/settings.tsx
   import { createFileRoute, Navigate } from "@tanstack/react-router";
   import { RbacSettingsPage } from "@/components/rbac";
   import { Skeleton } from "@/components/ui/skeleton";
   import { useCan } from "@/hooks/useCan";
   import { useRbac } from "@/hooks/useRbac";
   import { MANAGE_PERMISSION } from "@/lib/rbac";
   import { PERMISSION_CATALOG } from "@/lib/permissions";

   export const Route = createFileRoute("/_protected/settings")({
     component: SettingsPage,
   });

   function SettingsPage() {
     const { can, isLoading } = useCan(MANAGE_PERMISSION);
     if (isLoading) return <Skeleton className="h-64 w-full" />;
     if (!can) return <Navigate to="/" replace />;
     return <RolesAndMembers />;
   }

   function RolesAndMembers() {
     return <RbacSettingsPage {...useRbac(PERMISSION_CATALOG)} />;
   }
   ```

   **Gate the page, do not let it render and fail.** Every query behind this
   screen requires `rbac.manage`, so a member without it would otherwise land on
   a page where the member list and the role list both come back forbidden. Keep
   `useRbac` in a child component: hooks cannot be called conditionally, and
   calling it in `SettingsPage` would fire those forbidden requests before the
   redirect.

   `can` is the whole check. The app owner holds no extra permission, so
   whether they can manage roles is decided by their role like everyone else.
   Getting back in after a lockout is `healManagingLockout`, not something this
   page grants.

   Pass the hook's result straight through. It deliberately returns no
   `onInvite` or `onRemove`: AIS owns who may open the app, the app owns what
   they may do once inside, and a callback left out hides its control.

   b. Switch `src/routes/_protected.tsx` from `AppShell` to `AppLayout`, which
      is what provides the sidebar and header. The file ships with both the
      import and the usage commented out; uncomment them and drop `AppShell`.
      Without this the pages render bare, with no way to navigate between them.

   c. Register them in `src/components/layout/index.ts` so they appear in the
      sidebar:
   ```ts
   import { LayoutDashboard, Settings } from "lucide-react";
   import { MANAGE_PERMISSION } from "@/lib/rbac";
   export const routes: NavItem[] = [
     { title: "Dashboard", url: "/", icon: LayoutDashboard },
     { title: "Settings", url: "/settings", icon: Settings, permission: MANAGE_PERMISSION },
   ];
   ```

   `permission` is optional on a `NavItem`. An entry that declares one is hidden
   from anyone who does not hold it, so a Viewer never sees a Settings link they
   cannot open. Entries without it are shown to everyone, which is what apps
   with no roles get. Use it for any page you gate, not only this one.

   If the app was single-page until now, b is the step most easily missed: the
   routes work, the screens render, and there is no nav to reach them from.
10. Hide controls the member cannot use:
    ```tsx
    import { Can } from "@/components/rbac/Can";
    <Can permission="expenses.approve"><Button>Approve</Button></Can>
    ```

11. Tell the platform this app manages roles, see "Keep the platform in step".
12. **Run `bun run rbac:check` and fix what it reports.** Setting roles up is a
    dozen steps and most of the ways to get them wrong are silent: an ungated
    mutation refuses every non-admin, an ungated query is read by every role, a
    mistyped key gates against everybody, and a read key not named `.view`
    leaves Viewer unable to see the feature. None of that fails a build. The
    check reads the app's own source and names the file and line.

    It also prints every procedure with who can run it. Show the builder that
    table: the gates are the part of this they are entitled to disagree with,
    and it is easier to correct now than after someone is locked out of their
    own app.

### Keep the platform in step

```
agentic_coding_set_rbac_enabled(app_id: "<value of $APPGEN_APP_ID env var>", enabled: true|false)
```

Call it **whenever the answer to "does this app restrict what a user can do?"
changes**, not only at the end of the steps above:

| What you just did | Call with |
|---|---|
| Set up the prebaked RBAC | `true` |
| Wrote any access check of your own that depends on who the user is, even without the prebaked pieces | `true` |
| Removed the roles, the gates, or the screens | `false` |
| Changed roles or permissions on an app that already reported `true` | nothing, it is already recorded |

The second row matters. You are told above never to hand-roll roles, and you
should not. But if an app ends up with its own notion of who may do what for any
reason, the platform still needs to know, because the flag is the only thing
stopping someone making that app public and silently removing every check.

The third row matters just as much. A stale `true` leaves the builder unable to
make their app public and unable to see why. If you take role checks out, say so
in the same change.

This flag never affects enforcement inside the app, which always comes from the
app's own tables. It exists so the platform can refuse settings that would make
the app's own rules meaningless.

### What base gives you

| Need | Import |
|---|---|
| Gate a procedure on a permission | `@/integrations/trpc/init` (`permissionProcedure`) |
| Starter role definitions and their SQL | `@/server/rbac/seed` (`createDefaultRoles`, `renderRolesMigration`) |
| The RBAC procedures | `@/server/trpc/routers/rbac` (`rbacRouter`) |
| Current member, their permissions | `@/hooks/useCurrentMember`, `@/hooks/useCan` |
| Roles and members data | `@/hooks/useRoles` (`useRoles`, `useMembers`, `useAssignRole`, …) |
| Screens | `@/components/rbac` (`RbacSettingsPage`), wired by `@/hooks/useRbac` |
| Hide a control | `@/components/rbac/Can` |
| Tell the platform RBAC is on | `agentic_coding_set_rbac_enabled` MCP tool |
| Types and checks | `@/lib/rbac` (`PermissionCatalog`, `hasPermission`, `MANAGE_PERMISSION`) |

### Guards you cannot break from the UI

The server refuses any write that would lock the app out of its own roles:

- deleting the default role, or the only role that can manage roles
- stripping manage from the only role that has it
- **reassigning the last person who can manage roles**, including demoting yourself

Each refusal comes back with a message meant for the user. Show it rather than
swallowing it.

Role changes are recorded in `app_role_audit` in the app's own database. That
trail is a convenience, not evidence: an app admin can edit it through App
Settings, and deleting or reverting the app removes it. If the app ever ends up with nobody able to manage roles, which the
guards prevent from the screens but a migration can still cause, the next person AIS lets edit
the app is given the managing role when they sign in. It repairs the app rather than granting a
silent exception, so a role always means what the Members screen says it means. It fires only
when nobody holds a managing role, so it never undoes a deliberate demotion.

### If sign-in is turned off

On a public app nobody is signed in, so there is no member and no permissions.
Gated procedures and every ungated mutation are denied rather than waved
through, and the Roles screen says so. Do not try to work around this by
removing the gates: if the builder wants an open app, roles are the wrong tool.

### Two rules the server enforces

Roles are the builder's to rename, delete and reshape, with exactly two jobs always covered:

- **One role can manage roles** (holds `rbac.manage` or `*`), and at least one member holds it.
- **Exactly one role is the default**, given to everyone on first sign-in, except
  people AIS says may edit this app: they join on the managing role instead, since they
  can already change the gates in the editor. The role is decided once, when the member
  is created, so a later demotion sticks and the Members screen always tells the truth
  about what someone can do.

The server refuses writes that would break either, with a message to show the user. Do not re-implement these checks, and do not special-case the names "Admin" or "Viewer" anywhere: they are starter names the builder may change.

### Adding a feature after setup

Roles do not look after themselves once they exist. Every prompt after setup that
adds something a user can see or do carries four steps, and skipping any one of them
is a silent bug rather than an error:

1. **Add the keys to `PERMISSION_CATALOG`** in `src/lib/permissions.ts`. One `.view`
   key for seeing the feature, one more per action on it. No key means nothing can be
   granted, and the Roles screen cannot show what it does not know about.
2. **Gate every new procedure**, queries as well as mutations:
   `permissionProcedure("reports.view").query(…)` and
   `permissionProcedure("reports.export").mutation(…)`. An ungated mutation is
   admin-only, an ungated query is open to every role, and neither says so.
3. **Gate the server functions and `/api/*` routes** the feature adds, with
   `requirePermission("…")` or the wrapper's second argument.
4. **Give the nav entry its permission** in `src/components/layout/index.ts`:
   `{ title: "Reports", url: "/reports", icon: FileText, permission: "reports.view" }`.
   Without it the page shows in the sidebar for people whose role cannot open it, and
   they get a refusal instead of a page.

Then run `bun run rbac:check` and show the builder the table it prints, so they can
see which roles reach the new feature. A new key is granted to nobody but the roles
holding `*`, so somebody has to grant it on the Roles screen before anyone else can
use it.

### Adding a permission after setup

The roles migration runs once. It is `ON CONFLICT ("name") DO NOTHING`, so it never
runs again and never touches a role that already exists.

So when a later feature adds a permission key:

- **Roles holding `*` get it automatically.** Admin is seeded with the wildcard rather
  than a snapshot of the catalog, so nothing is needed for it.
- **Every other role does not get it, and that is correct.** A new permission starts
  granted to nobody. An app admin grants it on the Roles screen, where they can see what
  they are handing out.
- **Never write a migration that sets an existing role's `permissions`.** An app admin may
  have changed that role since setup, and a `SET "permissions" = ARRAY[...]` silently
  discards their changes in production. There are no down migrations to undo it.

Add the key to `PERMISSION_CATALOG` and stop there. The Roles screen picks it up from the
catalog, so it is grantable straight away.

Only if the builder explicitly asks for the new permission to be preset on existing roles,
append it. Never replace, never key off a role name, and keep it repeatable:

```sql
UPDATE "app_roles"
SET "permissions" = "permissions" || ARRAY['reports.view']::text[]
WHERE NOT ("permissions" @> ARRAY['reports.view']::text[])
  AND ("permissions" @> ARRAY['expenses.view']::text[]);
```

That targets roles by what they can already do rather than by what they are called, adds
without removing, and does nothing on a second run. Ask the builder which existing
capability should imply the new one; do not guess.

### The floor

Once RBAC exists, **every mutation requires a member who can administer, unless the procedure declares a permission**. A mutation you forget to gate fails closed rather than open.

This catches people out. In an expenses app, "submit an expense" is a mutation, so if it stays on `protectedProcedure` only managers can submit. Every action a non-admin role is meant to perform needs its own `permissionProcedure("…")` and a matching key in the catalog. Go through the app's mutations and ask who should be able to run each one.

**The floor does not cover queries.** Reads fail open where writes fail closed: a query left on `protectedProcedure` is served to every member of the app whatever role they hold, so `expenses.view` sitting in the catalog grants nothing and hides nothing. Gate the query behind a feature with that feature's `.view` permission, or a Viewer and a Manager see exactly the same data. Go through the app's queries the same way you went through its mutations.

`bun run rbac:check` does that pass for you. It names every procedure still on `protectedProcedure`, with its file and line, and prints the gate on each of the others, so "who can run what" is something you can read rather than something you have to remember.

Base's own passthroughs to the AIS backend sit below the floor on purpose: signing out, `connectors.querySource`, `connectors.executeModel` and `workflows.run` are not yours to put a `permissionProcedure` on, and installing roles must not break the sign-out button or the chat box for a Viewer. Signing out stays that way for good.

**The three data passthroughs are different, because a gate in front of them is not enough.** `connectors.querySource` takes the SQL it is given, so a member who calls that endpoint directly reaches whatever the connector reaches, whatever their role. A gate in front protects the app's UI, not the endpoint.

So the three data passthroughs honour a key of their own, and the app opts in by putting that key on a role:

| passthrough | key |
|---|---|
| `connectors.querySource` | `data.query` |
| `connectors.executeModel` | `ai.ask` |
| `workflows.run` | `workflows.run` |

While no role mentions the key, the passthrough keeps exactly the access it had before roles existed, which is what stops roles breaking the chat box. The moment any role mentions it, it is enforced for everyone without it. Signing out is never gated.

Put the key in `PERMISSION_CATALOG` so it can be granted on the Roles screen, and **grant it to every role that needs that data** before you rely on it, since the passthrough refuses the rest. If a role must not see some data at all, that is still a procedure of your own with the query fixed in it: a key on `querySource` says who may run a query, not which query they may run.

### Files you own

- `src/lib/permissions.ts`, `src/routes/_protected/settings.tsx`, your own gated procedures

### Files you DON'T touch

- `src/server/db/rbacSchema.ts` and `src/server/db/guard-rbac-schema.ts` — scaffolded copies of base files. Renaming a table or column breaks the sync test, and the audit rows the app writes itself.
- `src/hooks/useCurrentMember.ts`, `useCan.ts`, `useRoles.ts`, `useRbac.ts` and `src/components/rbac/Can.tsx`: also scaffolded, and only these. They live here rather than in base because they import `@/integrations/trpc/react`, which only resolves inside this project. A sync test keeps them identical to base. The settings components they feed (`rbac-settings-page.tsx`, `roles-settings.tsx`, `members-settings.tsx`, `settings-section.tsx`, `types.ts`, `utils.ts`) stay in base, reached through `@/components/rbac`, and are read-only like the rest of base.
- Anything under `/base` — read-only.
- Never remove `rbacSchema.ts` from `drizzle.config.ts`: `db:generate` would emit `DROP TABLE` for every role and member. The guard script blocks this and explains why.

## S3 Object Storage (AWS SDK v3)

Enabled when the platform has provisioned storage and credentials are present. Apps without storage boot normally. Credentials are temporary STS tokens auto-refreshed by the platform — **never hardcode them**.

### CRITICAL: Provision BEFORE writing any S3 code

**Before writing ANY code that uses file uploads, images, photos, documents, PDFs, CSVs, or the S3 helpers, you MUST first call the MCP tool to provision storage. If you skip this step, the app will crash because S3 credentials won't exist.**

Read the value of `APPGEN_APP_ID` from the environment, then call:
```
agentic_coding_create_storage(app_id: "<the APPGEN_APP_ID value>")
```

To get the app ID, run: `echo $APPGEN_APP_ID` in the terminal.

This is the FIRST thing you do — before creating any service files, components, or routes that involve files. Idempotent — safe to call even if already provisioned. Do not ask for confirmation.

Same pattern as database: you call `agentic_coding_request_database` before writing DB code. You call `agentic_coding_create_storage` before writing file upload code.

### Folders and gating

`assets/` = agent-written static assets (public). `uploads/` and `exports/` are written by app code at runtime only — **the agent never touches files there directly**. Gate storage UI on `caps?.s3Enabled` (same shape as `databaseEnabled`). Full folder table + safety model: see the link below.

For the helper API (`uploadFile`, `downloadFile`, `deleteFile`, `getPresignedUrl`, `refreshS3Credentials`), refresh model, and safety rules see [`/base/src/server/AGENTS.md`](/base/src/server/AGENTS.md).

## Platform Integration

- **Auth**: Platform-based only via `getAuthState()` in `__root.tsx`. Hook: `useSignIn`, `useSignOut`, `useGetUser` (tRPC, calls platform API).
- **Connectors**: `useConnectors(params?)`, `useConnector(id)`, `useQuerySource()` (mutation), `useExecuteModel()` (mutation, AI/ML sources).
- **Workflows**: `useRunWorkflow(workflowId)`.
- **Chat**: `<ChatAssistant workflowId={id} />` — one component, one prop. See `src/components/chat/`.
- **Attached context**: When the user pins sources, models, AI/ML connectors, or workflows in AppGen chat, their IDs appear in your system prompt (`Available connectors: [...]`, etc.). See [`/base/src/services/AGENTS.md`](/base/src/services/AGENTS.md) — *Attached context payload*.
- **MCP tools**: The `aisquared` MCP provides platform connectors, workflows, AI/ML model execution (`aisquared_connectors_execute_model`), and DB/storage provisioning.

## Coding Standards

- **Design quality:** follow the "Design quality — avoid AI slop" guardrails in `src/components/AGENTS.md` (design tokens over hardcoded values, one accent, realistic content, and empty/loading/error states for every data view).
- Use `@/` alias for imports. Prefer shadcn components over raw HTML.
- Tailwind utilities + `cn()`. No inline styles.
- TypeScript strict; no `any`.
- Biome for formatting, scoped to touched files: `bunx biome format --write <files>`. Full lint is `bun run check` (final review only).
- No render-time side effects. Use `useEffect`/handlers.

## Commands

```bash
bun run build        # publish check only, when asked or after a failed publish
bun run check        # full-repo lint + format check — final review only, not per change
bun run test         # Vitest
bun run db:generate  # SQL migration from schema diff
bun run db:migrate   # Apply migrations via Neon HTTP
bun run db:status    # DB state + table list
bun run db:seed-roles # Replay the role INSERTs, recovery after a revert
bun run rbac:check    # Roles wiring: ungated procedures, unknown keys, who can run what
```
