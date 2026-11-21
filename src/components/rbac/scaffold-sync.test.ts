// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const templateSrc = join(here, "../..");
const baseSrc = join(here, "../../../../../base/src");

/**
 * The RBAC frontend is scaffolded, not reached through the base overlay.
 *
 * These files import `@/integrations/trpc/react`, which is template-owned.
 * vite-tsconfig-paths only rewrites aliases for files inside the project, so a
 * copy living in /base fails to resolve at runtime even though it typechecks.
 * The copy that runs is the one in this tree; base holds the canonical source.
 */
const SCAFFOLDED = [
  "hooks/useCurrentMember.ts",
  "hooks/useCan.ts",
  "hooks/useRoles.ts",
  "hooks/useRbac.ts",
  "hooks/useRbac.test.tsx",
  "components/rbac/Can.tsx",
];

describe("rbac frontend scaffold", () => {
  for (const file of SCAFFOLDED) {
    it(`${file} stays byte-identical to the canonical base copy`, () => {
      expect(readFileSync(join(templateSrc, file), "utf8")).toBe(
        readFileSync(join(baseSrc, file), "utf8"),
      );
    });
  }
});
