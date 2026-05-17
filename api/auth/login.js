import { getConfig } from "../../lib/config.js";
import { createOAuthState } from "../../lib/session.js";
import { handleOptions, redirectResponse } from "../../lib/http.js";

export default async function handler(req) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { github, apiUrl, oauthScopes, siteUrl } = getConfig();
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get("return_to"), siteUrl);
  const state = createOAuthState();

  const params = new URLSearchParams({
    client_id: github.clientId,
    redirect_uri: `${apiUrl}/api/auth/callback`,
    scope: oauthScopes.join(" "),
    state: `${state}|${encodeURIComponent(returnTo)}`,
  });

  const { siteUrl, apiUrl } = getConfig();
  const crossOrigin = apiUrl !== siteUrl;
  const secureFlag = crossOrigin || process.env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = crossOrigin ? "None" : "Lax";
  const stateCookie = `vita_oauth_state=${state}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=600${secureFlag}`;

  return redirectResponse(`https://github.com/login/oauth/authorize?${params}`, {
    "Set-Cookie": stateCookie,
  });
}

function safeReturnTo(value, siteUrl) {
  if (!value) return siteUrl;
  try {
    const target = new URL(value);
    const allowed = new URL(siteUrl);
    if (target.origin !== allowed.origin) return siteUrl;
    return target.toString();
  } catch {
    return siteUrl;
  }
}
