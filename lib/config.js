function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

export function getConfig() {
  const siteUrl = optional("SITE_URL", "http://localhost:3000").replace(/\/$/, "");
  const apiUrl = optional("API_URL", siteUrl).replace(/\/$/, "");

  return {
    github: {
      clientId: required("GITHUB_CLIENT_ID"),
      clientSecret: required("GITHUB_CLIENT_SECRET"),
    },
    sessionSecret: required("SESSION_SECRET"),
    source: {
      owner: optional("SOURCE_OWNER", "4201VitruvianBots"),
      repo: optional("SOURCE_REPO", "Vita"),
      branch: optional("SOURCE_BRANCH", "main"),
    },
    siteUrl,
    apiUrl,
    cookieName: "vita_session",
    oauthScopes: ["public_repo", "codespace"],
  };
}
