import { getConfig } from "../../lib/config.js";
import {
  createSessionCookie,
  verifyOAuthState,
} from "../../lib/session.js";
import { exchangeCodeForToken, getViewer } from "../../lib/github.js";
import { redirectResponse } from "../../lib/http.js";

function readStateCookie(req) {
  const raw =
    typeof req.headers?.get === "function"
      ? req.headers.get("cookie") || ""
      : req.headers?.cookie || "";
  const match = raw.match(/(?:^|;\s*)vita_oauth_state=([^;]+)/);
  return match?.[1] || null;
}

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const siteUrl = getConfig().siteUrl;

  if (error) {
    return redirectResponse(
      `${siteUrl}/?auth_error=${encodeURIComponent(error)}`
    );
  }

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state") || "";
  const [state, encodedReturnTo] = stateParam.split("|");
  const returnTo = encodedReturnTo ? decodeURIComponent(encodedReturnTo) : siteUrl;

  if (!code || !verifyOAuthState(state) || state !== readStateCookie(req)) {
    return redirectResponse(`${siteUrl}/?auth_error=invalid_state`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const user = await getViewer(accessToken);
    const session = createSessionCookie({
      login: user.login,
      accessToken,
    });

    const { siteUrl: cfgSite, apiUrl } = getConfig();
    const crossOrigin = apiUrl !== cfgSite;
    const secureFlag = crossOrigin || process.env.NODE_ENV === "production" ? "; Secure" : "";
    const sameSite = crossOrigin ? "None" : "Lax";
    const clearState = `vita_oauth_state=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`;
    const destination = new URL(returnTo);
    destination.searchParams.set("auth", "linked");

    return redirectResponse(destination.toString(), {
      "Set-Cookie": [session.header, clearState],
    });
  } catch (err) {
    console.error(err);
    return redirectResponse(
      `${siteUrl}/?auth_error=${encodeURIComponent(err.message || "oauth_failed")}`
    );
  }
}
