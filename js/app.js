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
    readOnlyCodespace: buildReadOnlyCodespaceUrl(),
    vscodeDev: `https://vscode.dev/github/${slug}/tree/${branch}`,
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
  els.startWorkspace?.addEventListener("click", () => startReadOnlyCodespace());
  els.linkGithub?.addEventListener("click", () => linkGitHub());
  els.openMyCodespace?.addEventListener("click", () => openMyForkCodespace());
  els.disconnect?.addEventListener("click", () => disconnect());

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

  function resolveApiBase(configured) {
    const meta = document.querySelector('meta[name="vita-api-base"]')?.content?.trim();
    const base = configured || meta || null;
    if (base) return base.replace(/\/$/, "");
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.origin;
    }
    return null;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");

    if (authError) {
      setStatus(`GitHub sign-in failed: ${decodeURIComponent(authError)}`, "error");
      cleanAuthParams();
    } else if (!apiBase) {
      setStatus(
        "Start Codespace works now. To link GitHub, set apiBase in js/config.js (or the vita-api-base meta tag) to your deployed API URL.",
        ""
      );
    }

    if (!apiBase) {
      return;
    }

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
      window.location.href = url;
    }
  }

  function startReadOnlyCodespace() {
    setStatus(
      "Opening a read-only Codespace on the team repository. You cannot push changes to the upstream repo.",
      "loading"
    );
    openInNewTab(urls.readOnlyCodespace);
    setStatus(
      "GitHub should open in a new tab to create a read-only Codespace. Sign in if prompted. No Codespaces? Use the read-only editor at vscode.dev/github/" +
        slug +
        "/tree/" +
        branch,
      "ready"
    );
  }

  function linkGitHub() {
    if (!apiBase) {
      setStatus(
        "GitHub linking requires the API. Set apiBase in js/config.js to your Vercel deployment URL, then reload.",
        "error"
      );
      return;
    }

    const loginUrl = new URL(`${apiBase}/api/auth/login`);
    loginUrl.searchParams.set("return_to", siteReturnTo);
    window.location.href = loginUrl.toString();
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
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) return null;
      const data = await res.json();
      return data.authenticated ? data : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async function handleRepoAfterLink() {
    setStatus("Checking your GitHub repository…", "loading");

    try {
      const res = await apiFetch("/api/repo/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not check repository status");

      if (!data.exists) {
        setStatus("Copying the repository to your GitHub account…", "loading");
        const forkRes = await apiFetch("/api/repo/fork", { method: "POST" });
        const forkData = await forkRes.json();
        if (!forkRes.ok) throw new Error(forkData.error || "Could not create fork");
        setStatus(
          `Repository copied to your account. You can open it in a Codespace when ready.`,
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
      const res = await apiFetch("/api/repo/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update repository");

      setStatus("Your copy is now up to date with the team repository.", "ready");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Could not update your repository.", "error");
    }
  }

  async function openMyForkCodespace() {
    if (!apiBase) return;

    setBusy(els.openMyCodespace, true);
    setStatus("Starting a Codespace on your fork…", "loading");

    try {
      const res = await apiFetch("/api/workspace", { method: "POST" });
      const data = await res.json();
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
      await apiFetch("/api/auth/logout", { method: "POST" });
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
})();
