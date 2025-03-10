import * as vscode from "vscode";
import * as path from "path";
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { FETCH_COMPONENT_VERSIONS_QUERY, FETCH_DYNAMIC_PROJECTS_QUERY, FETCH_PROJECT_GRAPH_QUERY } from "./queries";

/**
 * Represents a single item in the projects tree view.
 */
class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly parent?: string,
    public readonly contextValue?: string,
    public readonly id?: string,
    public readonly isButton: boolean = false
  ) {
    super(label, collapsibleState);

    if (isButton) {
      // Style for button items
      this.iconPath = new vscode.ThemeIcon("graph");
      this.command = {
        command: "projectsView.showProjectGraph",
        title: "Show Graph",
        arguments: [parent] // Pass the project ID as an argument
      };
    } else {
      // Regular item styling
      this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;
      this.iconPath = new vscode.ThemeIcon(
        collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
      );
    }

    this.contextValue = contextValue;
  }
}

/**
 * Provides project data for the VS Code tree view.
 */
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | null | void
  > = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // We store the fetched projects here so other providers can access them.
  public dynamicProjects: {
    id: string;
    name: string;
    components: {
      id: string;
      name: string;
      description: string;
      version: number;
      issues: { id: string; title: string; type: { name: string } }[];
    }[];
    issues: { id: string; title: string }[];
  }[] = [];

  constructor(private apiClient: APIClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async fetchDynamicProjects(): Promise<void> {
    const query = FETCH_DYNAMIC_PROJECTS_QUERY;
    try {
      const response = await this.apiClient.executeQuery(query);
      if (!response.data || !response.data.projects) {
        throw new Error("Projects data is missing or in an unexpected format.");
      }
      this.dynamicProjects = response.data.projects.nodes.map((project: any) => ({
        id: project.id,
        name: project.name,
        issues: project.issues.nodes.map((issue: any) => ({
          id: issue.id,
          title: issue.title
        })),
        components: project.components.nodes.map((componentNode: any) => ({
          id: componentNode.component.id,
          name: componentNode.component.name,
          description: componentNode.component.description,
          version: componentNode.version,
          issues: componentNode.component.issues.nodes.map((issue: any) => ({
            id: issue.id,
            title: issue.title,
            type: issue.type
          }))
        }))
      }));
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fetch dynamic projects: ${this.getErrorMessage(error)}`
      );
    }
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
    if (!element) {
      const dynamicProjectItems = this.dynamicProjects.map(
        (project) =>
          new ProjectItem(
            project.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            project.id
          )
      );
      return Promise.resolve(dynamicProjectItems);
    }

    const dynamicProject = this.dynamicProjects.find(
      (proj) => proj.name === element.label || proj.id === element.parent
    );

    if (dynamicProject) {
      if (element.label === "Component Versions") {
        return Promise.resolve(
          dynamicProject.components.map(
            (component) =>
              new ProjectItem(
                `v${component.version} ${component.name}`,
                vscode.TreeItemCollapsibleState.None,
                {
                  command: "extension.editComponentDetails",
                  title: "Edit Component Details",
                  arguments: [component]
                },
                dynamicProject.id,
                "component"
              )
          )
        );
      } else if (element.label === "Issues") {
        return Promise.resolve(
          dynamicProject.issues.map(
            (issue) =>
              new ProjectItem(
                issue.title,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                dynamicProject.id,
                "issue"
              )
          )
        );
      } else {
        return Promise.resolve([
          new ProjectItem(
            "Component Versions",
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            dynamicProject.id
          ),
          new ProjectItem(
            "Issues",
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            dynamicProject.id
          ),
          new ProjectItem(
            "Show Graph",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            dynamicProject.id,
            undefined,
            undefined,
            true
          )
        ]);
      }
    }
    return Promise.resolve([]);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return typeof error === "string" ? error : "An unknown error occurred";
  }
}

/**
 * Provides a new Components View that lists all components from all projects.
 */
export class ComponentVersionsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentsView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) {}

  // Called by VS Code when it needs to display the webview.
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Set the HTML that loads the Vue bundle (componentsView.js)
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Listen for messages from the Vue app.
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendComponents();
      }
    });
  }

  // Builds the HTML for the view – note the reference to the bundled script.
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
        <title>Components</title>
      </head>
      <body style="padding:0;margin:0;">
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  // Queries the server for all components and sends the list to the webview.
  public async fetchAndSendComponents() {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSIONS_QUERY);
      if (!response.data || !response.data.components) {
        throw new Error("No components data received.");
      }
      const components = response.data.components.nodes;
      this._view?.webview.postMessage({
        command: "updateComponents",
        data: components
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch components: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * Provides the Component Details view as a webview in the Explorer.
 */
export class ComponentDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentDetailsView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient,
    private readonly projectsProvider: ProjectsProvider
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "vueAppReady") {
        // Vue app mounted – could send initial state if desired.
      } else if (message.command === "updateComponent") {
        const updated = message.data;
        try {
          await this.apiClient.updateComponentDetails(
            updated.id,
            updated.name,
            updated.description
          );
          await this.projectsProvider.fetchDynamicProjects();
          vscode.window.showInformationMessage(
            `Component updated successfully: ${updated.name}`
          );
        } catch (error: any) {
          vscode.window.showErrorMessage(
            `Failed to update component: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    });
  }

  public updateComponentDetails(component: any) {
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateComponentDetails",
        data: component
      });
    } else {
      vscode.window.showErrorMessage("Component Details view is not available.");
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "componentDetails.js"
      )
    );
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>Component Details</title>
      </head>
      <body style="padding:0;margin:0;">
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
}

