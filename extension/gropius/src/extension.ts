// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path from 'path';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Register the command
	let disposable = vscode.commands.registerCommand('gropius.helloWorld', () => {
  
	  const panel = vscode.window.createWebviewPanel(
		'vueApp', // The unique identifier for the webview
		'Vue App', // The title of the webview panel
		vscode.ViewColumn.One, // Position of the webview
		{ enableScripts: true } // Allow JavaScript to run in the webview
	  );
  
	  // Path to the bundled Vue app JavaScript
	  const scriptPath = vscode.Uri.file(
		path.join(context.extensionPath, 'dist', 'extension.js') // Change 'main.js' to 'extension.js'
	  ).with({ scheme: 'vscode-resource' });
  
	  // Set the HTML content for the webview
	  panel.webview.html = `
		<!DOCTYPE html>
		<html lang="en">
		  <head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Vue Webview</title>
		  </head>
		  <body>
			<div id="app"></div>
			<script src="${scriptPath}"></script>
		  </body>
		</html>
	  `;
	});
  
	context.subscriptions.push(disposable);
  }
// This method is called when your extension is deactivated
export function deactivate() { }
