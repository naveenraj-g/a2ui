import { headers } from "next/headers";

/**
 * Fetches a short-lived JWT from Better Auth's JWT plugin endpoint.
 * Called server-side inside a Next.js request context so the current
 * session cookie is forwarded automatically via the request headers.
 */
export async function getJWTToken(): Promise<string> {
  const hdrs = await headers();

  const res = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/token`, {
    method: "GET",
    headers: hdrs,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JWT token: ${res.status}`);
  }

  const data = await res.json();
  // Better Auth JWT plugin returns { token: string }
  const token: string | undefined = data.token ?? data.jwt ?? data.access_token;

  if (!token) {
    throw new Error("JWT token not found in auth response");
  }

  return token;
}
