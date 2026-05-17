(function () {
  const cfg = window.VITA_CONFIG;
  if (!cfg?.owner || !cfg?.repo) {
    console.error("VITA_CONFIG is missing owner or repo.");
    return;
  }

  const slug = `${cfg.owner}/${cfg.repo}`;
  const branch = cfg.branch || "main";

  const urls = {
    vscodeDev: `https://vscode.dev/github/${slug}/tree/${branch}`,
    githubDev: `https://github.dev/${slug}/blob/${branch}/`,
    codespaces: `https://github.com/codespaces/new?hide_repo_select=true&ref=${encodeURIComponent(branch)}&repo=${encodeURIComponent(slug)}`,
    repo: `https://github.com/${slug}`,
  };

  const els = {
    status: document.getElementById("status"),
    launch: document.getElementById("launch"),
    quickOpen: document.getElementById("quick-open"),
    codespace: document.getElementById("codespace"),
    repoLink: document.getElementById("repo-link"),
  };

  els.quickOpen?.addEventListener("click", () => openUrl(urls.vscodeDev));
  els.codespace?.addEventListener("click", () => openUrl(urls.codespaces));
  els.repoLink?.setAttribute("href", urls.repo);

  els.launch?.addEventListener("click", () => startSession());

  function setStatus(message, state) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.state = state || "";
  }

  function setBusy(busy) {
    els.launch?.toggleAttribute("disabled", busy);
    els.launch?.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function openUrl(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function startSession() {
    if (cfg.serverApi) {
      await startRemoteSession(cfg.serverApi);
      return;
    }
    setStatus("Opening VS Code in your browser…", "loading");
    openUrl(urls.vscodeDev);
    setStatus("VS Code should open in a new tab. Sign in to GitHub if prompted.", "ready");
  }

  async function startRemoteSession(apiBase) {
    setBusy(true);
    setStatus("Starting VS Code Server…", "loading");

    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: slug,
          branch,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (!data?.url) {
        throw new Error("No workspace URL returned");
      }

      const target = data.token
        ? `${data.url}${data.url.includes("?") ? "&" : "?"}tkn=${encodeURIComponent(data.token)}`
        : data.url;

      setStatus("VS Code Server is ready. Opening workspace…", "ready");
      openUrl(target);
    } catch (err) {
      console.error(err);
      setStatus(
        "Could not reach the VS Code Server API. Opening vscode.dev instead.",
        "error"
      );
      openUrl(urls.vscodeDev);
    } finally {
      setBusy(false);
    }
  }
})();
