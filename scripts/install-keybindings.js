#!/usr/bin/env node
/**
 * Installs Vita navigation shortcuts into the remote user keybindings file.
 * Workspace .vscode/keybindings.json is not loaded by VS Code/Codespaces.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const VITA_BINDINGS = [
  {
    key: "ctrl+shift+`",
    command: "vscode.open",
    args: "${workspaceFolder}/docs/Index.md",
  },
  {
    key: "cmd+shift+`",
    command: "vscode.open",
    args: "${workspaceFolder}/docs/Index.md",
  },
];

const USER_DIRS = [
  path.join(os.homedir(), ".vscode-remote", "data", "User"),
  path.join(os.homedir(), ".vscode-server", "data", "User"),
  path.join(os.homedir(), ".local/share/code/User"),
];

function loadJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function bindingKey(binding) {
  return `${binding.key}|${binding.command}|${JSON.stringify(binding.args ?? null)}`;
}

function install() {
  for (const dir of USER_DIRS) {
    const parent = path.dirname(dir);
    if (!fs.existsSync(parent)) continue;

    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "keybindings.json");
    const existing = loadJsonArray(file);
    const seen = new Set(existing.map(bindingKey));

    let changed = false;
    for (const binding of VITA_BINDINGS) {
      if (!seen.has(bindingKey(binding))) {
        existing.push(binding);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`);
      console.log(`Vita: added keybindings to ${file}`);
    } else {
      console.log(`Vita: keybindings already present in ${file}`);
    }
    return;
  }

  console.warn("Vita: could not find a VS Code user settings directory for keybindings.");
}

install();
