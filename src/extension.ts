import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import * as vscode from "vscode";
import { APIClient } from "./apiClient";
import { ComponentDetailsProvider } from "./views/component-details-view";

/**
 * Represents a tree item in the VS Code TreeView.
 */
class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string, // Parent project name
        public readonly contextValue?: string, // Context value for tree item
        public readonly id?: string // Optional ID for dynamic items
    ) {
        super(label, collapsibleState);

        this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;
        this.iconPath = new vscode.ThemeIcon(
            collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
        );

        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}

/**
 * Provides the data for the "Projects" TreeView.
 */
class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> =
        new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

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

            const updatedComponent = response.data.updateComponent.component;
            vscode.window.showInformationMessage(
                `Component updated successfully: ${updatedComponent.name}`
            );

            await this.fetchDynamicProjects();
        } catch (error: unknown) {
            vscode.window.showErrorMessage(
                `Failed to update component: ${this.getErrorMessage(error)}`
            );
        }
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

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
                                "component" // <-- Setting the contextValue for menu matching
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

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return typeof error === "string" ? error : "An unknown error occurred";
    }
}

/**
 * Activates the extension.
 */
export function activate(context: vscode.ExtensionContext) {
    const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
    const projectsProvider = new ProjectsProvider(apiClient);
    const componentDetailsProvider = new ComponentDetailsProvider();

    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);
    vscode.window.registerTreeDataProvider("componentDetailsView", componentDetailsProvider);

    // Register the "Refresh" command
    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    // Register the "Edit Component Title" command
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentTitle", async (component) => {
            console.log("Edit Component Title Command Invoked:", component);
    
            const newName = await vscode.window.showInputBox({
                prompt: "Enter new component name",
                value: component.name, // Pre-fill with the current name
            });
    
            if (newName) {
                console.log("Updating Component Title to:", newName);
    
                await projectsProvider.updateComponentDetails(
                    component.id,
                    newName,
                    component.description // Keep the current description
                );
    
                componentDetailsProvider.setComponentDetails({
                    ...component,
                    name: newName,
                });
    
                vscode.window.showInformationMessage(`Component title updated to: ${newName}`);
            }
        })
    );        

    // Register the "Edit Component Description" command
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

    // Register the "Edit Component Details" command
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentDetails", (component) => {
            componentDetailsProvider.setComponentDetails(component);
        })
    );

    // Authenticate and fetch dynamic projects initially
    apiClient.authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch((error) =>
            vscode.window.showErrorMessage(`Initialization failed: ${error.message}`)
        );
}