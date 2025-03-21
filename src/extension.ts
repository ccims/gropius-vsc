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
  GET_ARTIFACTS_FOR_ISSUE,
  CREATE_ARTIFACT_MUTATION,
  ADD_ARTIFACT_TO_ISSUE_MUTATION,
  GET_ARTIFACT_TEMPLATES_QUERY,
  GET_ISSUES_OF_COMPONENT_QUERY
} from "./queries";
import path from "path";

// Create a single, global API client instance
const globalApiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);

// Create the artifact decorator manager (code highlighting)
let artifactDecoratorManager: ArtifactDecoratorManager;

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

  // Initialize the artifact decorator manager
  artifactDecoratorManager = new ArtifactDecoratorManager(context);

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

  // Register command to refresh component issues
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshComponentIssues', () => {
      componentIssuesProvider.refreshCurrentIssues();
    })
  );


  // 3) Register the "Issue Details" view
  const issueDetailsProvider = new IssueDetailsProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IssueDetailsProvider.viewType, issueDetailsProvider)
  );

  // Command to create Artifacts 
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

      try {
        // Authenticate
        await globalApiClient.authenticate();

        // 1. Fetch the issue details to see which trackables it affects
        const issueDetailsResult = await globalApiClient.executeQuery(GET_ISSUE_DETAILS, { id: issueId });

        if (!issueDetailsResult.data?.node?.affects?.nodes || issueDetailsResult.data.node.affects.nodes.length === 0) {
          vscode.window.showErrorMessage('This issue does not affect any trackable components or projects.');
          return;
        }

        // Extract all trackable components and projects the issue affects
        const affectedTrackables = issueDetailsResult.data.node.affects.nodes
          .filter((node: any) => node.__typename === 'Component' || node.__typename === 'Project')
          .map((node: any) => ({
            id: node.id,
            name: node.__typename === 'Component' ? node.name : node.name,
            type: node.__typename
          }));

        if (affectedTrackables.length === 0) {
          vscode.window.showErrorMessage('No valid trackable components or projects found for this issue.');
          return;
        }

        // Automatically use the first component if there's only one, otherwise let user choose
        let selectedTrackable;
        if (affectedTrackables.length === 1) {
          selectedTrackable = affectedTrackables[0];
          console.log(`[extension.createArtifact] Automatically selected trackable: ${selectedTrackable.name} (${selectedTrackable.id})`);
        } else {
          const trackableItems = affectedTrackables.map((t: any) => ({
            label: t.name,
            description: t.type,
            detail: t.id
          }));

          const selectedItem = await vscode.window.showQuickPick(trackableItems, {
            placeHolder: 'Select which component or project this artifact belongs to'
          }) as vscode.QuickPickItem | undefined;

          if (!selectedItem) {
            return; // User cancelled
          }

          selectedTrackable = {
            id: selectedItem.detail || '',
            name: selectedItem.label || '',
            type: selectedItem.description || ''
          };
        }

        // 2. Fetch available artifact templates
        const templatesResult = await globalApiClient.executeQuery(GET_ARTIFACT_TEMPLATES_QUERY);

        if (!templatesResult.data?.artefactTemplates?.nodes || templatesResult.data.artefactTemplates.nodes.length === 0) {
          vscode.window.showErrorMessage('No artifact templates available.');
          return;
        }

        // 3. Let user select a template by name
        const templateItems = templatesResult.data.artefactTemplates.nodes.map((template: any) => ({
          label: template.name,
          description: template.description || '',
          detail: template.id
        }));

        const selectedTemplateItem = await vscode.window.showQuickPick(templateItems, {
          placeHolder: 'Select an artifact template'
        }) as vscode.QuickPickItem | undefined;

        if (!selectedTemplateItem) {
          return; // User cancelled
        }

        const selectedTemplateId = selectedTemplateItem.detail || '';

        // 4. Get any template field values if needed
        const selectedTemplate = templatesResult.data.artefactTemplates.nodes.find(
          (t: any) => t.id === selectedTemplateId
        );

        const templatedFields: any[] = [];

        if (selectedTemplate && selectedTemplate.templateFieldSpecifications && selectedTemplate.templateFieldSpecifications.length > 0) {
          for (const field of selectedTemplate.templateFieldSpecifications) {
            const fieldValue = await vscode.window.showInputBox({
              prompt: `Enter value for ${field.name}`,
              placeHolder: field.value?.metadata?.description || `Value for ${field.name}`
            });

            if (fieldValue !== undefined) { // Allow empty strings, but not undefined (canceled)
              templatedFields.push({
                name: field.name,
                value: fieldValue
              });
            } else {
              return; // User cancelled
            }
          }
        }

        // Log the exact input we're sending
        console.log("[extension.createArtifact] Creating artifact with input:", {
          file: filePath,
          from,
          to,
          template: selectedTemplateId,
          templatedFields,
          trackable: selectedTrackable.id
        });

        // 5. Create the artifact
        const createResult = await globalApiClient.executeQuery(CREATE_ARTIFACT_MUTATION, {
          input: {
            file: filePath,
            from,
            to,
            template: selectedTemplateId,
            templatedFields,
            trackable: selectedTrackable.id
          }
        });

        // Log the full result for debugging
        console.log("[extension.createArtifact] Full create result:", JSON.stringify(createResult, null, 2));

        if (!createResult.data?.createArtefact?.artefact) {
          if (createResult.errors) {
            console.log("[extension.createArtifact] Full error:", JSON.stringify(createResult.errors, null, 2));
            vscode.window.showErrorMessage(`Error creating artifact: ${createResult.errors[0].message}`);
          } else {
            vscode.window.showErrorMessage('Failed to create artifact.');
          }
          return;
        }

        const artifactId = createResult.data.createArtefact.artefact.id;

        // 6. Link the artifact to the issue
        const linkResult = await globalApiClient.executeQuery(ADD_ARTIFACT_TO_ISSUE_MUTATION, {
          input: {
            issue: issueId,
            artefact: artifactId
          }
        });

        console.log("[extension.createArtifact] Full link result:", JSON.stringify(linkResult, null, 2));

        if (linkResult.data?.addArtefactToIssue?.addedArtefactEvent) {
          vscode.window.showInformationMessage(`Artifact created and linked to issue successfully.`);

          // Refresh the issue details to show the new artifact
          if (issueDetailsProvider) {
            issueDetailsProvider.refreshCurrentIssue();
          }
        } else if (linkResult.errors) {
          console.error("[extension.createArtifact] Link error:", JSON.stringify(linkResult.errors, null, 2));
          vscode.window.showWarningMessage(`Artifact created but could not be linked to the issue: ${linkResult.errors[0].message}`);
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

  // Command to open and highlight a file for an artifact
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openArtifactFile', async (artifactData) => {
      console.log(`[extension.openArtifactFile] Opening file: ${artifactData.file}`);

      try {
        // Convert the file URI string to a vscode.Uri object
        const fileUri = vscode.Uri.parse(artifactData.file);

        // Check if file exists in workspace
        let fileExists = false;
        try {
          await vscode.workspace.fs.stat(fileUri);
          fileExists = true;
        } catch (error) {
          // File doesn't exist or isn't accessible
          fileExists = false;
        }

        if (!fileExists) {
          vscode.window.showWarningMessage(`File not found in workspace: ${fileUri.fsPath}`);
          return;
        }

        // Open the document in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document);

        // If we have valid line numbers, scroll to that position
        if (artifactData.from && artifactData.to) {
          // Convert to 0-based line numbers for VSCode API
          const startLine = Math.max(0, artifactData.from - 1);
          const endLine = Math.max(0, artifactData.to - 1);

          // Create a range for the relevant lines
          const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
          );

          // Reveal the range in the editor
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

          // Set the selection but don't highlight
          editor.selection = new vscode.Selection(range.start, range.start);
        }
      } catch (error) {
        console.error(`[extension.openArtifactFile] Error opening file: ${error}`);
        vscode.window.showErrorMessage(`Error opening artifact file: ${error instanceof Error ? error.message : String(error)}`);
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
    vscode.commands.registerCommand("extension.showComponentIssues", async (data: any): Promise<void> => {
      const componentId = typeof data === 'string' ? data : data.componentId;
      await componentIssuesProvider.updateIssues(componentId);
      componentIssuesProvider.revealView();
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
          console.log('Version clicked:', message.data);
          break;
        case 'showComponentVersionIssues':
          vscode.commands.executeCommand('extension.showComponentVersionIssues', message.data.componentVersionId);
          break;
        case 'showComponentIssues':
          console.log('Component clicked:', message.data);
          // If the component has versions, use the first one's ID
          if (message.data.componentId) {
            vscode.commands.executeCommand('extension.showComponentIssues', message.data);
          }
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
  private _viewVisibilityChangedDisposable?: vscode.Disposable;

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

    // Register visibility changed listener
    this._viewVisibilityChangedDisposable?.dispose();
    this._viewVisibilityChangedDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log("[ComponentIssuesProvider] View became visible, refreshing issues");
        this.refreshCurrentIssues();
      }
    });

    // When the view is resolved, force a refresh regardless of previous state
    this.refreshCurrentIssues();

    // Listen for messages from the Vue app
    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        this.refreshCurrentIssues();
      } else if (message.command === "issueClicked") {
        console.log("ComponentIssuesProvider received issueClicked with id:", message.issueId);
        vscode.commands.executeCommand('extension.showIssueDetails', message.issueId);
      } else if (message.command === "refreshRequested") {
        // Handle request to refresh issues data
        this.refreshCurrentIssues();
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
      this.lastVersionId = null;

      await this.apiClient.authenticate();
      const result = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      if (!result.data || !result.data.node) {
        throw new Error("No component data received.");
      }

      const issues = result.data.node.issues.nodes || [];

      // Store in memory
      this.lastIssues = issues;

      // If the view is open, post them immediately
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: issues,
          metadata: {
            versionOnlyIssues: [], // No version-only issues when viewing component issues
            selectedVersionId: null // No version selected
          }
        });
      }

      // Reveal the view
      this.revealView();
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component issues: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
 * Refreshes the current set of issues by refetching them from the API.
 */
  public async refreshCurrentIssues(): Promise<void> {
    console.log("[ComponentIssuesProvider] Refreshing current issues");
    
    try {
      // Clear any cached issues first to ensure fresh data
      if (this._view) {
        // Start with a loading indicator
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: this.lastIssues || [],
          isLoading: true
        });
      }
      
      // If we have a component version selected, refresh its issues
      if (this.lastVersionId) {
        console.log(`[ComponentIssuesProvider] Refreshing issues for version ID ${this.lastVersionId}`);
        // Force a complete refresh by clearing the cache
        this.lastIssues = null;
        await this.updateVersionIssues(this.lastVersionId);
        return;
      }
      
      // If no version ID but we have component issues with component ID, use that
      if (this.lastIssues && this.lastIssues.length > 0) {
        // Try to find component ID from the first issue
        const componentId = this.findComponentIdFromIssues(this.lastIssues);
        if (componentId) {
          console.log(`[ComponentIssuesProvider] Refreshing issues for component ID ${componentId}`);
          // Force a complete refresh by clearing the cache
          this.lastIssues = null;
          await this.updateIssues(componentId);
          return;
        }
      }
      
      console.log("[ComponentIssuesProvider] No version or component ID available for refresh");
    } catch (error) {
      console.error("[ComponentIssuesProvider] Error refreshing issues:", error);
      vscode.window.showErrorMessage(`Failed to refresh issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to extract component ID from issues
  private findComponentIdFromIssues(issues: any[]): string | null {
    // Attempt different ways to find the component ID
    for (const issue of issues) {
      // Check if component ID is directly available
      if (issue.component?.id) {
        return issue.component.id;
      }

      // Check if component ID is available in affects relationship
      if (issue.affects?.nodes) {
        for (const node of issue.affects.nodes) {
          if (node.__typename === 'Component' && node.id) {
            return node.id;
          }
        }
      }
    }

    return null;
  }


  /**
   * Called by "extension.showComponentVersionIssues" with a version ID.
   * This method fetches the issues for the selected version, stores them,
   * and (if the view is open) posts them.
   */
  public async updateVersionIssues(componentVersionId: string): Promise<void> {
    try {
      this.lastVersionId = componentVersionId;

      await this.apiClient.authenticate();

      // Get the component ID from the component version
      const componentVersionResult = await this.apiClient.executeQuery(
        FETCH_COMPONENT_VERSION_BY_ID_QUERY,
        { id: componentVersionId }
      );

      const componentId = componentVersionResult.data?.node?.component?.id;
      if (!componentId) {
        throw new Error("Could not find component ID for this version");
      }

      // Get ALL component issues (same as clicking the component)
      const componentResult = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      // Get all issues specific to the component
      const componentIssues = componentResult.data?.node?.issues?.nodes || [];

      // Mark which issues are affected by the selected version
      const versionResult = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_VERSION_QUERY,
        { id: componentVersionId }
      );

      // Extract all issue IDs that are affected by this version
      const affectedIssueIds = new Set();
      const versionIssueGroups = versionResult.data?.node?.aggregatedIssues?.nodes || [];

      for (const group of versionIssueGroups) {
        const issues = group.issues.nodes || [];
        for (const issue of issues) {
          affectedIssueIds.add(issue.id);
        }
      }

      // Mark issues that are affected by the selected version
      const allIssues = componentIssues.map((issue: { id: unknown; }) => ({
        ...issue,
        affectsSelectedVersion: affectedIssueIds.has(issue.id)
      }));

      // Update the issue list
      this.lastIssues = allIssues;

      // If the view is open, post the new issues
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: allIssues,
          metadata: {
            selectedVersionId: componentVersionId,
            affectedIssueIds: Array.from(affectedIssueIds)
          }
        });
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

  public async updateComponentIssues(componentId: string): Promise<void> {
    try {
      // Clear the last version ID
      this.lastVersionId = null;

      await this.apiClient.authenticate();

      const result = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      if (result.data?.node) {
        const componentIssues = result.data.node.issues.nodes || [];

        // Update the issue list
        this.lastIssues = componentIssues;

        // If the view is open, post the new issues
        if (this._view) {
          this._view.webview.postMessage({
            command: "updateComponentIssues",
            data: componentIssues,
            metadata: {
              versionOnlyIssues: [] // No version-only issues when viewing component issues
            }
          });
        }
      }
    } catch (error: any) {
      // Handle errors
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
        console.log(`[IssueDetailsProvider] Creating artifact for issue: ${message.issueId}`);
        // Execute the command to create an artifact
        vscode.commands.executeCommand('extension.createArtifact', message.issueId);
      } else if (message.command === "openArtifactFile") {
        console.log(`[IssueDetailsProvider] Opening artifact file:`, message.artifactData);
        // Execute the command to open the artifact file
        vscode.commands.executeCommand('extension.openArtifactFile', message.artifactData);
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

          // Register artifacts for decoration in open editors
          if (issueWithArtifacts.artifacts && issueWithArtifacts.artifacts.length > 0) {
            // Clear previous artifacts first
            artifactDecoratorManager.clearAllArtifacts();

            // Register all artifacts
            for (const artifact of issueWithArtifacts.artifacts) {
              if (artifact.file && artifact.from && artifact.to) {
                artifactDecoratorManager.registerArtifact(
                  artifact.id,
                  artifact.file,
                  artifact.from,
                  artifact.to
                );
              }
            }
          }

          this._view?.webview.postMessage({
            command: 'displayIssue',
            issue: issueWithArtifacts
          });
          vscode.commands.executeCommand('extension.refreshComponentIssues');
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

/**
 * Manages decorations for artifacts in open text editors
 */
class ArtifactDecoratorManager {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private artifactRanges: Map<string, { uri: vscode.Uri, ranges: vscode.Range[], artifactIds: string[] }> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Listen for editor changes to apply decorations
    vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this, context.subscriptions);

    // Apply decorations to the active editor right away
    if (vscode.window.activeTextEditor) {
      this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }
  }

  /**
   * Register an artifact to be highlighted in editors
   */
  public registerArtifact(artifactId: string, fileUri: string, from: number, to: number): void {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const uriString = uri.toString();

      // Convert 1-based line numbers to 0-based
      const startLine = Math.max(0, from - 1);
      const endLine = Math.max(0, to - 1);

      // Create ranges for just the first and last lines
      const ranges = [];

      // First line
      ranges.push(new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine, Number.MAX_SAFE_INTEGER)
      ));

      // Last line (only if different from first line)
      if (startLine !== endLine) {
        ranges.push(new vscode.Range(
          new vscode.Position(endLine, 0),
          new vscode.Position(endLine, Number.MAX_SAFE_INTEGER)
        ));
      }

      // Store or update the artifact range for this file
      if (!this.artifactRanges.has(uriString)) {
        this.artifactRanges.set(uriString, {
          uri,
          ranges: ranges,
          artifactIds: [artifactId]
        });
      } else {
        const fileData = this.artifactRanges.get(uriString)!;
        fileData.ranges.push(...ranges);
        fileData.artifactIds.push(artifactId);
        fileData.artifactIds.push(artifactId); // Add twice if we have two ranges
      }

      // Apply decorations if the file is open
      this.applyDecorationsToOpenEditors();
    } catch (error) {
      console.error(`[ArtifactDecoratorManager] Error registering artifact: ${error}`);
    }
  }

  /**
   * Remove an artifact registration
   */
  public unregisterArtifact(artifactId: string): void {
    // Find all files that contain this artifact
    for (const [uriString, fileData] of this.artifactRanges.entries()) {
      const index = fileData.artifactIds.indexOf(artifactId);
      if (index >= 0) {
        // Remove the artifact and its range
        fileData.artifactIds.splice(index, 1);
        fileData.ranges.splice(index, 1);

        // If no more artifacts for this file, remove the entry
        if (fileData.artifactIds.length === 0) {
          this.artifactRanges.delete(uriString);
        }
      }
    }

    // Reapply decorations
    this.applyDecorationsToOpenEditors();
  }

  /**
   * Clear all artifact registrations
   */
  public clearAllArtifacts(): void {
    this.artifactRanges.clear();
    this.disposeAllDecorations();
  }

  /**
   * Called when the active editor changes
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    // Apply decorations to the new active editor
    this.applyDecorationsToEditor(editor);
  }

  /**
   * Apply decorations to all open editors
   */
  private applyDecorationsToOpenEditors(): void {
    vscode.window.visibleTextEditors.forEach(editor => {
      this.applyDecorationsToEditor(editor);
    });
  }

  private applyDecorationsToEditor(editor: vscode.TextEditor): void {
    const uriString = editor.document.uri.toString();

    // Check if we have artifacts for this file
    if (!this.artifactRanges.has(uriString)) {
      return;
    }

    // Get the ranges for this file
    const fileData = this.artifactRanges.get(uriString)!;

    // Create decoration type if needed
    if (!this.decorationTypes.has(uriString)) {
      const extensionPath = this.context.extensionPath;
      const iconPath = path.join(extensionPath, 'resources', 'icons', 'highlighter.png');

      console.log("[ArtifactDecoratorManager] Using icon path:", iconPath);

      const decorationType = vscode.window.createTextEditorDecorationType({
        // Remove the background color and border properties
        overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
        overviewRulerLane: vscode.OverviewRulerLane.Center,
        gutterIconPath: iconPath,
        gutterIconSize: '100%'
      });

      this.decorationTypes.set(uriString, decorationType);
    }

    // Apply the decorations after a short delay to ensure the editor is ready
    setTimeout(() => {
      const decorationType = this.decorationTypes.get(uriString)!;
      editor.setDecorations(decorationType, fileData.ranges);
    }, 100);
  }

  /**
   * Dispose all decoration types
   */
  private disposeAllDecorations(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.disposeAllDecorations();
  }
}

export function deactivate() {
  // Clean up the decorator manager
  if (artifactDecoratorManager) {
    artifactDecoratorManager.dispose();
  }
}