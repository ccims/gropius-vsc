import * as vscode from "vscode";
import { exec } from 'child_process';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { loadConfigurations } from './mapping/config-loader';
import {
  FETCH_COMPONENT_VERSIONS_QUERY,
  FETCH_DYNAMIC_PROJECTS_QUERY,
  FETCH_PROJECT_GRAPH_QUERY,
  GET_ISSUES_OF_COMPONENT_VERSION_QUERY,
  GET_ISSUE_DETAILS,
  FETCH_COMPONENT_VERSION_BY_ID_QUERY,
  GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY,
  CREATE_ARTIFACT_MUTATION,
  GET_ARTIFACTS_FOR_ISSUE,
  ADD_ARTIFACT_TO_ISSUE_MUTATION
} from "./queries";

// Create a single, global API client instance
const globalApiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);

/**
 * Interface for component tree items in the Gropius Component Versions provider
 */
interface ComponentTreeItem {
  id?: string;
  componentVersionIds?: string[];
  name: string;
  description?: string;
  versions?: string[];
  children?: ComponentTreeItem[];
  expanded: boolean;
}

/**
 * Registers all providers and commands in VS Code
 */
export function activate(context: vscode.ExtensionContext) {
  // 1) Register the Gropius Component Versions view
  const gropiusComponentVersionsProvider = new GropiusComponentVersionsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GropiusComponentVersionsProvider.viewType,
      gropiusComponentVersionsProvider
    )
  );

  // 2) Register the "Component Issues" view
  const componentIssuesProvider = new ComponentIssuesProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentIssues", componentIssuesProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.showComponentVersionIssues', async (componentVersionId: string): Promise<void> => {
      await componentIssuesProvider.updateVersionIssues(componentVersionId);
      componentIssuesProvider.revealView();
    })
  );


  // 3) Register the "Issue Details" view
  const issueDetailsProvider = new IssueDetailsProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IssueDetailsProvider.viewType, issueDetailsProvider)
  );

  // Create Artefacts
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createArtifact', async (issueId) => {
      console.log("[extension.createArtifact] Called with issueId:", issueId);

      // Get the active text editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found. Please open a file and select code.');
        return;
      }

      // Get selection range
      const selection = editor.selection;
      const from = selection.start.line + 1; // 1-based line numbers
      const to = selection.end.line + 1;
      const filePath = editor.document.uri.toString();

      // Get the component ID for the current file
      // TODO: This needs to be implemented - for now we'll ask the user
      const componentId = await vscode.window.showInputBox({
        prompt: 'Enter the component ID that owns this file',
        placeHolder: 'Component ID'
      });

      if (!componentId) { return; }

      // Prompt for template ID
      const templateId = await vscode.window.showInputBox({
        prompt: 'Enter artifact template ID',
        placeHolder: 'Template ID'
      });

      if (!templateId) { return; }

      try {
        // Authenticate
        await globalApiClient.authenticate();

        // 1. Create the artifact
        const createResult = await globalApiClient.executeQuery(CREATE_ARTIFACT_MUTATION, {
          input: {
            file: filePath,
            from: from,
            to: to,
            template: templateId,
            templatedFields: [],
            trackable: componentId
          }
        });

        if (!createResult.data?.createArtefact?.artefact) {
          if (createResult.errors) {
            vscode.window.showErrorMessage(`Error: ${createResult.errors[0].message}`);
          } else {
            vscode.window.showErrorMessage('Failed to create artifact.');
          }
          return;
        }

        const artifactId = createResult.data.createArtefact.artefact.id;

        // 2. Link the artifact to the issue
        const linkResult = await globalApiClient.executeQuery(ADD_ARTIFACT_TO_ISSUE_MUTATION, {
          input: {
            issue: issueId,
            artefact: artifactId
          }
        });

        if (linkResult.data?.addArtefactToIssue?.addedArtefactEvent) {
          vscode.window.showInformationMessage(`Artifact created and linked to issue successfully.`);
          
          // Refresh the issue details to show the new artifact
          if (issueDetailsProvider) {
            issueDetailsProvider.refreshCurrentIssue();
          }
        } else {
          console.error("[extension.createArtifact] Link result:", JSON.stringify(linkResult, null, 2));
          vscode.window.showWarningMessage('Artifact created but could not be linked to the issue.');
        }
      } catch (error) {
        console.error("[extension.createArtifact] Error:", error);
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to create an artifact template 
  // TODO: delete later, as only needed during development for testing
  // TODO: delete command from package.json
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createArtefactTemplate', async () => {
      try {
        // Prompt for template name
        const templateName = await vscode.window.showInputBox({
          prompt: 'Enter a name for the artifact template',
          placeHolder: 'Template Name'
        });

        if (!templateName) { return; }

        // Prompt for description (optional)
        const description = await vscode.window.showInputBox({
          prompt: 'Enter a description (optional)',
          placeHolder: 'Description'
        }) || "";

        await globalApiClient.authenticate();

        // Execute the mutation
        const result = await globalApiClient.executeQuery(`
        mutation CreateArtefactTemplate($input: CreateArtefactTemplateInput!) {
          createArtefactTemplate(input: $input) {
            artefactTemplate {
              id
              name
            }
          }
        }
      `, {
          input: {
            name: templateName,
            description: description
          }
        });

        if (result.data?.createArtefactTemplate?.artefactTemplate) {
          const template = result.data.createArtefactTemplate.artefactTemplate;
          vscode.window.showInformationMessage(`Template "${template.name}" created with ID: ${template.id}`);

          // Copy the ID to clipboard for convenience
          vscode.env.clipboard.writeText(template.id);
          vscode.window.showInformationMessage('Template ID copied to clipboard');
        } else {
          vscode.window.showErrorMessage('Failed to create template');
          console.error("Unexpected response:", result);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error creating template: ${error instanceof Error ? error.message : String(error)}`);
        console.error("Error:", error);
      }
    })
  );

  // 4) Register the "Graphs" view
  const graphsProvider = new GraphsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("graphs", graphsProvider)
  );

  // Command to refresh component versions
  context.subscriptions.push(
    vscode.commands.registerCommand('gropius.refreshComponentVersions', () => {
      gropiusComponentVersionsProvider.refresh();
    })
  );

  // Command to show component issues for a given component ID
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showComponentIssues", async (componentId: string): Promise<void> => {
      await componentIssuesProvider.updateIssues(componentId);
    })
  );

  // Command to show issue details for a given issue ID
  vscode.commands.registerCommand('extension.showIssueDetails', (issueId: string) => {
    console.log("Command extension.showIssueDetails invoked with issueId:", issueId);
    issueDetailsProvider.updateIssueDetails(issueId);
    issueDetailsProvider.revealView();
  });


  // Optional: command to open the Graph Editor for a project ID
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async (projectId: string): Promise<void> => {
      await graphsProvider.openGraphEditor(projectId);
    })
  );

  // *** NEW: Command to rebuild the Vue bundles ***
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.rebuildVue', () => {
      // Adjust the working directory (cwd) as needed.
      exec('npm run build:vue', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`Vue build failed: ${stderr}`);
          console.error("Vue build error:", error);
        } else {
          vscode.window.showInformationMessage("Vue build completed successfully.");
          console.log("Vue build output:", stdout);
          // Optionally, refresh affected webviews here.
        }
      });
    })
  );
}

/**
 * GropiusComponentVersionsProvider: Displays a list of Gropius component versions.
 * - Associates local folders with Gropius components
 * - Shows component versions in a tree view
 * - Allows selection of versions to view associated issues
 */
export class GropiusComponentVersionsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gropiusComponentVersions';
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private isAuthenticated: boolean = false;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) {
    this._extensionUri = _context.extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getComponentVersions':
          await this._sendComponentVersionsData();
          break;
        case 'versionClicked':
          // For now log the click
          console.log('Version clicked:', message.data);
          break;
        case 'showComponentVersionIssues':
          // Call the command to show issues for this component version
          vscode.commands.executeCommand('extension.showComponentVersionIssues', message.data.componentVersionId);
          break;
      }
    });
  }

  // Refresh the component versions data
  public async refresh() {
    if (this._view) {
      await this._sendComponentVersionsData();
    }
  }

  private async _sendComponentVersionsData() {
    if (!this._view) {
      return;
    }

    try {
      if (!this.isAuthenticated) {
        await this.apiClient.authenticate();
        this.isAuthenticated = true;
      }

      const mappings = await loadConfigurations();

      // Transform mappings into tree data for the webview
      const treeData = await this._buildTreeData(mappings);

      // Send data to the webview
      this._view.webview.postMessage({
        command: 'componentVersionsData',
        data: treeData
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to load component versions: ${errorMessage}`);

      // Send empty data to avoid leaving the view in a loading state
      this._view.webview.postMessage({
        command: 'componentVersionsData',
        data: []
      });
    }
  }

  private async _fetchComponentVersions(
    componentId?: string,
    projectId?: string,
    componentVersionId?: string
  ): Promise<{ id?: string, componentVersionIds?: string[], name: string, description?: string, versions: string[] }> {
    try {
      // Authenticate if needed
      if (!this.isAuthenticated) {
        await this.apiClient.authenticate();
        this.isAuthenticated = true;
      }

      // If we have a direct component version ID, fetch that specific version
      if (componentVersionId) {
        console.log(`Fetching component version with ID: ${componentVersionId}`);

        const result = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSION_BY_ID_QUERY, { id: componentVersionId });
        console.log("Direct version query result:", JSON.stringify(result, null, 2));

        if (result.data?.node) {
          const version = result.data.node;
          const versionString = version.version.startsWith('v') ? version.version : `v${version.version}`;
          return {
            id: version.component?.id,
            componentVersionIds: [version.id],
            name: version.component?.name || "Unknown Component",
            description: version.component?.description || "",
            versions: [versionString]
          };
        }
      }
      // For the component+project case
      else if (componentId && projectId) {
        console.log(`Fetching versions for component ID: ${componentId} in project: ${projectId}`);

        const result = await this.apiClient.executeQuery(GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY, {
          projectId: projectId
        });

        console.log("Component+Project query result:", JSON.stringify(result, null, 2));

        if (result.data?.project) {
          const project = result.data.project;
          // Filter to get only versions of our target component
          const componentVersions = project.components.nodes
            .filter((node: any) => node.component.id === componentId);

          if (componentVersions.length > 0) {
            const componentId = componentVersions[0].component.id;
            const componentName = componentVersions[0].component.name;
            const componentDescription = componentVersions[0].component.description || "";

            const versionStrings = [];
            const versionIds = [];

            for (const v of componentVersions) {
              versionStrings.push(v.version.startsWith('v') ? v.version : `v${v.version}`);
              versionIds.push(v.id);  // Store the version ID
            }

            return {
              id: componentId,
              name: componentName,
              componentVersionIds: versionIds,
              description: componentDescription,
              versions: versionStrings,
            };
          }
        }
      }

      return { name: "Unknown", versions: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching component version:', errorMessage);
      vscode.window.showErrorMessage(`Error fetching component version: ${errorMessage}`);
      return { name: "Error", versions: [] };
    }
  }

  private async _buildTreeData(mappings: Map<string, any[]>) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const treeItems = [];

    // Handle multi-root workspace
    if (workspaceFolders.length > 1) {
      for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        const folderMappings = mappings.get(rootPath);

        if (folderMappings && folderMappings.length > 0) {
          // Check if the root folder itself is mapped
          const rootMapping = folderMappings.find(m => m.path === '/');

          if (rootMapping) {
            // Root folder is directly mapped to a component version
            if (rootMapping.componentVersion) {
              const component = await this._fetchComponentVersions(
                undefined, undefined, rootMapping.componentVersion
              );

              if (component.versions.length > 0) {
                treeItems.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }
          } else {
            // Root contains multiple component mappings
            const folderItem: ComponentTreeItem = {
              name: folder.name,
              expanded: false,
              children: []
            };

            // Process each mapping in this folder
            for (const mapping of folderMappings) {
              let component;

              if (mapping.componentVersion) {
                component = await this._fetchComponentVersions(
                  undefined, undefined, mapping.componentVersion
                );
              } else if (mapping.component && mapping.project) {
                component = await this._fetchComponentVersions(
                  mapping.component, mapping.project
                );
              }

              if (component && component.versions.length > 0) {
                folderItem.children!.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }

            if (folderItem.children!.length > 0) {
              treeItems.push(folderItem);
            }
          }
        }
      }
    } else {
      // Single root workspace - flat list of components
      for (const [rootPath, folderMappings] of mappings.entries()) {
        for (const mapping of folderMappings) {
          let component;

          if (mapping.componentVersion) {
            component = await this._fetchComponentVersions(
              undefined, undefined, mapping.componentVersion
            );
          } else if (mapping.component && mapping.project) {
            component = await this._fetchComponentVersions(
              mapping.component, mapping.project
            );
          }

          if (component && component.versions.length > 0) {
            treeItems.push({
              id: component.id,
              componentVersionIds: component.componentVersionIds,
              name: component.name,
              description: component.description,
              versions: component.versions,
              expanded: false
            });
          }
        }
      }
    }

    return treeItems;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'gropiusComponentVersions.js')
    );

    const iconPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', 'icons', 'gropius-component-version-icon.png')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gropius Component Versions</title>
        <script>
            // Make the icon path available to the Vue app
            window.customIconPath = "${iconPath}";
        </script>
    </head>
    <body>
        <div id="app"></div>
        <script src="${scriptPath}"></script>
    </body>
    </html>`;
  }
}

/**
 * ComponentIssuesProvider:
 * - Receives a component ID
 * - Fetches all components with FETCH_COMPONENT_VERSIONS_QUERY
 * - Finds the matching component
 * - Sends its issues via "updateComponentIssues"
 */
export class ComponentIssuesProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentIssues";

  // Store the last fetched issues and the last selected version ID
  private lastIssues: any[] | null = null;
  private lastVersionId: string | null = null;

  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Provide HTML for the webview
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // When the view is resolved, force a re-fetch if a version was previously clicked.
    if (this.lastVersionId) {
      this.updateVersionIssues(this.lastVersionId);
    } else if (this.lastIssues) {
      // Alternatively, if we already have stored issues, post them.
      webviewView.webview.postMessage({
        command: "updateComponentIssues",
        data: this.lastIssues
      });
    }

    // Listen for messages from the Vue app
    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        // Do nothing until a component is selected.
      } else if (message.command === "issueClicked") {
        console.log("ComponentIssuesProvider received issueClicked with id:", message.issueId);
        vscode.commands.executeCommand('extension.showIssueDetails', message.issueId);
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
    return /* html */ `
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

  /**
   * Called by "extension.showComponentIssues" with a componentId.
   */
  public async updateIssues(componentId: string): Promise<void> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSIONS_QUERY);
      if (!response.data || !response.data.components) {
        throw new Error("No component data received.");
      }
      const components: any[] = response.data.components.nodes;
      const component = components.find((c: any) => c.id === componentId);
      const issues = component ? component.issues.nodes : [];

      // Store in memory
      this.lastIssues = issues;

      // If the view is open, post them immediately
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: issues
        });
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component issues: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Called by "extension.showComponentVersionIssues" with a version ID.
   * This method fetches the issues for the selected version, stores them,
   * and (if the view is open) posts them.
   */
  public async updateVersionIssues(componentVersionId: string): Promise<void> {
    try {
      // Save the last selected version ID
      this.lastVersionId = componentVersionId;

      await this.apiClient.authenticate();
      const result = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_VERSION_QUERY,
        { id: componentVersionId }
      );

      if (result.data?.node) {
        const componentVersion = result.data.node;
        const allIssues = [];
        const aggregatedIssueGroups = componentVersion.aggregatedIssues.nodes || [];

        for (const group of aggregatedIssueGroups) {
          const issues = group.issues.nodes || [];
          allIssues.push(...issues);
        }

        // Deduplicate issues based on ID
        const uniqueIssues = allIssues.filter((issue, index, self) =>
          index === self.findIndex((i) => i.id === issue.id)
        );

        console.log(`Found ${uniqueIssues.length} unique issues for version ${componentVersionId}`);
        this.lastIssues = uniqueIssues;

        // If the view is open, post the new issues
        if (this._view) {
          this._view.webview.postMessage({
            command: "updateComponentIssues",
            data: uniqueIssues
          });
        }
      } else {
        this.lastIssues = [];
        if (this._view) {
          this._view.webview.postMessage({
            command: "updateComponentIssues",
            data: []
          });
        }
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component version issues: ${error instanceof Error ? error.message : String(error)
        }`
      );
      this.lastIssues = [];
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: []
        });
      }
    }
  }

  /**
   * Force the "Component Issues" view to open and refresh its data.
   * This method is called whenever a new version is clicked.
   */
  public revealView() {
    if (this._view) {
      this._view.show(false); // Force the view to show
      if (this.lastVersionId) {
        // Force a re-fetch for the last selected version
        this.updateVersionIssues(this.lastVersionId);
      }
    } else {
      // If the view is not yet resolved, try to open the Explorer
      vscode.commands.executeCommand('workbench.view.explorer');
    }
  }
}

/**
 * IssueDetailsProvider:
 * - Displays detailed information about a selected issue
 * - Handles issue selection and view persistence
 */
class IssueDetailsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'issueDetails';
  private _view?: vscode.WebviewView;
  private lastIssueId: string | null = null;

  public refreshCurrentIssue(): void {
    if (this._view && this.lastIssueId) {
      this.updateIssueDetails(this.lastIssueId);
    }
  }

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log("[IssueDetailsProvider] resolveWebviewView called");
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    console.log("[IssueDetailsProvider] Webview HTML set");

    // When the view is (re)opened, if a last issue was selected, re-fetch its details.
    if (this.lastIssueId) {
      this.updateIssueDetails(this.lastIssueId);
    }

    webviewView.webview.onDidReceiveMessage((message: any) => {
      if (message.command === "vueAppReady") {
        console.log("[IssueDetailsProvider] Vue app is ready");
        // If we have a last issue ID, refresh the data
        if (this.lastIssueId) {
          this.updateIssueDetails(this.lastIssueId);
        }
      } else if (message.command === "openRelatedIssue") {
        console.log(`[IssueDetailsProvider] Opening related issue: ${message.issueId}`);
        // Execute the command to show this issue
        vscode.commands.executeCommand('extension.showIssueDetails', message.issueId);
      } else if (message.command === "createArtifact") {
        console.log(`[IssueDetailsProvider] Creating artifact`);
        // Execute the command to create an artifact
        vscode.commands.executeCommand('extension.createArtifact');
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'issueDetails.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Issue Details</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
  }

  public updateIssueDetails(issueId: string) {
    if (!this._view) {
      console.error("[IssueDetailsProvider] _view is undefined, cannot update issue details");
      return;
    }
    console.log(`[IssueDetailsProvider] updateIssueDetails called with issueId: ${issueId}`);
    this.lastIssueId = issueId;

    globalApiClient.authenticate()
      .then(() => {
        return Promise.all([
          globalApiClient.executeQuery(GET_ISSUE_DETAILS, { id: issueId }),
          globalApiClient.executeQuery(GET_ARTIFACTS_FOR_ISSUE, { issueId: issueId })
        ]);
      })
      .then(([issueData, artifactsData]) => {
        console.log("[IssueDetailsProvider] Received issue data:", issueData);
        console.log("[IssueDetailsProvider] Received artifacts data:", artifactsData);

        if (issueData.data && issueData.data.node) {
          // Add artifacts to the issue data
          const issueWithArtifacts = {
            ...issueData.data.node,
            artifacts: artifactsData.data?.node?.artefacts?.nodes || []
          };

          this._view?.webview.postMessage({
            command: 'displayIssue',
            issue: issueWithArtifacts
          });
        } else {
          console.warn(`[IssueDetailsProvider] No issue found for id ${issueId}`);
          this._view?.webview.postMessage({
            command: 'displayIssue',
            issue: null,
            error: 'Issue not found'
          });
        }
      })
      .catch(error => {
        console.error("[IssueDetailsProvider] Error fetching data:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        this._view?.webview.postMessage({
          command: 'displayIssue',
          issue: null,
          error: `Error fetching issue: ${errorMessage}`
        });
      });
  }

  public revealView() {
    if (this._view) {
      // Force the view to show
      this._view.show(false);
      // If there's a last selected issue, re-fetch its details
      if (this.lastIssueId) {
        this.updateIssueDetails(this.lastIssueId);
      }
    } else {
      vscode.commands.executeCommand('workbench.view.explorer');
    }
  }
}

/**
 * GraphsProvider:
 * - Displays a list of projects using FETCH_DYNAMIC_PROJECTS_QUERY
 * - Each project has a "Show Graph" button that opens a Graph Editor
 */
export class GraphsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "graphs";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Provide HTML for the webview
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
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "graphs.js"
      )
    );
    return /* html */ `
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
        `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)
        }`
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
        `Failed to fetch project graph: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getGraphEditorHtml(scriptUri: vscode.Uri): string {
    return /* html */ `
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

export function deactivate() { }
