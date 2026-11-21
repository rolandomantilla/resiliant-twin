// @vitest-environment node
import { describe, expect, it } from "vitest";
import { APP_AUTH_COOKIE_NAME } from "@/server/authCookie";
import { Route } from "@/routes/iframe-auth";

type Handler = (_args: { request: Request }) => Response;

const GET = (
  Route.options as unknown as { server: { handlers: { GET: Handler } } }
).server.handlers.GET;

const iframeRequest = (url: string) =>
  new Request(url, { headers: { "sec-fetch-dest": "iframe" } });

describe("/iframe-auth GET", () => {
  it("rejects a request that is not an iframe navigation", () => {
    const response = GET({
      request: new Request("https://app.test/iframe-auth?authToken=tok"),
    });

    expect(response.status).toBe(403);
  });

  it("rejects an iframe request with no authToken", () => {
    const response = GET({
      request: iframeRequest("https://app.test/iframe-auth"),
    });

    expect(response.status).toBe(400);
  });

  it("redirects to / with the auth cookie on the response it returns", () => {
    const response = GET({
      request: iframeRequest("https://app.test/iframe-auth?authToken=tok-abc"),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${APP_AUTH_COOKIE_NAME}=tok-abc`);
    expect(setCookie).toContain("SameSite=None");
    expect(setCookie).toContain("Secure");
  });
});
