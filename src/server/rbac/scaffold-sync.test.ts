// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const baseRbac = join(here, "../../../../../base/src/server/rbac");

/**
 * `rbac:check` runs as `bun run src/server/rbac/check.ts`, so the file has to
 * exist in the app's own tree rather than only in the shared base. Base holds
 * the canonical copy.
 */
describe("rbac check scaffold", () => {
  for (const file of ["check.ts", "check.test.ts"]) {
    it(`${file} stays byte-identical to the canonical base copy`, () => {
      expect(readFileSync(join(here, file), "utf8")).toBe(
        readFileSync(join(baseRbac, file), "utf8"),
      );
    });
  }
});
