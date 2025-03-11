import * as vscode from 'vscode';
import { loadConfigurations } from '../mapping/config-loader';
import { APIClient } from '../apiClient';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from '../config';
import { FETCH_COMPONENT_VERSION_BY_ID_QUERY } from '../queries';
import { GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY } from '../queries';

interface ComponentTreeItem {
    id?: string;
    componentVersionIds?: string[]; 
    name: string;
    description?: string;
    versions?: string[];
    children?: ComponentTreeItem[];
    expanded: boolean;
}

export class GropiusComponentVersionsProvider implements vscode.WebviewViewProvider {

    private apiClient: APIClient;
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
                case 'versionClicked':
                    // For now, just log the click
                    console.log('Version clicked:', message.data);
                    // You can handle the click action here later
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

                const query = `
              query GetComponentVersion($id: ID!) {
                node(id: $id) {
                  ... on ComponentVersion {
                    id
                    version
                    component {
                      id
                      name
                      description
                    }
                  }
                }
              }
            `;

                const result = await this.apiClient.executeQuery(query, { id: componentVersionId });
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
                                    description: component.description, // Add this line
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
                                    description: component.description, // Add this line
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
                            description: component.description, // Add this line
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
