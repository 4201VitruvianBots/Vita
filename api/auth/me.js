import { readSession } from "../../lib/session.js";
import { getViewer } from "../../lib/github.js";
import { corsHeaders, handleOptions, jsonResponse } from "../../lib/http.js";

export default async function handler(req) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "GET") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const session = readSession(req);
  if (!session) {
    return jsonResponse(req, 401, { authenticated: false });
  }

  try {
    const user = await getViewer(session.accessToken);
    return jsonResponse(req, 200, {
      authenticated: true,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(req, 401, { authenticated: false });
  }
}