function getGraphEditorHtml(scriptUri: vscode.Uri): string {
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

function createGraphEditorPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "graphEditor",
    "Graph Editor",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "out", "webview")
      ]
    }
  );
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "webview", "graphEditor.js")
  );
  panel.webview.html = getGraphEditorHtml(scriptUri);
  return panel;
}

export function activate(context: vscode.ExtensionContext) {
  const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
  const projectsProvider = new ProjectsProvider(apiClient);

  const componentDetailsViewProvider = new ComponentDetailsViewProvider(
    context,
    apiClient,
    projectsProvider
  );
  const componentVersionsProvider = new ComponentVersionsProvider (
    context,
    apiClient
  );

  async function showGraphForProject(projectId: string) {
    const panel = createGraphEditorPanel(context);
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "ready") {
        try {
          await apiClient.authenticate();
          const projectData = await fetchProjectGraphData(projectId);
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

  async function fetchProjectGraphData(projectId: string) {
    const query = FETCH_PROJECT_GRAPH_QUERY;
    try {
      await apiClient.authenticate();
      const response = await apiClient.executeQuery(query, { project: projectId });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch project graph: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Command to open the Graph Editor
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async () => {
      const panel = createGraphEditorPanel(context);
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === "ready") {
          try {
            await apiClient.authenticate();
            const projectId = message.projectId;
            const projectData = await fetchProjectGraphData(projectId);
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
    })
  );

  // Register the tree data provider for projects
  vscode.window.registerTreeDataProvider("projectsView", projectsProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("projectsView.refresh", async () => {
      await apiClient.authenticate();
      await projectsProvider.fetchDynamicProjects();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("projectsView.showProjectGraph", (projectId: string) => {
      showGraphForProject(projectId);
    })
  );

  // When a component is clicked, update the Component Details view
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.editComponentDetails", (component) => {
      if (!component) {
        vscode.window.showErrorMessage("No component data found to open.");
        return;
      }
      componentDetailsViewProvider.updateComponentDetails(component);
      vscode.commands.executeCommand("workbench.view.explorer");
    })
  );

  // Register the Explorer-based webviews
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "componentDetailsView",
      componentDetailsViewProvider
    )
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "componentVersions",
      componentVersionsProvider
    )
  );

  // Initial load of projects
  apiClient
    .authenticate()
    .then(() => projectsProvider.fetchDynamicProjects())
    .catch((error) =>
      vscode.window.showErrorMessage(
        `Initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    );
}
