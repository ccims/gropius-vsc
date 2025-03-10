import * as vscode from "vscode";
import * as path from "path";
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import {
  FETCH_COMPONENT_VERSIONS_QUERY,
  FETCH_DYNAMIC_PROJECTS_QUERY,
  FETCH_PROJECT_GRAPH_QUERY
} from "./queries";

// -----------------------------------------------------------------
// Global API client instance used by all providers.
const globalApiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);

// -----------------------------------------------------------------
// ComponentVersionsProvider: Provides a webview that lists all component versions.
// It queries the server using FETCH_COMPONENT_VERSIONS_QUERY and sends the list
// via postMessage with command "updateComponentVersions". When a component is clicked,
// it sends its component id to trigger the issues view.
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

    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendComponentVersions();
      } else if (message.command === "selectComponent") {
        const componentId = message.componentId;
        vscode.commands.executeCommand("extension.showComponentIssues", componentId);
      }
      return;
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

  private async fetchAndSendComponentVersions(): Promise<void> {
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
        `Failed to fetch component versions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// ComponentIssuesProvider: Provides a webview that lists issues for a single component.
// When a component is selected (its id is sent via the "extension.showComponentIssues" command),
// this provider queries all components using FETCH_COMPONENT_VERSIONS_QUERY, finds the component
// with that id, and sends its issues via postMessage (command "updateComponentIssues").
export class ComponentIssuesProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentIssues";
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

    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        // Do nothing until a component is selected.
      }
      return;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "componentIssues.js"
      )
    );
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <title>Component Issues</title>
        </head>
        <body style="padding:0;margin:0;">
          <div id="app"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  public async updateIssues(componentId: string): Promise<void> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSIONS_QUERY);
      if (!response.data || !response.data.components) {
        throw new Error("No component data received.");
      }
      const components: any[] = response.data.components.nodes;
      // Find the component that matches the given componentId.
      const component = components.find((c: any): boolean => c.id === componentId);
      // If found, extract its issues; otherwise, use an empty array.
      const issues = component ? component.issues.nodes : [];
      this._view?.webview.postMessage({
        command: "updateComponentIssues",
        data: issues
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component issues: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// -----------------------------------------------------------------
// GraphsProvider: Provides a webview with a Vue UI that displays a list
// of projects (using FETCH_DYNAMIC_PROJECTS_QUERY). Each project is rendered
// with a button; when clicked, it opens the Graph Editor.
// All helper functions for the Graph Editor are encapsulated within this provider.
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

    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendProjects();
      } else if (message.command === "showGraph") {
        const projectId = message.projectId;
        this.openGraphEditor(projectId);
      }
      return;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "graphs.js")
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

  private async fetchAndSendProjects(): Promise<void> {
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
        `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public async openGraphEditor(projectId: string): Promise<void> {
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

    panel.webview.onDidReceiveMessage((message: any): void => {
      if (message.type === "ready") {
        (async () => {
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
        })();
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
  }

  private async fetchProjectGraphData(projectId: string): Promise<any> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_PROJECT_GRAPH_QUERY, { project: projectId });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch project graph: ${error instanceof Error ? error.message : "Unknown error"}`
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
// activate() registers the three views and commands.
export function activate(context: vscode.ExtensionContext): void {
  // Register the Component Versions webview.
  const componentVersionsProvider = new ComponentVersionsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentVersions", componentVersionsProvider)
  );

  // Register the Graphs webview.
  const graphsProvider = new GraphsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("graphs", graphsProvider)
  );

  // Register the Component Issues webview.
  const componentIssuesProvider = new ComponentIssuesProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentIssues", componentIssuesProvider)
  );

  // Register a command to update the Component Issues view when a component is selected.
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showComponentIssues", async (componentId: string): Promise<void> => {
      await componentIssuesProvider.updateIssues(componentId);
    })
  );

  // Optional: register a command to open the Graph Editor directly.
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async (projectId: string): Promise<void> => {
      await graphsProvider.openGraphEditor(projectId);
    })
  );
}
