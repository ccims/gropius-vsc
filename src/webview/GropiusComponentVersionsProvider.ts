import * as vscode from 'vscode';
import * as path from 'path';
import { loadConfigurations } from '../mapping/config-loader';
import { APIClient } from '../apiClient';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from '../config';
import { FETCH_COMPONENT_VERSION_BY_ID_QUERY } from '../queries';


interface ComponentTreeItem {
    name: string;
    versions?: string[];
    children?: ComponentTreeItem[];
    expanded: boolean;
}

export class GropiusComponentVersionsProvider implements vscode.WebviewViewProvider {

    private apiClient: APIClient;
    private componentVersionsCache: Map<string, any> = new Map();
    private isAuthenticated: boolean = false;

    public static readonly viewType = 'gropiusComponentVersions';

    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._extensionUri = _context.extensionUri;
        this.apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
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

    // Mock implementation of fetching component versions
    // Replace with actual API calls in production
    private async _fetchComponentVersions(
        componentId?: string,
        projectId?: string,
        componentVersionId?: string
      ): Promise<{ name: string, versions: string[] }> {
        try {
          // Authenticate if needed
          if (!this.isAuthenticated) {
            await this.apiClient.authenticate();
            this.isAuthenticated = true;
          }
          
          // If we have a direct component version ID, fetch that specific version
          if (componentVersionId) {
            console.log(`Fetching component version with ID: ${componentVersionId}`);
            
            const query = `
              query GetComponentVersion($id: ID!) {
                node(id: $id) {
                  ... on ComponentVersion {
                    id
                    version
                    component {
                      id
                      name
                    }
                  }
                }
              }
            `;
            
            const result = await this.apiClient.executeQuery(query, { id: componentVersionId });
            console.log("Direct version query result:", JSON.stringify(result, null, 2));
            
            if (result.data?.node) {
              const version = result.data.node;
              return {
                name: version.component?.name || "Unknown Component",
                versions: [`v${version.version}`]
              };
            }
          } 
          // Handle component+project case if needed
          else if (componentId && projectId) {
            // Implementation for project+component mapping would go here
            // For now, return placeholder
            return { name: "Component in Project", versions: ["v1"] };
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
                                    name: component.name,
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
                                    name: component.name,
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
                            name: component.name,
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
        // Get path to the built Vue app
        const scriptPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'gropiusComponentVersions.js')
        );

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gropius Component Versions</title>
    </head>
    <body>
        <div id="app"></div>
        <script src="${scriptPath}"></script>
    </body>
    </html>`;
    }
}
