import { createFileRoute } from "@tanstack/react-router";
import { serializeAppAuthCookie } from "@/server/authCookie";

function isIframeRequest(request: Request): boolean {
  // Fetch metadata header for iframe navigations.
  return request.headers.get("sec-fetch-dest")?.toLowerCase() === "iframe";
}

export const Route = createFileRoute("/iframe-auth")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!isIframeRequest(request)) {
          return new Response("Forbidden: iframe only", { status: 403 });
        }

        const url = new URL(request.url);
        const authToken = url.searchParams.get("authToken");

        if (!authToken) {
          return new Response("Missing authToken", { status: 400 });
        }

        const headers = new Headers({ Location: "/" });
        headers.append("set-cookie", serializeAppAuthCookie(authToken, "none"));

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
