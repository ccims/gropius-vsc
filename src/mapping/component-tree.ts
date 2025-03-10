import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfigurations } from './config-loader'; // Import from your config-loader file

// Assuming these interfaces are in your config-loader.ts
// If not, you'll need to import them or redefine them here
interface GropiusMapping {
  path: string;
  componentVersion?: string;
  project?: string;
  component?: string;
}

// Models for our tree view
interface ComponentVersion {
  id: string;
  name: string;
  version: string;
}

interface Component {
  id: string;
  name: string;
  versions: ComponentVersion[];
}

interface Project {
  id: string;
  name: string;
  components: Component[];
}

// Mock function to simulate fetching component versions from Gropius backend
// In a real implementation, this would call your API
async function fetchComponentVersions(
  componentId?: string, 
  projectId?: string, 
  componentVersionId?: string
): Promise<ComponentVersion[]> {
  // This is a mock implementation for testing
  // Replace with actual API calls in production
  
  if (componentVersionId) {
    // Direct version mapping case
    if (componentVersionId === "11111111-1111-1111-1111-111111111111") {
      return [{ id: componentVersionId, name: "DirectMapping", version: "v1.0" }];
    }
    if (componentVersionId === "55555555-5555-5555-5555-555555555555") {
      return [{ id: componentVersionId, name: "SameComponent", version: "v1" }];
    }
    if (componentVersionId === "66666666-6666-6666-6666-666666666666") {
      return [{ id: componentVersionId, name: "SameComponent", version: "v2" }];
    }
  }
  
  if (componentId && projectId) {
    // Component + Project mapping case
    if (componentId === "33333333-3333-3333-3333-333333333333") {
      return [
        { id: "frontend-v1", name: "Frontend", version: "v1" },
        { id: "frontend-v2", name: "Frontend", version: "v2" }
      ];
    }
    if (componentId === "44444444-4444-4444-4444-444444444444") {
      return [
        { id: "backend-v1", name: "Backend", version: "v1" }
      ];
    }
  }
  
  return [];
}

// Tree item class
export class ComponentVersionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly versions?: ComponentVersion[],
    public readonly componentId?: string,
    public readonly projectId?: string,
    public readonly path?: string
  ) {
    super(label, collapsibleState);
    
    if (versions && versions.length > 0) {
      // Add version tags to the label
      const versionStr = versions
        .map(v => `(${v.version})`)
        .join(' ');
      this.description = versionStr;
      
      // Add icon
      this.iconPath = new vscode.ThemeIcon('package');
    }
  }
}

