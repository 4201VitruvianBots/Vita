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
  };

  const els = {
    status: document.getElementById("status"),
    linkGithub: document.getElementById("link-github"),
    startWorkspace: document.getElementById("start-workspace"),
    disconnect: document.getElementById("disconnect"),
    userPanel: document.getElementById("user-panel"),
    userAvatar: document.getElementById("user-avatar"),
    userLogin: document.getElementById("user-login"),
    authSection: document.getElementById("auth-section"),
    workspaceSection: document.getElementById("workspace-section"),
    repoLink: document.getElementById("repo-link"),
  };

  els.repoLink?.setAttribute("href", urls.repo);

  els.linkGithub?.addEventListener("click", () => linkGitHub());
  els.startWorkspace?.addEventListener("click", () => provisionWorkspace());
  els.disconnect?.addEventListener("click", () => disconnect());

  init();

  async function init() {
    if (!apiBase) {
      setStatus(
        "Set apiBase in js/config.js to your deployed API URL, then reload.",
        "error"
      );
      els.linkGithub?.setAttribute("disabled", "true");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setStatus(`GitHub sign-in failed: ${decodeURIComponent(authError)}`, "error");
      cleanAuthParams();
    }

    const user = await fetchMe();
    if (user) {
      showAuthenticated(user);
      if (params.get("auth") === "linked") {
        cleanAuthParams();
        await provisionWorkspace();
      }
    } else {
      showUnauthenticated();
    }
  }

  function resolveApiBase(configured) {
    if (configured) return configured.replace(/\/$/, "");
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.origin;
    }
    return null;
  }

  function cleanAuthParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.pathname + url.hash);
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

  function openUrl(url) {
    window.location.href = url;
  }

  function showUnauthenticated() {
    els.authSection?.removeAttribute("hidden");
    els.workspaceSection?.setAttribute("hidden", "");
    els.userPanel?.setAttribute("hidden", "");
    setStatus(
      "Link your GitHub account to fork this project into your account and open a Codespace.",
      ""
    );
  }

  function showAuthenticated(user) {
    els.authSection?.setAttribute("hidden", "");
    els.workspaceSection?.removeAttribute("hidden");
    els.userPanel?.removeAttribute("hidden");
    if (els.userAvatar) els.userAvatar.src = user.avatarUrl;
    if (els.userAvatar) els.userAvatar.alt = `${user.login} avatar`;
    if (els.userLogin) els.userLogin.textContent = user.login;
    setStatus("GitHub account linked. Start your workspace when you are ready.", "ready");
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

  function linkGitHub() {
    const loginUrl = new URL(`${apiBase}/api/auth/login`);
    loginUrl.searchParams.set("return_to", siteReturnTo);
    openUrl(loginUrl.toString());
  }

  async function provisionWorkspace() {
    setBusy(els.startWorkspace, true);
    setStatus("Forking the repository to your GitHub account…", "loading");

    try {
      const res = await apiFetch("/api/workspace", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not create workspace");
      }

      setStatus("Codespace is starting. Opening VS Code in your browser…", "ready");
      if (data.codespaceUrl) {
        window.open(data.codespaceUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong while creating your workspace.", "error");
    } finally {
      setBusy(els.startWorkspace, false);
    }
  }

  async function disconnect() {
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
