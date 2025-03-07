import * as vscode from "vscode";
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { FETCH_DYNAMIC_PROJECTS_QUERY, FETCH_PROJECT_GRAPH_QUERY } from "./queries";

/**
 * Represents a single item in the projects tree view.
 */
class ProjectItem extends vscode.TreeItem {
    /**
     * Creates a new ProjectItem.
     * @param label - The label of the item.
     * @param collapsibleState - Whether the item can be expanded.
     * @param command - Optional command to run when the item is clicked.
     * @param parent - The parent project ID.
     * @param contextValue - Context for when-clause expressions.
     * @param id - Unique identifier for the item.
     * @param isButton - Flag to indicate if this item should be styled as a button.
     */
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly parent?: string,
        public readonly contextValue?: string,
        public readonly id?: string,
        public readonly isButton: boolean = false
    ) {
        super(label, collapsibleState);

        if (isButton) {
            // Style for button items
            this.iconPath = new vscode.ThemeIcon("graph");
            this.command = {
                command: 'projectsView.showProjectGraph',
                title: 'Show Graph',
                arguments: [parent]  // Pass the project ID as an argument
            };
        } else {
            // Regular item styling
            this.tooltip = this.parent ? `${this.parent}: ${this.label}` : this.label;
            this.iconPath = new vscode.ThemeIcon(
                collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder"
            );
        }

        this.contextValue = contextValue;
    }
}

/**
 * Provides project data for the VS Code tree view.
 */
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

    constructor(private apiClient: APIClient) {}

    /**
     * Triggers the tree view to refresh.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Fetches dynamic projects data from the server using the FETCH_DYNAMIC_PROJECTS_QUERY.
     */
    async fetchDynamicProjects(): Promise<void> {
        const query = FETCH_DYNAMIC_PROJECTS_QUERY;

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

    /**
     * Returns the tree item representation for an element.
     * @param element - The ProjectItem.
     */
    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retrieves the children of a given tree item.
     * @param element - The parent ProjectItem. If omitted, returns the root projects.
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
                // Project level – return sections and a button
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
                    new ProjectItem(
                        "Show Graph",
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        dynamicProject.id,
                        undefined,
                        undefined,
                        true // This is a button item
                    )
                ]);
            }
        }

        return Promise.resolve([]);
    }

    /**
     * Helper method to extract the error message.
     * @param error - The error object.
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return typeof error === "string" ? error : "An unknown error occurred";
    }
}

/**
 * Creates the HTML content for the Graph Editor webview.
 * @param scriptUri - The URI of the Graph Editor script.
 * @returns The HTML content as a string.
 */
function getGraphEditorHtml(scriptUri: vscode.Uri): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Graph Editor</title>
            <style>
                html, body {
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                #app {
                    height: 100vh;
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div id="app"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>
    `;
}

/**
 * Creates and returns a configured Graph Editor webview panel.
 * @param context - The extension context.
 * @returns The configured webview panel.
 */
function createGraphEditorPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
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
    panel.webview.html = getGraphEditorHtml(scriptUri);
    return panel;
}

/**
 * Activates the extension.
 * @param context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const apiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);
    const projectsProvider = new ProjectsProvider(apiClient);

    /**
     * Opens a Graph Editor webview for a given project ID.
     * @param projectId - The ID of the project.
     */
    async function showGraphForProject(projectId: string) {
        const panel = createGraphEditorPanel(context);

        // Listen for messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Message from webview:', message);
            if (message.type === 'ready') {
                try {
                    await apiClient.authenticate();
                    // Fetch graph data for the specified project
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
            }
        });

        panel.reveal(vscode.ViewColumn.One);
    }

    /**
     * Fetches the project graph data using the FETCH_PROJECT_GRAPH_QUERY.
     * @param projectId - The ID of the project.
     * @returns The fetched project data.
     */
    async function fetchProjectGraphData(projectId: string) {
        const query = FETCH_PROJECT_GRAPH_QUERY;

        try {
            await apiClient.authenticate();
            const response = await apiClient.executeQuery(query, { project: projectId });

            console.log('\n==================== START SERVER RESPONSE ====================');
            console.log('Project ID:', projectId);
            if (response.data?.node?.components?.nodes) {
                console.log('Components found:', response.data.node.components.nodes.length);
                response.data.node.components.nodes.forEach((comp: any, index: number) => {
                    console.log(`\nComponent ${index + 1} Details:`);
                    console.log('Name:', comp.component?.name);
                    console.log('Number of issues:', comp.aggregatedIssues?.nodes?.length || 0);
                    console.log('Number of interfaces:', comp.interfaceDefinitions?.nodes?.length || 0);
                });
            } else {
                console.log('No components found in response');
            }
            console.log('==================== END SERVER RESPONSE ====================\n');

            // Attach the project ID to the response data for reference
            if (response.data) {
                response.data.id = projectId;
            }
            
            return response.data;
        } catch (error) {
            console.error('GraphQL error:', error);
            throw new Error(`Failed to fetch project graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Register the "extension.showGraph" command (for standalone graph view)
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.showGraph", async () => {
            const panel = createGraphEditorPanel(context);

            // Listen for messages from the webview
            panel.webview.onDidReceiveMessage(async (message) => {
                console.log('Message from webview:', message);
                if (message.type === 'ready') {
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
                }
            });

            panel.reveal(vscode.ViewColumn.One);
        })
    );

    // Register the tree view for projects
    vscode.window.registerTreeDataProvider("projectsView", projectsProvider);

    // Register the command to refresh the projects view
    context.subscriptions.push(
        vscode.commands.registerCommand("projectsView.refresh", async () => {
            await apiClient.authenticate();
            await projectsProvider.fetchDynamicProjects();
        })
    );

    // Register the command to show the project graph from a tree view button
    context.subscriptions.push(
        vscode.commands.registerCommand('projectsView.showProjectGraph', (projectId: string) => {
            showGraphForProject(projectId);
        })
    );

    // Register the command to edit component details
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

            // Set up the HTML content for the component details view
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

            // Handle messages from the component details webview
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

    // Initial authentication and projects load
    apiClient
        .authenticate()
        .then(() => projectsProvider.fetchDynamicProjects())
        .catch((error) =>
            vscode.window.showErrorMessage(
                `Initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
            )
        );
}