// Tree data provider implementation
export class ComponentVersionTreeProvider implements vscode.TreeDataProvider<ComponentVersionTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ComponentVersionTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<ComponentVersionTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<ComponentVersionTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;
  
  private mappings: Map<string, GropiusMapping[]> = new Map();
  private componentCache: Map<string, ComponentVersion[]> = new Map();
  
  constructor() {
    this.refresh();
  }
  
  async refresh(): Promise<void> {
    this.mappings = await loadConfigurations();
    this.componentCache.clear();
    this._onDidChangeTreeData.fire();
  }
  
  getTreeItem(element: ComponentVersionTreeItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(element?: ComponentVersionTreeItem): Promise<ComponentVersionTreeItem[]> {
    if (!element) {
      // Root level - group by root folder or workspace
      return this.getRootItems();
    }
    
    if (element.componentId && element.projectId) {
      // This is a component item with versions
      return [];
    }
    
    // Must be a project or folder item with component children
    const rootPath = element.path || '';
    const mappings = this.mappings.get(rootPath) || [];
    
    const items: ComponentVersionTreeItem[] = [];
    const processedComponents = new Set<string>();
    
    for (const mapping of mappings) {
      let versions: ComponentVersion[] = [];
      
      if (mapping.componentVersion) {
        // Direct component version mapping
        const cacheKey = `version:${mapping.componentVersion}`;
        if (!this.componentCache.has(cacheKey)) {
          versions = await fetchComponentVersions(
            undefined, undefined, mapping.componentVersion
          );
          this.componentCache.set(cacheKey, versions);
        } else {
          versions = this.componentCache.get(cacheKey) || [];
        }
      } else if (mapping.component && mapping.project) {
        // Component + Project mapping
        const cacheKey = `component:${mapping.component}:project:${mapping.project}`;
        if (!this.componentCache.has(cacheKey)) {
          versions = await fetchComponentVersions(
            mapping.component, mapping.project
          );
          this.componentCache.set(cacheKey, versions);
        } else {
          versions = this.componentCache.get(cacheKey) || [];
        }
      }
      
      if (versions.length > 0) {
        // Group by component name
        const componentName = versions[0].name;
        
        if (!processedComponents.has(componentName)) {
          processedComponents.add(componentName);
          
          items.push(new ComponentVersionTreeItem(
            componentName,
            vscode.TreeItemCollapsibleState.None,
            versions,
            mapping.component,
            mapping.project,
            mapping.path
          ));
        }
      }
    }
    
    return items;
  }
  
  private async getRootItems(): Promise<ComponentVersionTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }
    
    const items: ComponentVersionTreeItem[] = [];
    
    // Check if we need to organize by root folder
    if (workspaceFolders.length > 1) {
      // Multi-root workspace - create a tree item for each root with mappings
      for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        const mappings = this.mappings.get(rootPath);
        
        if (mappings && mappings.length > 0) {
          // Direct root mapping - check if the root itself is mapped
          const rootMapping = mappings.find(m => m.path === '/');
          
          if (rootMapping) {
            // Root folder is directly mapped to a component version
            let versions: ComponentVersion[] = [];
            
            if (rootMapping.componentVersion) {
              const cacheKey = `version:${rootMapping.componentVersion}`;
              if (!this.componentCache.has(cacheKey)) {
                versions = await fetchComponentVersions(
                  undefined, undefined, rootMapping.componentVersion
                );
                this.componentCache.set(cacheKey, versions);
              } else {
                versions = this.componentCache.get(cacheKey) || [];
              }
              
              if (versions.length > 0) {
                items.push(new ComponentVersionTreeItem(
                  versions[0].name,
                  vscode.TreeItemCollapsibleState.None,
                  versions
                ));
              }
            }
          } else {
            // Root contains multiple component mappings
            const folderItem = new ComponentVersionTreeItem(
              folder.name,
              vscode.TreeItemCollapsibleState.Expanded,
              undefined,
              undefined,
              undefined,
              rootPath
            );
            
            items.push(folderItem);
          }
        }
      }
    } else {
      // Single root or flat view
      // Here we'll create a flat list of all component versions
      for (const [rootPath, mappings] of this.mappings.entries()) {
        for (const mapping of mappings) {
          let versions: ComponentVersion[] = [];
          
          if (mapping.componentVersion) {
            // Direct component version mapping
            const cacheKey = `version:${mapping.componentVersion}`;
            if (!this.componentCache.has(cacheKey)) {
              versions = await fetchComponentVersions(
                undefined, undefined, mapping.componentVersion
              );
              this.componentCache.set(cacheKey, versions);
            } else {
              versions = this.componentCache.get(cacheKey) || [];
            }
          } else if (mapping.component && mapping.project) {
            // Component + Project mapping
            const cacheKey = `component:${mapping.component}:project:${mapping.project}`;
            if (!this.componentCache.has(cacheKey)) {
              versions = await fetchComponentVersions(
                mapping.component, mapping.project
              );
              this.componentCache.set(cacheKey, versions);
            } else {
              versions = this.componentCache.get(cacheKey) || [];
            }
          }
          
          if (versions.length > 0) {
            // Group by component name
            const componentName = versions[0].name;
            items.push(new ComponentVersionTreeItem(
              componentName,
              vscode.TreeItemCollapsibleState.None,
              versions,
              mapping.component,
              mapping.project,
              mapping.path
            ));
          }
        }
      }
    }
    
    return items;
  }
}

// Export a function to create and register the tree view
export function registerComponentVersionTreeView(context: vscode.ExtensionContext): vscode.TreeView<ComponentVersionTreeItem> {
  const treeDataProvider = new ComponentVersionTreeProvider();
  
  const treeView = vscode.window.createTreeView('gropiusComponentVersions', {
    treeDataProvider,
    showCollapseAll: true
  });
  
  // Register the refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('gropius.refreshComponentVersions', () => {
      treeDataProvider.refresh();
    })
  );
  
  return treeView;
}