import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import * as vscode from 'vscode';
import { APIClient } from "./apiClient";

/**
 * Represents a tree item in the VS Code TreeView.
 * Can represent a project, component, issue, or group (e.g., "Components" or "Issues").
 */
class ProjectItem extends vscode.TreeItem {
    /**
     * @param {string} label - The display label for the tree item.
     * @param {vscode.TreeItemCollapsibleState} collapsibleState - Whether the item is collapsible or not.
     * @param {vscode.Command} [command] - The command to execute when the item is clicked.
     * @param {string} [parent] - The parent item label, used for nested relationships (e.g., project name).
     * @param {string} [contextValue] - The context value used for conditional rendering or commands.
     */
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string, // Parent project name
        public readonly contextValue?: string // Context value for tree item
    ) {
        super(label, collapsibleState);

        // Tooltip shows parent (if available) and label
        this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;

        // Icon path depends on whether the item is a folder or a file
        this.iconPath = new vscode.ThemeIcon(
            collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
        );

        if (contextValue) {
            this.contextValue = contextValue; // Assign contextValue explicitly
        }
    }
}

/**
 * Provides data for the TreeView in VS Code.
 * Manages both static projects (hardcoded) and dynamic projects (fetched via API).
 */
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    // Event emitter to signal when the TreeView data changes
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Hardcoded static projects with their components and issues
    private staticProjects: { [key: string]: { components: string[]; issues: string[] } } = {
        "Project A": { components: ["Component A", "Component B", "Component C"], issues: ["Issue A", "Issue B", "Issue C"] },
        "Project B": { components: ["Component D", "Component E", "Component F"], issues: ["Issue D", "Issue E", "Issue F"] },
        "Project C": { components: ["Component G", "Component H", "Component I"], issues: ["Issue G", "Issue H", "Issue I"] }
    };

    // Dynamically fetched projects from the API
    private dynamicProjects: { id: string; name: string; issues: { id: string; title: string }[] }[] = [];

    constructor(private apiClient: APIClient) {}

    /**
     * Refreshes the TreeView data.
     * Calls `onDidChangeTreeData` to signal changes.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Fetches dynamic projects from the API and updates the TreeView.
     * @returns {Promise<void>} - Resolves when the projects are successfully fetched.
     */
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
            // Fetch projects from the API
            const response = await this.apiClient.executeQuery(query);

            // Map API response to internal structure
            this.dynamicProjects = response.data.projects.nodes.map((project: any) => ({
                id: project.id,
                name: project.name,
                issues: project.issues.nodes
            }));

            // Refresh the TreeView after fetching data
            this.refresh();
        } catch (error: unknown) {
            vscode.window.showErrorMessage(`Failed to fetch dynamic projects: ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Gets the TreeItem for the provided element.
     * @param {ProjectItem} element - The TreeItem element.
     * @returns {vscode.TreeItem} - The TreeItem to display.
     */
    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the children of a given TreeItem or top-level items if no element is provided.
     * @param {ProjectItem} [element] - The parent TreeItem.
     * @returns {Thenable<ProjectItem[]>} - A promise that resolves to an array of children.
     */
    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (!element) {
            // Top-level: Combine static and dynamic projects
            const staticProjectItems = Object.keys(this.staticProjects).map(
                project => new ProjectItem(project, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "static")
            );
            const dynamicProjectItems = this.dynamicProjects.map(
                project => new ProjectItem(project.name, vscode.TreeItemCollapsibleState.Collapsed, undefined, project.id)
            );

            return Promise.resolve([...staticProjectItems, ...dynamicProjectItems]);
        }

        // Fetch Components and Issues for static projects
        if (element.contextValue === "static") {
            return Promise.resolve([
                new ProjectItem("Components", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label, "staticGroup"),
                new ProjectItem("Issues", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label, "staticGroup")
            ]);
        }

        // Fetch components of static projects
        if (element.label === "Components" && element.parent && element.parent in this.staticProjects) {
            const projectComponents = this.staticProjects[element.parent]?.components || [];
            return Promise.resolve(
                projectComponents.map((component: string) =>
                    new ProjectItem(component, vscode.TreeItemCollapsibleState.None, undefined, element.parent)
                )
            );
        }

        // Fetch issues of static projects
        if (element.label === "Issues" && element.parent && element.parent in this.staticProjects) {
            const projectIssues = this.staticProjects[element.parent]?.issues || [];
            return Promise.resolve(
                projectIssues.map((issue: string) =>
                    new ProjectItem(issue, vscode.TreeItemCollapsibleState.None, undefined, element.parent)
                )
            );
        }

        // Fetch components and issues of dynamic projects
        const dynamicProject = this.dynamicProjects.find(proj => proj.name === element.label || proj.id === element.parent);
        if (dynamicProject) {
            if (element.label === "Components") {
                return Promise.resolve([]);
            } else if (element.label === "Issues") {
                return Promise.resolve(
                    dynamicProject.issues.map((issue: { id: string; title: string }) =>
                        new ProjectItem(issue.title, vscode.TreeItemCollapsibleState.None)
                    )
                );
            } else {
                return Promise.resolve([
                    new ProjectItem("Components", vscode.TreeItemCollapsibleState.Collapsed, undefined, dynamicProject.id),
                    new ProjectItem("Issues", vscode.TreeItemCollapsibleState.Collapsed, undefined, dynamicProject.id)
                ]);
            }
        }

        // Handle unexpected elements
        return Promise.resolve([]);
    }

    /**
     * Extracts a human-readable error message from an error object.
     * @param {unknown} error - The error object.
     * @returns {string} - The error message.
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return typeof error === "string" ? error : "An unknown error occurred";
    }
}

/**
 * Activates the extension.
 * Registers the TreeDataProvider and sets up commands.
 * @param {vscode.ExtensionContext} context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
    const projectsProvider = new ProjectsProvider(apiClient);

    // Register the TreeDataProvider
    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);

    // Register the refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    // Register the open project command
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