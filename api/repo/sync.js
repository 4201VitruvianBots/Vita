import { getConfig } from "../../lib/config.js";
import { readSession } from "../../lib/session.js";
import { getForkStatus, syncForkWithUpstream } from "../../lib/github.js";
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
    const status = await getForkStatus(
      session.accessToken,
      session.login,
      source.owner,
      source.repo,
      source.branch
    );

    if (!status.exists || !status.isFork) {
      return jsonResponse(req, 400, { error: "fork_not_found" });
    }

    if (status.upToDate) {
      return jsonResponse(req, 200, { upToDate: true, forkUrl: status.forkUrl });
    }

    const result = await syncForkWithUpstream(
      session.accessToken,
      session.login,
      source.repo,
      source.branch
    );

    return jsonResponse(req, 200, {
      upToDate: true,
      forkUrl: status.forkUrl,
      merge: result,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(req, 500, { error: err.message || "sync_failed" });
  }
}
