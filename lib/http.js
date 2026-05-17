import { getConfig } from "./config.js";

export function corsHeaders(req) {
  const { siteUrl } = getConfig();
  const origin = req.headers.origin;
  const allowed = new Set([siteUrl, "http://localhost:3000", "http://127.0.0.1:3000"]);

  if (origin && allowed.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }

  return {};
}

export function jsonResponse(req, status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
      ...extraHeaders,
    },
  });
}

export function redirectResponse(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers,
    },
  });
}

export function handleOptions(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}
