import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.showWebview', () => {
            // Create a new webview panel
            const panel = vscode.window.createWebviewPanel(
                'myWebview', // Identifier for the webview
                'My Webview', // Title of the webview
                vscode.ViewColumn.One, // Editor column to show the webview in
                {
                    enableScripts: true, // Allow running scripts in the webview
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'out')),
                    ], // Allow access to bundled files
                }
            );

            // Get the path to the bundled script
            const scriptPath = panel.webview.asWebviewUri(
                vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview.js'))
            );

            // Set the HTML content of the webview
            panel.webview.html = getWebviewContent(scriptPath);
        })
    );
}

// Helper function to generate HTML content
function getWebviewContent(scriptPath: vscode.Uri): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Webview</title>
        </head>
        <body>
            <div id="app"></div>
            <script src="${scriptPath}"></script>
        </body>
        </html>
    `;
}
