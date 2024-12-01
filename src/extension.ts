import * as vscode from 'vscode';
import * as path from 'path';

// Tree Item Implementation
class ProjectItem extends vscode.TreeItem {
    tooltip: string | undefined;
    iconPath: vscode.ThemeIcon | undefined;

    constructor(
        public readonly label: string, // Property initialized via constructor parameter
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState); // Pass the label to the parent class
        this.tooltip = `Project: ${label}`; // Initialize additional properties
        this.iconPath = new vscode.ThemeIcon('file-directory'); // Example icon
    }
}

// Tree Data Provider
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projects: string[] = ['Project A', 'Project B', 'Project C'];

    // Refresh the tree view
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (element) {
            // Optional: Return child items for a project
            return Promise.resolve([]);
        } else {
            // Top-level items (projects)
            return Promise.resolve(
                this.projects.map(
                    project =>
                        new ProjectItem(
                            project,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'extension.openProject',
                                title: 'Open Project',
                                arguments: [project],
                            }
                        )
                )
            );
        }
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

    // Command to handle opening a project
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openProject', (project: string) => {
            vscode.window.showInformationMessage(`Opening project: ${project}`);
        })
    );

    // Your existing webview command
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