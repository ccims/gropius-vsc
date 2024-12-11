import * as vscode from 'vscode';
import * as path from 'path';
import { APIClient } from "./apiClient";

// Tree Item Implementation
class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string // Add parent for nested tree items
    ) {
        super(label, collapsibleState);

        this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;
        this.iconPath = new vscode.ThemeIcon(
            collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
        );
    }
}

// Tree Data Provider
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private staticProjects: { [key: string]: { components: string[]; issues: string[] } } = {
        "Project A": { components: ["Component A", "Component B", "Component C"], issues: ["Issue A", "Issue B", "Issue C"] },
        "Project B": { components: ["Component D", "Component E", "Component F"], issues: ["Issue D", "Issue E", "Issue F"] },
        "Project C": { components: ["Component G", "Component H", "Component I"], issues: ["Issue G", "Issue H", "Issue I"] }
    };

    private dynamicProjects: { id: string; name: string; issues: { id: string; title: string }[] }[] = []; // Store fetched dynamic projects
    private apiClient: APIClient;

    constructor(apiClient: APIClient) {
        this.apiClient = apiClient;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async fetchDynamicProjects(): Promise<void> {
        const query = `
            query {
                projects {
                    nodes {
                        id
                        name
                        issues {
                            nodes {
                                id
                                title
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await this.apiClient.executeQuery(query);
            this.dynamicProjects = response.data.projects.nodes.map((project: any) => ({
                id: project.id,
                name: project.name,
                issues: project.issues.nodes
            }));
            this.refresh();
        } catch (error: unknown) {
            vscode.window.showErrorMessage(`Failed to fetch dynamic projects: ${this.getErrorMessage(error)}`);
        }
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (!element) {
            // Top-level: Combine static and dynamic projects
            const staticProjectItems = Object.keys(this.staticProjects).map(
                project => new ProjectItem(project, vscode.TreeItemCollapsibleState.Collapsed, undefined, "static")
            );
            const dynamicProjectItems = this.dynamicProjects.map(
                project => new ProjectItem(project.name, vscode.TreeItemCollapsibleState.Collapsed, undefined, project.id)
            );
    
            return Promise.resolve([...staticProjectItems, ...dynamicProjectItems]);
        } else if (element.contextValue === "static") {
            // Static project: Return "Components" and "Issues" groups
            return Promise.resolve([
                new ProjectItem("Components", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label),
                new ProjectItem("Issues", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label)
            ]);
        } else if (element.label === "Components" && element.parent) {
            // Components group for static projects
            const projectComponents = this.staticProjects[element.parent]?.components || [];
            return Promise.resolve(
                projectComponents.map((component: string) =>
                    new ProjectItem(component, vscode.TreeItemCollapsibleState.None)
                )
            );
        } else if (element.label === "Issues" && element.parent) {
            // Issues group for static projects
            const projectIssues = this.staticProjects[element.parent]?.issues || [];
            return Promise.resolve(
                projectIssues.map((issue: string) =>
                    new ProjectItem(issue, vscode.TreeItemCollapsibleState.None)
                )
            );
        } else {
            // Dynamic project: Return issues directly
            const project = this.dynamicProjects.find(proj => proj.name === element.label);
            if (project) {
                return Promise.resolve(
                    project.issues.map((issue: { id: string; title: string }) =>
                        new ProjectItem(issue.title, vscode.TreeItemCollapsibleState.None)
                    )
                );
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

export function activate(context: vscode.ExtensionContext) {
    // const clientId = "YOUR_CLIENT_ID"; // Replace with your client ID
    // const clientSecret = "YOUR_CLIENT_SECRET"; // Replace with your client secret
    // const url = "http://localhost:4200"; // API URL
    const clientId = "613ea755-c7a0-4713-9cb4-7469f036dba1"; // Replace with your client ID
    const clientSecret = "fdf858356fa4f39df484fe17849f0e"; // Replace with your client secret
    const url = "http://localhost:4200"; // API URL

    const apiClient = new APIClient(url, clientId, clientSecret);
    const projectsProvider = new ProjectsProvider(apiClient);

    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.openProject", (item: any) => {
            vscode.window.showInformationMessage(`Selected: ${item.title || item.name}`);
        })
    );

    // Authenticate and fetch projects initially
    apiClient.authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch(error => vscode.window.showErrorMessage(`Initialization failed: ${error.message}`));
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