/**
 * GET /api/workflow/terminology
 *
 * Server-side proxy for FHIR terminology concept search. Used by the
 * TerminologySelect component when server-side search is configured.
 * Injects the FHIR base URL and Bearer token so neither leaks to the client.
 *
 * Mode A — field concepts (small HL7 value sets):
 *   resource  - FHIR resource name (e.g. "Condition")
 *   field     - resource field name (e.g. "clinicalStatus")
 *   query     - optional free-text filter within the value set
 *
 * Mode B — system search (LOINC, ICD-10, SNOMED CT, RxNorm):
 *   system    - code system canonical URL (e.g. "http://loinc.org")
 *               omit to search all loaded systems at once
 *   query     - required free-text search term
 *
 * Both modes return: { concepts: ConceptResponse[] }
 */

import { getJWTToken } from "@/modules/server/auth/jwt-token";

const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL!;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");
  const field    = searchParams.get("field");
  const system   = searchParams.get("system");
  const query    = searchParams.get("query") ?? "";

  // Mode B: system-level full-text search (LOINC / ICD-10 / SNOMED / RxNorm)
  const isSystemSearch = system !== null || (!resource && !field && query);

  if (!isSystemSearch && (!resource || !field)) {
    return Response.json(
      { error: "Provide either (resource + field) or system" },
      { status: 400 },
    );
  }

  try {
    const token = await getJWTToken();

    let concepts: unknown[];

    if (isSystemSearch) {
      const params = new URLSearchParams({ q: query, limit: "20" });
      if (system) params.set("system", system);

      const res = await fetch(
        `${FHIR_SERVER_URL}/api/fhir/v1/terminology/search?${params}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );

      if (!res.ok) throw new Error(`Terminology search error: ${res.status}`);
      const data = await res.json();
      // /terminology/search returns { data: [...] } — normalise to concepts
      concepts = Array.isArray(data.data) ? data.data : [];
    } else {
      const params = new URLSearchParams({ resource: resource!, field: field! });
      if (query) params.set("q", query);

      const res = await fetch(
        `${FHIR_SERVER_URL}/api/fhir/v1/terminology/concepts?${params}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );

      if (!res.ok) throw new Error(`Terminology concepts error: ${res.status}`);
      const data = await res.json();
      concepts = Array.isArray(data.concepts) ? data.concepts : [];
    }

    return Response.json({ concepts });
  } catch (error) {
    console.error("[workflow/terminology] Failed:", error);
    return Response.json({ error: "Failed to fetch terminology" }, { status: 500 });
  }
}
