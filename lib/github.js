const GITHUB_API = "https://api.github.com";

async function githubRequest(path, accessToken, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Vita-App",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const message = body?.message || `GitHub API error (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

import { getConfig } from "./config.js";

export async function exchangeCodeForToken(code) {
  const { github, apiUrl } = getConfig();

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: github.clientId,
      client_secret: github.clientSecret,
      code,
      redirect_uri: `${apiUrl}/api/auth/callback`,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || "OAuth token exchange failed");
  }
  return data.access_token;
}

export async function getViewer(accessToken) {
  return githubRequest("/user", accessToken);
}

export async function getUserRepo(accessToken, owner, repo) {
  try {
    return await githubRequest(`/repos/${owner}/${repo}`, accessToken);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function forkRepository(accessToken, sourceOwner, sourceRepo) {
  return githubRequest(`/repos/${sourceOwner}/${sourceRepo}/forks`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      default_branch_only: true,
    }),
  });
}

export async function waitForRepository(accessToken, owner, repo, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const repoData = await getUserRepo(accessToken, owner, repo);
    if (repoData && !repoData.disabled) {
      return repoData;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for forked repository to become available.");
}

function isForkOf(repoData, sourceOwner, sourceRepo) {
  const parent = repoData?.parent;
  return parent?.full_name === `${sourceOwner}/${sourceRepo}`;
}

export async function ensureUserFork(accessToken, login, sourceOwner, sourceRepo) {
  const existing = await getUserRepo(accessToken, login, sourceRepo);

  if (existing) {
    if (isForkOf(existing, sourceOwner, sourceRepo)) {
      return existing;
    }
    throw new Error(
      `You already have a repository named "${sourceRepo}" that is not a fork of ${sourceOwner}/${sourceRepo}. Rename or remove it, then try again.`
    );
  }

  await forkRepository(accessToken, sourceOwner, sourceRepo);
  return waitForRepository(accessToken, login, sourceRepo);
}

export async function createCodespace(accessToken, owner, repo, ref) {
  return githubRequest(`/repos/${owner}/${repo}/codespaces`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref,
      display_name: `${repo} workspace`,
    }),
  });
}

export async function getBranch(accessToken, owner, repo, branch) {
  return githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, accessToken);
}

export async function getForkStatus(accessToken, login, sourceOwner, sourceRepo, branch) {
  const fork = await getUserRepo(accessToken, login, sourceRepo);

  if (!fork) {
    return { exists: false, isFork: false, upToDate: false };
  }

  if (!isForkOf(fork, sourceOwner, sourceRepo)) {
    return {
      exists: true,
      isFork: false,
      upToDate: false,
      forkUrl: fork.html_url,
    };
  }

  const [upstreamBranch, forkBranch] = await Promise.all([
    getBranch(accessToken, sourceOwner, sourceRepo, branch),
    getBranch(accessToken, login, sourceRepo, branch),
  ]);

  const upToDate = upstreamBranch.commit.sha === forkBranch.commit.sha;

  return {
    exists: true,
    isFork: true,
    upToDate,
    forkUrl: fork.html_url,
    upstreamSha: upstreamBranch.commit.sha,
    forkSha: forkBranch.commit.sha,
    branch,
  };
}

export async function syncForkWithUpstream(accessToken, owner, repo, branch) {
  return githubRequest(`/repos/${owner}/${repo}/merge-upstream`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch }),
  });
}
