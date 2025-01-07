import * as vscode from 'vscode';

/**
 * TreeDataProvider for the "COMPONENT DETAILS" section.
 */
export class ComponentDetailsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private componentDetails: { name: string; description: string } | null = null;

    /**
     * Refreshes the TreeView when data changes.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Sets the component details to display in the TreeView.
     * @param component - The selected component.
     */
    setComponentDetails(component: { name: string; description: string }): void {
        this.componentDetails = component;
        this.refresh();
    }

    /**
     * Gets the TreeItem for the given element.
     * @param element - The TreeItem element.
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Provides the children of the TreeView.
     * @param element - The parent TreeItem.
     */
    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!this.componentDetails) {
            return []; // No component selected yet
        }

        if (!element) {
            // Top-level: Component Name and Description groups
            return [
                new vscode.TreeItem(this.componentDetails.name, vscode.TreeItemCollapsibleState.Collapsed),
                new vscode.TreeItem("Description", vscode.TreeItemCollapsibleState.Collapsed)
            ];
        }

        if (element.label === "Description") {
            // Show description as a child
            return [
                new vscode.TreeItem(this.componentDetails.description, vscode.TreeItemCollapsibleState.None)
            ];
        }

        return [];
    }
}