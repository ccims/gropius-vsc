import * as vscode from 'vscode';
import * as path from 'path';

// Tree Item Implementation
class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string // Add parent to group components and issues
    ) {
        super(label, collapsibleState);

        this.tooltip = parent ? `${parent}: ${this.label}` : this.label;
        this.iconPath = new vscode.ThemeIcon(
            collapsibleState === vscode.TreeItemCollapsibleState.None ? 'file' : 'folder'
        );
    }
}

// Tree Data Provider
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projects: { [key: string]: { components: string[]; issues: string[] } } = {
        'Project A': { components: ['Component A', 'Component B', 'Component C'], issues: ['Issue A', 'Issue B', 'Issue C'] },
        'Project B': { components: ['Component D', 'Component E', 'Component F'], issues: ['Issue D', 'Issue E', 'Issue F'] },
        'Project C': { components: ['Component G', 'Component H', 'Component I'], issues: ['Issue G', 'Issue H', 'Issue I'] }
    };

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (!element) {
            // Top-level: Return projects
            return Promise.resolve(
                Object.keys(this.projects).map(
                    project => new ProjectItem(project, vscode.TreeItemCollapsibleState.Collapsed)
                )
            );
        } else if (Object.keys(this.projects).includes(element.label)) {
            // Project level: Return "Components" and "Issues" groups
            return Promise.resolve([
                new ProjectItem('Components', vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label), // Set parent to project name
                new ProjectItem('Issues', vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label) // Set parent to project name
            ]);
        } else if (element.label === 'Components' && element.parent) {
            // Components group: Return component items
            const projectComponents = this.projects[element.parent].components;
            return Promise.resolve(
                projectComponents.map(
                    component =>
                        new ProjectItem(
                            component,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'extension.openProject',
                                title: 'Open Component',
                                arguments: [component],
                            }
                        )
                )
            );
        } else if (element.label === 'Issues' && element.parent) {
            // Issues group: Return issue items
            const projectIssues = this.projects[element.parent].issues;
            return Promise.resolve(
                projectIssues.map(
                    issue =>
                        new ProjectItem(
                            issue,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'extension.openProject',
                                title: 'Open Issue',
                                arguments: [issue],
                            }
                        )
                )
            );
        }
    
        return Promise.resolve([]);
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Register the Tree Data Provider
    const projectsProvider = new ProjectsProvider();
    vscode.window.registerTreeDataProvider('projectsView', projectsProvider);

    // Command to refresh the tree view
    context.subscriptions.push(
        vscode.commands.registerCommand('projectsView.refresh', () => projectsProvider.refresh())
    );

    // Command to open a project, component, or issue
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openProject', (item: ProjectItem) => {
            vscode.window.showInformationMessage(`You selected: ${item.label}`);
        })
    );

    // Command to show the webview
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.showWebview', () => {
            const panel = vscode.window.createWebviewPanel(
                'myWebview',
                'My Webview',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'out')),
                    ],
                }
            );

            const scriptPath = panel.webview.asWebviewUri(
                vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview.js'))
            );

            panel.webview.html = getWebviewContent(scriptPath);
        })
    );
}

// Helper function to generate HTML content for the webview
function getWebviewContent(scriptPath: vscode.Uri): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Webview</title>
        </head>
        <body>
            <div id="app"></div>
            <script src="${scriptPath}"></script>
        </body>
        </html>
    `;
}