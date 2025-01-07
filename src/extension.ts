import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import * as vscode from "vscode";
import { APIClient } from "./apiClient";
import { ComponentDetailsProvider } from "./views/component-details-view";

/**
 * Represents a tree item in the VS Code TreeView.
 * Can represent projects, components, issues, or any other hierarchical data.
 */
class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string, // Parent project name or identifier.
        public readonly contextValue?: string, // Context value for conditional actions.
        public readonly id?: string // Unique identifier for the item.
    ) {
        super(label, collapsibleState);

        // Tooltip for the tree item.
        this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;

        // Determine the icon type based on whether the item is a file or folder.
        this.iconPath = new vscode.ThemeIcon(
            collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
        );

        if (contextValue) {
            this.contextValue = contextValue; // Assign context value if provided.
        }
    }
}

/**
 * Provides the data for the "Projects" TreeView.
 * Manages the fetching, rendering, and interaction with dynamic projects, components, and issues.
 */
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> =
        new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    // Storage for dynamically fetched projects, components, and issues.
    private dynamicProjects: {
        id: string;
        name: string;
        components: { id: string; name: string; description: string }[];
        issues: { id: string; title: string }[];
    }[] = [];

    constructor(private apiClient: APIClient) {}

    /**
     * Refreshes the TreeView by firing a change event.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Fetches dynamic projects, components, and issues from the API.
     * Updates the TreeView with the fetched data.
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
                    description: componentNode.component.description,
                })),
            }));
            this.refresh();
        } catch (error: unknown) {
            vscode.window.showErrorMessage(
                `Failed to fetch dynamic projects: ${this.getErrorMessage(error)}`
            );
        }
    }

    /**
     * Updates a component's details (name and description) via an API mutation.
     * @param componentId The unique identifier of the component.
     * @param name The new name for the component.
     * @param description The new description for the component.
     */
    async updateComponentDetails(
        componentId: string,
        name: string,
        description: string
    ): Promise<void> {
        const mutation = `
            mutation UpdateComponent($id: ID!, $name: String, $description: String) {
                updateComponent(input: { id: $id, name: $name, description: $description }) {
                    component {
                        id
                        name
                        description
                    }
                }
            }
        `;

        try {
            const response = await this.apiClient.executeQuery(mutation, {
                id: componentId,
                name: name,
                description: description,
            });

            vscode.window.showInformationMessage(
                `Component updated successfully: ${response.data.updateComponent.component.name}`
            );

            // Refresh the data to reflect the changes.
            await this.fetchDynamicProjects();
        } catch (error: unknown) {
            vscode.window.showErrorMessage(
                `Failed to update component: ${this.getErrorMessage(error)}`
            );
        }
    }

    /**
     * Maps a given ProjectItem element to its TreeItem representation.
     * @param element The ProjectItem to map.
     * @returns The TreeItem representation.
     */
    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retrieves the children for a given tree item or the top-level items if no parent is provided.
     * @param element The parent tree item (optional).
     * @returns A promise that resolves to an array of child tree items.
     */
    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (!element) {
            const dynamicProjectItems = this.dynamicProjects.map(
                (project) =>
                    new ProjectItem(
                        project.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        undefined,
                        project.id
                    )
            );
            return Promise.resolve(dynamicProjectItems);
        }

        const dynamicProject = this.dynamicProjects.find(
            (proj) => proj.name === element.label || proj.id === element.parent
        );

        if (dynamicProject) {
            if (element.label === "Components") {
                return Promise.resolve(
                    dynamicProject.components.map(
                        (component) =>
                            new ProjectItem(
                                component.name,
                                vscode.TreeItemCollapsibleState.None,
                                {
                                    command: "extension.editComponentDetails",
                                    title: "Edit Component Details",
                                    arguments: [component],
                                },
                                dynamicProject.id,
                                "component"
                            )
                    )
                );
            } else if (element.label === "Issues") {
                return Promise.resolve(
                    dynamicProject.issues.map(
                        (issue) =>
                            new ProjectItem(
                                issue.title,
                                vscode.TreeItemCollapsibleState.None,
                                undefined,
                                dynamicProject.id
                            )
                    )
                );
            } else {
                return Promise.resolve([
                    new ProjectItem(
                        "Components",
                        vscode.TreeItemCollapsibleState.Collapsed,
                        undefined,
                        dynamicProject.id
                    ),
                    new ProjectItem(
                        "Issues",
                        vscode.TreeItemCollapsibleState.Collapsed,
                        undefined,
                        dynamicProject.id
                    ),
                ]);
            }
        }

        return Promise.resolve([]);
    }

    /**
     * Retrieves a human-readable error message from an error object.
     * @param error The error object.
     * @returns A string message describing the error.
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return typeof error === "string" ? error : "An unknown error occurred";
    }
}

/**
 * Activates the extension and registers commands, providers, and views.
 * @param context The extension context provided by VS Code.
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
        vscode.commands.registerCommand("extension.editComponentDetails", (component) => {
            componentDetailsProvider.setComponentDetails(component);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentTitle", async (component) => {
            const newTitle = await vscode.window.showInputBox({
                prompt: "Enter new component title",
                value: component.name,
            });

            if (newTitle) {
                await projectsProvider.updateComponentDetails(component.id, newTitle, component.description);
                componentDetailsProvider.setComponentDetails({
                    ...component,
                    name: newTitle,
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentDescription", async () => {
            if (componentDetailsProvider.component) {
                const newDescription = await vscode.window.showInputBox({
                    prompt: "Edit Component Description",
                    value: componentDetailsProvider.component.description,
                });

                if (newDescription) {
                    await projectsProvider.updateComponentDetails(
                        componentDetailsProvider.component.id,
                        componentDetailsProvider.component.name,
                        newDescription
                    );

                    componentDetailsProvider.setComponentDetails({
                        ...componentDetailsProvider.component,
                        description: newDescription,
                    });
                }
            }
        })
    );

    apiClient.authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch((error) =>
            vscode.window.showErrorMessage(`Initialization failed: ${error.message}`)
        );
}