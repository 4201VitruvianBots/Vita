const vscode = require("vscode");
const path = require("path");

const INDEX_RELATIVE_PATH = path.join("docs", "Index.md");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("vita.returnToIndex", async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        vscode.window.showErrorMessage("Vita: No workspace folder is open.");
        return;
      }

      const indexUri = vscode.Uri.joinPath(folder.uri, INDEX_RELATIVE_PATH);

      try {
        await vscode.workspace.fs.stat(indexUri);
      } catch {
        vscode.window.showErrorMessage("Vita: docs/Index.md was not found in this workspace.");
        return;
      }

      await vscode.commands.executeCommand(
        "vscode.openWith",
        indexUri,
        "vscode.markdown.preview.editor",
        { viewColumn: vscode.ViewColumn.Active }
      );
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
