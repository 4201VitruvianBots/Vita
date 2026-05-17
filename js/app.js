(function () {
  const cfg = window.VITA_CONFIG;
  if (!cfg?.owner || !cfg?.repo) {
    console.error("VITA_CONFIG is missing owner or repo.");
    return;
  }

  const slug = `${cfg.owner}/${cfg.repo}`;
  const branch = cfg.branch || "main";
  const apiBase = resolveApiBase(cfg.apiBase);
  const siteReturnTo = window.location.href.split("?")[0].split("#")[0];

  const urls = {
    repo: `https://github.com/${slug}`,
    readOnlyEditor: `https://vscode.dev/github/${slug}/tree/${branch}`,
    readOnlyCodespace: buildReadOnlyCodespaceUrl(),
  };

  const els = {
    status: document.getElementById("status"),
    linkGithub: document.getElementById("link-github"),
    startWorkspace: document.getElementById("start-workspace"),
    openMyCodespace: document.getElementById("open-my-codespace"),
    disconnect: document.getElementById("disconnect"),
    userPanel: document.getElementById("user-panel"),
    userAvatar: document.getElementById("user-avatar"),
    userLogin: document.getElementById("user-login"),
    repoLink: document.getElementById("repo-link"),
    syncDialog: document.getElementById("sync-dialog"),
    syncDialogMessage: document.getElementById("sync-dialog-message"),
  };

  els.repoLink?.setAttribute("href", urls.repo);
  els.startWorkspace?.addEventListener("click", (e) => {
    e.preventDefault();
    startReadOnlyCodespace();
  });
  els.linkGithub?.addEventListener("click", (e) => {
    e.preventDefault();
    linkGitHub();
  });
  els.openMyCodespace?.addEventListener("click", (e) => {
    e.preventDefault();
    openMyForkCodespace();
  });
  els.disconnect?.addEventListener("click", (e) => {
    e.preventDefault();
    disconnect();
  });

  els.syncDialog?.addEventListener("close", () => {
    if (els.syncDialog.returnValue === "confirm") {
      syncUserFork();
    } else if (els.syncDialog.returnValue === "cancel") {
      setStatus("Your copy is behind the team repository. You can update later from this page.", "");
    }
  });

  init();

  function buildReadOnlyCodespaceUrl() {
    const url = new URL("https://github.com/codespaces/new");
    url.searchParams.set("hide_repo_select", "true");
    url.searchParams.set("repo", slug);
    url.searchParams.set("ref", branch);
    return url.toString();
  }

  function normalizeOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  function resolveApiBase(configured) {
    const meta = document.querySelector('meta[name="vita-api-base"]')?.content?.trim();
    const base = configured || meta || null;
    if (!base) return null;

    const normalized = base.replace(/\/$/, "");

    // GitHub Pages cannot serve /api routes — ignore apiBase if it points at Pages.
    if (/\.github\.io$/i.test(window.location.hostname)) {
      const apiOrigin = normalizeOrigin(normalized);
      const siteOrigin = normalizeOrigin(window.location.href);
      if (apiOrigin && siteOrigin && apiOrigin === siteOrigin) {
        console.warn("apiBase matches GitHub Pages origin; API calls disabled.");
        return null;
      }
    }

    return normalized;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");

    if (authError) {
      setStatus(`GitHub sign-in failed: ${decodeURIComponent(authError)}`, "error");
      cleanAuthParams();
    } else if (!apiBase) {
      setStatus(
        "Start Codespace opens a read-only preview (no setup required). To link GitHub, set apiBase in js/config.js to your Vercel API URL.",
        ""
      );
    }

    if (!apiBase) {
      return;
    }

    try {
      const user = await fetchMe();
      if (user) {
        showAuthenticated(user);
        if (params.get("auth") === "linked") {
          cleanAuthParams();
          await handleRepoAfterLink();
        }
      } else {
        showUnauthenticated();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function cleanAuthParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function setStatus(message, state) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.state = state || "";
  }

  function setBusy(button, busy) {
    button?.toggleAttribute("disabled", busy);
    button?.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function openInNewTab(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(url);
    }
  }

  /** Read-only preview — no API calls, opens VS Code for the Web directly. */
  function startReadOnlyCodespace() {
    setStatus("Opening read-only preview in VS Code for the Web…", "loading");
    openInNewTab(urls.readOnlyEditor);
    setStatus(
      "A read-only preview should open in a new tab. Sign in to GitHub if prompted. To save work permanently, link your GitHub account and use your own fork.",
      "ready"
    );
  }

  function linkGitHub() {
    if (!apiBase) {
      setStatus(
        "GitHub linking requires the API. Set apiBase in js/config.js to your Vercel deployment URL (not the GitHub Pages URL), then reload.",
        "error"
      );
      return;
    }

    const loginUrl = new URL(`${apiBase}/api/auth/login`);
    loginUrl.searchParams.set("return_to", siteReturnTo);
    window.location.assign(loginUrl.toString());
  }

  function showUnauthenticated() {
    els.userPanel?.setAttribute("hidden", "");
    els.openMyCodespace?.setAttribute("hidden", "");
    els.linkGithub?.removeAttribute("hidden");
  }

  function showAuthenticated(user) {
    els.userPanel?.removeAttribute("hidden");
    els.openMyCodespace?.removeAttribute("hidden");
    els.linkGithub?.setAttribute("hidden", "");
    if (els.userAvatar) els.userAvatar.src = user.avatarUrl;
    if (els.userAvatar) els.userAvatar.alt = `${user.login} avatar`;
    if (els.userLogin) els.userLogin.textContent = user.login;
  }

  async function fetchMe() {
    const { res, data } = await apiFetchJson("/api/auth/me");
    if (!res.ok || !data.authenticated) return null;
    return data;
  }

  async function handleRepoAfterLink() {
    setStatus("Checking your GitHub repository…", "loading");

    try {
      const { res, data } = await apiFetchJson("/api/repo/status");
      if (!res.ok) throw new Error(data.error || "Could not check repository status");

      if (!data.exists) {
        setStatus("Copying the repository to your GitHub account…", "loading");
        const forkResult = await apiFetchJson("/api/repo/fork", { method: "POST" });
        if (!forkResult.res.ok) {
          throw new Error(forkResult.data.error || "Could not create fork");
        }
        setStatus(
          "Repository copied to your account. You can open it in a Codespace when ready.",
          "ready"
        );
        return;
      }

      if (!data.isFork) {
        setStatus(
          `You already have a repository named "${cfg.repo}" that is not a fork of ${slug}. Rename or remove it, then link again.`,
          "error"
        );
        return;
      }

      if (data.upToDate) {
        setStatus("Your copy is up to date with the team repository.", "ready");
        return;
      }

      if (els.syncDialogMessage) {
        els.syncDialogMessage.textContent =
          "Your fork is behind the team repository. Do you want to update your copy with the latest changes?";
      }
      els.syncDialog?.showModal();
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong while checking your repository.", "error");
    }
  }

  async function syncUserFork() {
    setStatus("Updating your copy from the team repository…", "loading");

    try {
      const { res, data } = await apiFetchJson("/api/repo/sync", { method: "POST" });
      if (!res.ok) throw new Error(data.error || "Could not update repository");
      setStatus("Your copy is now up to date with the team repository.", "ready");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Could not update your repository.", "error");
    }
  }

  async function openMyForkCodespace() {
    if (!apiBase) {
      setStatus("Link GitHub and configure the API before opening a Codespace on your fork.", "error");
      return;
    }

    setBusy(els.openMyCodespace, true);
    setStatus("Starting a Codespace on your fork…", "loading");

    try {
      const { res, data } = await apiFetchJson("/api/workspace", { method: "POST" });
      if (!res.ok) throw new Error(data.error || "Could not create Codespace");

      setStatus("Opening your Codespace…", "ready");
      if (data.codespaceUrl) {
        openInNewTab(data.codespaceUrl);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Could not open your Codespace.", "error");
    } finally {
      setBusy(els.openMyCodespace, false);
    }
  }

  async function disconnect() {
    if (!apiBase) return;

    setBusy(els.disconnect, true);
    try {
      await apiFetchJson("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(els.disconnect, false);
      showUnauthenticated();
      setStatus("Disconnected from GitHub.", "");
    }
  }

  function apiFetch(path, options = {}) {
    return fetch(`${apiBase}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  }

  async function apiFetchJson(path, options = {}) {
    const res = await apiFetch(path, options);
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        throw new Error(
          "API returned a web page instead of JSON. Set apiBase in js/config.js to your Vercel API URL — not your GitHub Pages site URL."
        );
      }
      throw new Error(text.slice(0, 160) || `Request failed (${res.status})`);
    }

    const data = await res.json();
    return { res, data };
  }
})();
