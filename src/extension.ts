import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import * as vscode from 'vscode';
import { APIClient } from "./apiClient";
import { ComponentDetailsProvider } from "./views/component-details-view";

/**
 * Represents a tree item in the VS Code TreeView.
 * Can represent a project, component, issue, or group (e.g., "Components" or "Issues").
 */
class ProjectItem extends vscode.TreeItem {
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
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private staticProjects: { [key: string]: { components: string[]; issues: string[] } } = {
        "Project A": { components: ["Component A", "Component B", "Component C"], issues: ["Issue A", "Issue B", "Issue C"] },
        "Project B": { components: ["Component D", "Component E", "Component F"], issues: ["Issue D", "Issue E", "Issue F"] },
        "Project C": { components: ["Component G", "Component H", "Component I"], issues: ["Issue G", "Issue H", "Issue I"] }
    };

    private dynamicProjects: {
        id: string;
        name: string;
        components: { id: string; name: string; description: string }[];
        issues: { id: string; title: string }[];
    }[] = [];

    constructor(private apiClient: APIClient) {}

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
                        components {
                            nodes {
                                id
                                component {
                                    id
                                    name
                                    description
                                }
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
                issues: project.issues.nodes,
                components: project.components.nodes.map((componentNode: any) => ({
                    id: componentNode.component.id,
                    name: componentNode.component.name,
                    description: componentNode.component.description || "No description available."
                }))
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
            const staticProjectItems = Object.keys(this.staticProjects).map(
                project => new ProjectItem(project, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "static")
            );
            const dynamicProjectItems = this.dynamicProjects.map(
                project => new ProjectItem(project.name, vscode.TreeItemCollapsibleState.Collapsed, undefined, project.id)
            );

            return Promise.resolve([...staticProjectItems, ...dynamicProjectItems]);
        }

        if (element.contextValue === "static") {
            return Promise.resolve([
                new ProjectItem("Components", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label, "staticGroup"),
                new ProjectItem("Issues", vscode.TreeItemCollapsibleState.Collapsed, undefined, element.label, "staticGroup")
            ]);
        }

        if (element.label === "Components" && element.parent && element.parent in this.staticProjects) {
            const projectComponents = this.staticProjects[element.parent]?.components || [];
            return Promise.resolve(
                projectComponents.map(component =>
                    new ProjectItem(component, vscode.TreeItemCollapsibleState.None, {
                        command: "extension.openComponentDetails",
                        title: "Open Component Details",
                        arguments: [{ name: component, description: "Lorem ipsum dolor sit amet." }]
                    }, element.parent)
                )
            );
        }

        if (element.label === "Issues" && element.parent && element.parent in this.staticProjects) {
            const projectIssues = this.staticProjects[element.parent]?.issues || [];
            return Promise.resolve(
                projectIssues.map(issue =>
                    new ProjectItem(issue, vscode.TreeItemCollapsibleState.None, undefined, element.parent)
                )
            );
        }

        const dynamicProject = this.dynamicProjects.find(proj => proj.name === element.label || proj.id === element.parent);
        if (dynamicProject) {
            if (element.label === "Components") {
                return Promise.resolve(
                    dynamicProject.components.map(component =>
                        new ProjectItem(component.name, vscode.TreeItemCollapsibleState.None, {
                            command: "extension.openComponentDetails",
                            title: "Open Component Details",
                            arguments: [{ name: component.name, description: component.description }]
                        }, dynamicProject.id)
                    )
                );
            } else if (element.label === "Issues") {
                return Promise.resolve(
                    dynamicProject.issues.map(issue =>
                        new ProjectItem(issue.title, vscode.TreeItemCollapsibleState.None, undefined, dynamicProject.id)
                    )
                );
            } else {
                return Promise.resolve([
                    new ProjectItem("Components", vscode.TreeItemCollapsibleState.Collapsed, undefined, dynamicProject.id),
                    new ProjectItem("Issues", vscode.TreeItemCollapsibleState.Collapsed, undefined, dynamicProject.id)
                ]);
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

/**
 * Activates the extension.
 * Registers the TreeDataProvider and sets up commands.
 * @param {vscode.ExtensionContext} context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
    const projectsProvider = new ProjectsProvider(apiClient);
    const componentDetailsProvider = new ComponentDetailsProvider();

    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);
    vscode.window.registerTreeDataProvider("componentDetailsView", componentDetailsProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.openComponentDetails", (component) => {
            componentDetailsProvider.setComponentDetails(component);
        })
    );

    apiClient.authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch(error => vscode.window.showErrorMessage(`Initialization failed: ${error.message}`));
}