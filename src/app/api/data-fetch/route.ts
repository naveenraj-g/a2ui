/**
 * POST /api/data-fetch
 *
 * Generic server-side proxy used by client components (DataTable) to fetch
 * paginated / filtered data from an external API with Bearer auth.
 *
 * Request body:
 *   {
 *     url: string,
 *     queryParams?: Record<string, any>,
 *     dataPath?: string,   // dot-path to extract row array  e.g. "entry", "data.items"
 *     totalPath?: string,  // dot-path to extract total count e.g. "total", "meta.total"
 *   }
 *
 * Response:
 *   { rows: any[], total: number, raw: any }
 */

import { getJWTToken } from "@/modules/server/auth/jwt-token";

function getAtPath(obj: any, path: string): any {
  if (!path) return obj;
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function extractRows(raw: any, dataPath?: string): any[] {
  if (dataPath) {
    const val = getAtPath(raw, dataPath);
    return Array.isArray(val) ? val : [];
  }
  if (Array.isArray(raw)) return raw;
  const candidates = ["data", "items", "results", "entry", "records", "rows"];
  for (const key of candidates) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  return [];
}

function extractTotal(raw: any, totalPath?: string, rowCount = 0): number {
  if (totalPath) {
    const val = getAtPath(raw, totalPath);
    return typeof val === "number" ? val : Number(val) || rowCount;
  }
  const candidates = ["total", "count", "totalCount", "total_count"];
  for (const key of candidates) {
    if (typeof raw?.[key] === "number") return raw[key];
  }
  return getAtPath(raw, "meta.total") ?? getAtPath(raw, "meta.count") ?? rowCount;
}

export async function POST(req: Request) {
  const { url, queryParams = {}, dataPath, totalPath } = await req.json();

  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const token = await getJWTToken();

  const resolvedUrl = url.startsWith("/")
    ? `${process.env.FHIR_SERVER_URL ?? ""}${url}`
    : url;

  const params = new URLSearchParams(
    Object.entries(queryParams)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );

  const fullUrl = params.toString() ? `${resolvedUrl}?${params}` : resolvedUrl;

  const upstream = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!upstream.ok) {
    return Response.json(
      { error: `Upstream error: ${upstream.status} ${upstream.statusText}` },
      { status: upstream.status },
    );
  }

  const raw = await upstream.json();
  const rows = extractRows(raw, dataPath);
  const total = extractTotal(raw, totalPath, rows.length);

  return Response.json({ rows, total, raw });
}
