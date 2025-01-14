import * as vscode from "vscode";
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { ComponentDetailsProvider } from "./views/component-details-view";
import { IssueDetailsProvider } from "./views/issue-details-view";

class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string,
        public readonly contextValue?: string,
        public readonly id?: string
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
            if (!response.data || !response.data.projects) {
                throw new Error("Projects data is missing or in an unexpected format.");
            }
            this.dynamicProjects = response.data.projects.nodes.map((project: any) => ({
                id: project.id,
                name: project.name,
                issues: project.issues.nodes.map((issue: any) => ({
                    id: issue.id,
                    title: issue.title,
                })),
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
                                {
                                    command: "extension.editIssueDetails",
                                    title: "Edit Issue Details",
                                    arguments: [issue],
                                },
                                dynamicProject.id,
                                "issue"
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

export function activate(context: vscode.ExtensionContext) {
    const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
    const projectsProvider = new ProjectsProvider(apiClient);
    const componentDetailsProvider = new ComponentDetailsProvider();
    const issueDetailsProvider = new IssueDetailsProvider();

    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);
    vscode.window.registerTreeDataProvider("componentDetailsView", componentDetailsProvider);
    vscode.window.registerTreeDataProvider("issueDetailsView", issueDetailsProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    // Component commands
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentDetails", (component) => {
            componentDetailsProvider.setComponentDetails(component);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentTitle", async () => {
            if (componentDetailsProvider.component) {
                const newTitle = await vscode.window.showInputBox({
                    prompt: "Edit Component Title",
                    value: componentDetailsProvider.component.name,
                });

                if (newTitle) {
                    await apiClient.updateComponentDetails(
                        componentDetailsProvider.component.id,
                        newTitle,
                        componentDetailsProvider.component.description
                    );

                    componentDetailsProvider.setComponentDetails({
                        ...componentDetailsProvider.component,
                        name: newTitle,
                    });
                }
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
                    await apiClient.updateComponentDetails(
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

    // Issue commands
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editIssueDetails", (issue) => {
            issueDetailsProvider.setIssueDetails(issue);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editIssueTitle", async () => {
            if (issueDetailsProvider.issue) {
                const newTitle = await vscode.window.showInputBox({
                    prompt: "Edit Issue Title",
                    value: issueDetailsProvider.issue.title,
                });

                if (newTitle) {
                    await apiClient.updateIssueDetails(
                        issueDetailsProvider.issue.id,
                        newTitle
                    );

                    issueDetailsProvider.setIssueDetails({
                        ...issueDetailsProvider.issue,
                        title: newTitle,
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