# Vita keyboard shortcuts

**`.vscode/keybindings.json` is not loaded by VS Code or GitHub Codespaces.** There is no setting to turn this on — workspace keybindings are not supported (only user keybindings are).

In a Codespace, shortcuts are installed automatically into your **user** keybindings when the container attaches (`scripts/install-keybindings.js` via `devcontainer.json`).

If `Ctrl+Shift+~` still does not work:

1. Click **[Open Index](../docs/Index.md)** in Markdown preview (always works).
2. Use **Quick Open** (`Ctrl+P` / `Cmd+P`) and type `Index`.
3. The browser may steal shortcuts when focus is outside the editor — click inside the editor first.
4. Run **Developer: Reload Window** after the Codespace first starts so keybindings apply.

To add shortcuts manually: **Ctrl+Shift+P** → **Preferences: Open Keyboard Shortcuts (JSON)**.
