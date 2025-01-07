import * as vscode from "vscode";

/**
 * Provides the data and functionality for the "Component Details" TreeView.
 * Displays the details of a selected component, such as its title and description.
 */
export class ComponentDetailsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    // Stores the details of the currently selected component.
    private _component: { id: string; name: string; description: string } | null = null;

    /**
     * Getter for the currently selected component.
     * @returns The currently selected component or null if no component is selected.
     */
    get component(): { id: string; name: string; description: string } | null {
        return this._component;
    }

    /**
     * Updates the details of the currently selected component.
     * @param component The component to display in the "Component Details" view.
     */
    setComponentDetails(component: { id: string; name: string; description: string }): void {
        this._component = component;
        this._onDidChangeTreeData.fire(); // Notify VS Code that the tree data has changed.
    }

    /**
     * Returns the tree item representation of a given element.
     * @param element The tree item element.
     * @returns The tree item representation.
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retrieves the children elements for the tree view.
     * Displays the component's name as a title and its description as an editable field.
     * @param element The parent tree item, if any.
     * @returns A promise resolving to an array of child tree items.
     */
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this._component) {
            // No component selected, so return an empty array.
            return Promise.resolve([]);
        }

        if (!element) {
            // Top-level items: Title and Description sections.
            const titleItem = new vscode.TreeItem(`Title: ${this._component.name}`);
            titleItem.contextValue = "editTitle"; // Context value for conditional actions.
            titleItem.command = {
                command: "extension.editComponentTitle", // Command triggered on click.
                title: "Edit Component Title",
                arguments: [this._component], // Pass the current component as an argument.
            };

            const descriptionItem = new vscode.TreeItem("Description", vscode.TreeItemCollapsibleState.Collapsed);
            return Promise.resolve([titleItem, descriptionItem]);
        }

        if (element.label === "Description") {
            // Display the description as an editable item.
            const descriptionDetailItem = new vscode.TreeItem(
                this._component.description,
                vscode.TreeItemCollapsibleState.None
            );
            descriptionDetailItem.contextValue = "editDescription"; // Context value for editing the description.
            descriptionDetailItem.command = {
                command: "extension.editComponentDescription", // Command triggered on click.
                title: "Edit Component Description",
                arguments: [this._component], // Pass the current component as an argument.
            };
            return Promise.resolve([descriptionDetailItem]);
        }

        return Promise.resolve([]);
    }
}