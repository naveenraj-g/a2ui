import { headers } from "next/headers";

export async function getAgentToken(): Promise<string> {
  const hdrs = await headers();

  const res = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/token`, {
    method: "GET",
    headers: hdrs,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch agent token: ${res.status}`);
  }

  const data = await res.json();
  const token: string | undefined = data.token ?? data.jwt ?? data.access_token;

  if (!token) {
    throw new Error("Agent token not found in auth response");
  }

  return token;
}
