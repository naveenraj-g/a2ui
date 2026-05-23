/**
 * GET /api/workflow/terminology
 *
 * Server-side proxy for FHIR terminology concept search. Used by the
 * TerminologySelect component when server-side search is configured.
 * Injects the FHIR base URL and Bearer token so neither leaks to the client.
 *
 * Query params:
 *   resource  - FHIR resource name (e.g. "Patient")
 *   field     - resource field name (e.g. "maritalStatus")
 *   query     - free-text search term (forwarded as ?search=)
 */

import { getJWTToken } from "@/modules/server/auth/jwt-token";

const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL!;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");
  const field = searchParams.get("field");
  const query = searchParams.get("query") ?? "";

  if (!resource || !field) {
    return Response.json({ error: "Missing resource or field" }, { status: 400 });
  }

  try {
    const token = await getJWTToken();
    const params = new URLSearchParams({ resource, field });
    if (query) params.set("search", query);

    const res = await fetch(
      `${FHIR_SERVER_URL}/api/fhir/v1/terminology/concepts?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      throw new Error(`Terminology API error: ${res.status}`);
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error("[workflow/terminology] Failed to fetch concepts:", error);
    return Response.json({ error: "Failed to fetch terminology" }, { status: 500 });
  }
}
