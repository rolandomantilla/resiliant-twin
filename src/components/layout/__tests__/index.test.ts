import { describe, expect, it } from "vitest";
import { routes } from "@/components/layout";

describe("layout routes", () => {
  it("exposes the Dispatch Dashboard route pointing at /", () => {
    expect(
      routes.some((r) => r.title === "Dispatch Dashboard" && r.url === "/"),
    ).toBe(true);
  });

  it("exposes the Data Feed & Replay route", () => {
    expect(
      routes.some(
        (r) => r.title === "Data Feed & Replay" && r.url === "/data-feed",
      ),
    ).toBe(true);
  });
});
