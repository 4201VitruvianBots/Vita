import { getConfig } from "../../lib/config.js";
import { readSession } from "../../lib/session.js";
import { ensureUserFork } from "../../lib/github.js";
import { handleOptions, jsonResponse } from "../../lib/http.js";

export default async function handler(req) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const session = readSession(req);
  if (!session) {
    return jsonResponse(req, 401, { error: "not_authenticated" });
  }

  const { source } = getConfig();

  try {
    const fork = await ensureUserFork(
      session.accessToken,
      session.login,
      source.owner,
      source.repo
    );

    return jsonResponse(req, 200, {
      forkUrl: fork.html_url,
      created: true,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(req, 500, { error: err.message || "fork_failed" });
  }
}
