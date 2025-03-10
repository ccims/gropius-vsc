import * as vscode from "vscode";
import { GropiusComponentVersionsProvider } from './webview/GropiusComponentVersionsProvider';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import {
  FETCH_COMPONENT_VERSIONS_QUERY,
  FETCH_DYNAMIC_PROJECTS_QUERY,
  FETCH_PROJECT_GRAPH_QUERY
} from "./queries";

// -----------------------------------------------------------------
// Global API client instance used by both views.
const globalApiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);

// -----------------------------------------------------------------
// activate() registers the two views.
export function activate(context: vscode.ExtensionContext) {
  // Register the Component Versions webview.
  const componentVersionsProvider = new ComponentVersionsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentVersions", componentVersionsProvider)
  );

  // Register the Graphs webview (using the view id "graphs").
  const graphsProvider = new GraphsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("graphs", graphsProvider)
  );

  // Optional: register a command to open the Graph Editor directly.
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async (projectId: string) => {
      await graphsProvider.openGraphEditor(projectId);
    })
  );
}

// -----------------------------------------------------------------
// ComponentVersionsProvider: Provides a webview that lists all components.
// It queries the server using FETCH_COMPONENT_VERSIONS_QUERY and sends
// the list via postMessage (with command "updateComponentVersions").
export class ComponentVersionsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentVersions";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendComponentVersions();
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "componentVersions.js"
      )
    );
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <title>Component Versions</title>
        </head>
        <body style="padding:0;margin:0;">
          <div id="app"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private async fetchAndSendComponentVersions() {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSIONS_QUERY);
      if (!response.data || !response.data.components) {
        throw new Error("No component data received.");
      }
      const components = response.data.components.nodes;
      this._view?.webview.postMessage({
        command: "updateComponentVersions",
        data: components
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component versions: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

// -----------------------------------------------------------------
// GraphsProvider: Provides a webview with a Vue UI that displays a list
// of projects (fetched using FETCH_DYNAMIC_PROJECTS_QUERY). Each project is
// rendered with a button; when clicked the button opens the Graph Editor.
// All functions for opening the graph editor are encapsulated here.
export class GraphsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "graphs";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendProjects();
      } else if (message.command === "showGraph") {
        const projectId = message.projectId;
        // Now openGraphEditor is public.
        this.openGraphEditor(projectId);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "graphs.js"
      )
    );
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <title>Graphs</title>
        </head>
        <body style="padding:0;margin:0;">
          <div id="app"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private async fetchAndSendProjects() {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_DYNAMIC_PROJECTS_QUERY);
      if (!response.data || !response.data.projects) {
        throw new Error("No projects data received.");
      }
      const projects = response.data.projects.nodes;
      this._view?.webview.postMessage({
        command: "updateProjects",
        data: projects
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch projects: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Make openGraphEditor public so it can be called externally.
  public async openGraphEditor(projectId: string) {
    // Create the Graph Editor panel.
    const panel = vscode.window.createWebviewPanel(
      "graphEditor",
      "Graph Editor",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "out", "webview")
        ]
      }
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "graphEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "ready") {
        try {
          await this.apiClient.authenticate();
          const projectData = await this.fetchProjectGraphData(projectId);
          panel.webview.postMessage({
            type: "projectData",
            data: projectData
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
        }
      }
    });

    panel.reveal(vscode.ViewColumn.One);
  }

  private async fetchProjectGraphData(projectId: string) {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_PROJECT_GRAPH_QUERY, {
        project: projectId
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch project graph: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getGraphEditorHtml(scriptUri: vscode.Uri): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Graph Editor</title>
          <style>
            html, body {
              height: 100vh;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            #app {
              height: 100vh;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div id="app"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}

// -----------------------------------------------------------------
// activate() registers the two views.
export function activate(context: vscode.ExtensionContext) {
  // Register the Component Versions webview.
  const componentVersionsProvider = new ComponentVersionsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentVersions", componentVersionsProvider)
  );

  // Register the Graphs webview (using the view id "graphs").
  const graphsProvider = new GraphsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("graphs", graphsProvider)
  );

  // Optional: register a command to open the Graph Editor directly.
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async (projectId: string) => {
      await graphsProvider.openGraphEditor(projectId);
    })
  );
}
