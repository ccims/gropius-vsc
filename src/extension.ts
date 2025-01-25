import * as vscode from "vscode";
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";

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
        components: {
            id: string;
            name: string;
            description: string;
            version: number;
            issues: { id: string; title: string; type: { name: string } }[];
        }[];
        issues: { id: string; title: string }[];
    }[] = [];

    constructor(private apiClient: APIClient) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async fetchDynamicProjects(): Promise<void> {
        const query = `
            query MyQuery {
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
                                version
                                component {
                                    id
                                    name
                                    description
                                    issues {
                                        nodes {
                                            id
                                            title
                                            type {
                                                name
                                            }
                                        }
                                    }
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
                    version: componentNode.version,
                    issues: componentNode.component.issues.nodes.map((issue: any) => ({
                        id: issue.id,
                        title: issue.title,
                        type: issue.type,
                    })),
                })),
            }));
            this.refresh();
        } catch (error) {
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
            if (element.label === "Component Versions") {
                return Promise.resolve(
                    dynamicProject.components.map(
                        (component) =>
                            new ProjectItem(
                                `v${component.version} ${component.name}`,
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
                                dynamicProject.id,
                                "issue"
                            )
                    )
                );
            } else {
                return Promise.resolve([
                    new ProjectItem(
                        "Component Versions",
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

    async function fetchProjectGraphData(projectId: string) {
        const query = `query getProjectGraph($project: ID!) {
            node(id: $project) {
                ... on Project {
                    ...GraphInfo
                    relationLayouts {
                        nodes {
                            relation {
                                id
                            }
                            points {
                                x
                                y
                            }
                        }
                    }
                    relationPartnerLayouts {
                        nodes {
                            relationPartner {
                                id
                            }
                            pos {
                                x
                                y
                            }
                        }
                    }
                }
            }
        }
        
        fragment GraphInfo on Project {
            components {
                nodes {
                    ...GraphComponentVersionInfo
                }
            }
            manageComponents: hasPermission(permission: MANAGE_COMPONENTS)
            defaultView {
                id
            }
        }
    
        fragment GraphComponentVersionInfo on ComponentVersion {
            version
            id
            component {
                id
                name
                template {
                    id
                    name
                    fill {
                        color
                    }
                    stroke {
                        color
                        dash
                    }
                    shapeType
                    shapeRadius
                }
            }
            
            aggregatedIssues {
                nodes {
                    id
                    type {
                        id
                        name
                        iconPath
                    }
                    count
                    isOpen
                    outgoingRelations(filter: { end: { relationPartner: { partOfProject: $project } } }) {
                        nodes {
                            end {
                                id
                                relationPartner {
                                    id
                                }
                            }
                            type {
                                name
                                id
                            }
                        }
                    }
                }
            }

            outgoingRelations {
                nodes {
                    id
                    end {
                        id
                    }
                    template {
                        name
                        stroke {
                            color
                            dash
                        }
                        markerType
                    }
                }
            }
            
            interfaceDefinitions {
                nodes {
                    visibleInterface {
                        id
                    }
                    interfaceSpecificationVersion {
                        id
                        version
                        interfaceSpecification {
                            id
                            name
                            template {
                                id
                                name
                                fill {
                                    color
                                }
                                stroke {
                                    color
                                    dash
                                }
                                shapeType
                                shapeRadius
                            }
                        }
                    }
                }
            }

        }`;

        try {
            await apiClient.authenticate();  // Ensure we're authenticated before query
            const response = await apiClient.executeQuery(query, {
                project: projectId
            });
            console.log('GraphQL response:', response);  // Debug log
            return response.data;
        } catch (error) {
            console.error('GraphQL error:', error);  // Debug log
            throw new Error(`Failed to fetch project graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.showGraph", async () => {
            const panel = vscode.window.createWebviewPanel(
                "graphEditor",
                "Graph Editor",
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')]
                }
            );

            const scriptUri = panel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'graphEditor.js')
            );

            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Graph Editor</title>
                </head>
                <body>
                    <div id="app"></div>
                    <script src="${scriptUri}"></script>
                </body>
                </html>
            `;

            panel.webview.onDidReceiveMessage(async (message) => {
                console.log('Message from webview:', message);
                switch (message.type) {
                    case 'ready':
                        try {
                            await apiClient.authenticate();
                            const projectId = message.projectId;
                            const projectData = await fetchProjectGraphData(projectId);
                            console.log('Sending project data:', projectData);
                            panel.webview.postMessage({
                                type: 'projectData',
                                data: projectData
                            });
                        } catch (error) {
                            console.error('Failed to fetch data:', error);
                            vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
                        }
                        break;
                }
            });

            // Add after creating the panel
            panel.reveal(vscode.ViewColumn.One);
        })
    );

    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("extension.editComponentDetails", (component) => {
            if (!component) {
                vscode.window.showErrorMessage("No component data found to open.");
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                "componentDetails",
                "Component Details",
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out", "webview")],
                }
            );

            const webviewPath = vscode.Uri.joinPath(
                context.extensionUri,
                "out",
                "webview",
                "componentDetails.js"
            );

            panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Component Details</title>
            </head>
            <body>
                <div id="app"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const componentData = ${JSON.stringify(component)};
                    window.addEventListener("DOMContentLoaded", () => {
                        vscode.postMessage(componentData);
                    });
                </script>
                <script src="${panel.webview.asWebviewUri(webviewPath)}"></script>
            </body>
            </html>`;

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "vueAppReady") {
                    panel.webview.postMessage(component);
                } else if (message.command === "updateComponent") {
                    const updatedComponent = message.data;

                    try {
                        await apiClient.updateComponentDetails(
                            updatedComponent.id,
                            updatedComponent.name,
                            updatedComponent.description
                        );

                        await projectsProvider.fetchDynamicProjects();

                        vscode.window.showInformationMessage(
                            `Component updated successfully: ${updatedComponent.name}`
                        );
                    } catch (error) {
                        vscode.window.showErrorMessage(
                            error instanceof Error
                                ? `Failed to update component: ${error.message}`
                                : "An unknown error occurred during update."
                        );
                    }
                }
            });
        })
    );



    apiClient
        .authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch((error) =>
            vscode.window.showErrorMessage(
                `Initialization failed: ${error instanceof Error ? error.message : "Unknown error"
                }`
            )
        );
}
