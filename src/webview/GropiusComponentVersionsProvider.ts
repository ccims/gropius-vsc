import * as vscode from 'vscode';
import * as path from 'path';
import { loadConfigurations } from '../mapping/config-loader';

interface ComponentTreeItem {
    name: string;
    versions?: string[];
    children?: ComponentTreeItem[];
    expanded: boolean;
  }

export class GropiusComponentVersionsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gropiusComponentVersions';

  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;

  constructor(private readonly _context: vscode.ExtensionContext) {
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
    
    // Load mappings from config files
    const mappings = await loadConfigurations();
    
    // Transform mappings into tree data for the webview
    const treeData = await this._buildTreeData(mappings);
    
    // Send data to the webview
    this._view.webview.postMessage({
      command: 'componentVersionsData',
      data: treeData
    });
  }

  // Mock implementation of fetching component versions
  // Replace with actual API calls in production
  private async _fetchComponentVersions(
    componentId?: string,
    projectId?: string,
    componentVersionId?: string
  ): Promise<{ name: string, versions: string[] }> {
    // This is a mock implementation for testing
    if (componentVersionId) {
      // Direct version mapping case
      if (componentVersionId === "11111111-1111-1111-1111-111111111111") {
        return { name: "DirectMapping", versions: ["v1.0"] };
      }
      if (componentVersionId === "55555555-5555-5555-5555-555555555555") {
        return { name: "SameComponent", versions: ["v1"] };
      }
      if (componentVersionId === "66666666-6666-6666-6666-666666666666") {
        return { name: "SameComponent", versions: ["v2"] };
      }
    }
    
    if (componentId && projectId) {
      // Component + Project mapping case
      if (componentId === "33333333-3333-3333-3333-333333333333") {
        return { name: "Frontend", versions: ["v1", "v2"] };
      }
      if (componentId === "44444444-4444-4444-4444-444444444444") {
        return { name: "Backend", versions: ["v1"] };
      }
    }
    
    return { name: "Unknown", versions: [] };
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