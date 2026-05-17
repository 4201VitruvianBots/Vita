# Vita

Homepage for [4201VitruvianBots/Vita](https://github.com/4201VitruvianBots/Vita). New users opening a Codespace should start with **[Welcome.md](Welcome.md)**. Users link their GitHub account, fork the repository into their account, and launch a VS Code Codespace on their fork.

## Architecture

| Part | Host | Role |
|------|------|------|
| Static site | GitHub Pages | Landing page and UI |
| API (`/api/*`) | [Vercel](https://vercel.com) | GitHub OAuth, fork repo, create Codespace |

GitHub Pages cannot run OAuth or call the GitHub API with secrets, so the API is deployed separately (same repo, Vercel project).

## One-time setup

### 1. GitHub OAuth App

Create an app at [github.com/settings/developers](https://github.com/settings/developers):

- **Homepage URL:** `https://4201vitruvianbots.github.io/Vita`
- **Authorization callback URL:** `https://YOUR-API.vercel.app/api/auth/callback`

### 2. Deploy API to Vercel

```bash
npm install
npx vercel link
npx vercel env add GITHUB_CLIENT_ID
npx vercel env add GITHUB_CLIENT_SECRET
npx vercel env add SESSION_SECRET
npx vercel env add SITE_URL
npx vercel env add API_URL
npx vercel deploy --prod
```

Use these values:

| Variable | Example |
|----------|---------|
| `SITE_URL` | `https://4201vitruvianbots.github.io/Vita` |
| `API_URL` | `https://your-project.vercel.app` |
| `SESSION_SECRET` | Random 32+ char string |
| `SOURCE_OWNER` | `4201VitruvianBots` (optional) |
| `SOURCE_REPO` | `Vita` (optional) |

### 3. Configure the static site

Set `apiBase` in [`js/config.js`](js/config.js) to your Vercel URL (no trailing slash):

```js
apiBase: "https://your-project.vercel.app",
```

### 4. Enable GitHub Pages

Repo **Settings → Pages → Source:** GitHub Actions (workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

## User flow

1. **Start Codespace** — Opens a read-only [VS Code for the Web](https://vscode.dev) session on the team repository (no API required).
2. **Link GitHub account** — OAuth with `public_repo` and `codespace` scopes.
3. **Fork** — If the user does not have a fork, the API creates one automatically.
4. **Sync** — If their fork exists but is behind upstream, they are asked whether to update it.
5. **Open my fork** — After linking, users can start a writable Codespace on their own fork.

## Local development

```bash
cp .env.example .env
# Fill in OAuth credentials; set SITE_URL and API_URL to http://localhost:3000

npm install
npm run dev
```

Open `http://localhost:3000`. OAuth callback and API share the same origin locally.

## Requirements

- Users need [GitHub Codespaces](https://github.com/features/codespaces) enabled on their account/org.
- The source repository must be forkable (public, or user has access).
