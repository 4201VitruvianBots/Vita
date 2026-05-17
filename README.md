# Vita

Homepage for [4201VitruvianBots/Vita](https://github.com/4201VitruvianBots/Vita), deployed on GitHub Pages. The site launches a browser-based VS Code workspace for this repository.

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

## GitHub Pages

1. In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`; the [Deploy GitHub Pages](.github/workflows/pages.yml) workflow publishes the site.

## VS Code options

| Button | What it does |
|--------|----------------|
| **Launch VS Code** | Opens [vscode.dev](https://vscode.dev) with this repo (default). |
| **Quick edit** | Same as above, explicit shortcut. |
| **Full environment** | Creates a [GitHub Codespace](https://github.com/features/codespaces) with a full VM. |

GitHub Pages is static-only, so a dedicated [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) or [code-server](https://github.com/coder/code-server) instance must run elsewhere. To wire that up, set `serverApi` in [`js/config.js`](js/config.js) to your orchestration API base URL; the homepage will `POST /session` and open the returned workspace URL.