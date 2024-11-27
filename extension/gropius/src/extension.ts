// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path from 'path';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('gropius.helloWorld', () => {
	  const panel = vscode.window.createWebviewPanel(
		'gropius.helloWorld', // Internal identifier of the webview
		'Gropius Vue App', // Title of the tab
		vscode.ViewColumn.One, // Where to display the webview (side-by-side with the editor)
		{
		  enableScripts: true, // Enable running JavaScript in the webview
		}
	  );
  
	  // Get the URI for the index.html
	  const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview', 'index.html')));
	  
	  // Update the paths to the JS files to make sure they are correctly loaded by the webview
	  panel.webview.html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
		  <meta charset="UTF-8">
		  <meta name="viewport" content="width=device-width, initial-scale=1.0">
		  <title>Gropius Vue App</title>
		  <script defer="defer" src="${panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview', 'js', 'chunk-vendors.js')))}"></script>
		  <script defer="defer" src="${panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview', 'js', 'app.js')))}"></script>
		</head>
		<body>
		  <noscript>
			<strong>We're sorry but webview-src doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
		  </noscript>
		  <div id="app"></div>
		</body>
		</html>
	  `;
	});
  
	context.subscriptions.push(disposable);
  }
// This method is called when your extension is deactivated
export function deactivate() { }
