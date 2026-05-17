import { clearSessionCookie } from "../../lib/session.js";
import { handleOptions, jsonResponse } from "../../lib/http.js";

export default async function handler(req) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  return jsonResponse(
    req,
    200,
    { ok: true },
    { "Set-Cookie": clearSessionCookie() }
  );
}
