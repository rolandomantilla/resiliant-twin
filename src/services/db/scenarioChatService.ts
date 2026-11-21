import { createServerFn } from "@tanstack/react-start";

export const listScenarioMessages = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    return db
      .select()
      .from(schema.scenarioMessages)
      .orderBy(schema.scenarioMessages.createdAt)
      .limit(50);
  },
);

export const postScenarioMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      role: "user" | "assistant";
      content: string;
      settingsJson?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    const [row] = await db
      .insert(schema.scenarioMessages)
      .values({
        id: crypto.randomUUID(),
        role: data.role,
        content: data.content,
        settingsJson: data.settingsJson ?? null,
      })
      .returning();
    return row;
  });

export const clearScenarioMessages = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    await db.delete(schema.scenarioMessages);
    return { status: "cleared" as const };
  },
);
