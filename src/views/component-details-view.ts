import * as vscode from "vscode";

export class ComponentDetailsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private _component: { id: string; name: string; description: string } | null = null;

    // Getter for the component property
    get component(): { id: string; name: string; description: string } | null {
        return this._component;
    }

    setComponentDetails(component: { id: string; name: string; description: string }) {
        this._component = component;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this._component) {
            return Promise.resolve([]);
        }

        if (!element) {
            return Promise.resolve([
                new vscode.TreeItem(this._component.name, vscode.TreeItemCollapsibleState.None),
                new vscode.TreeItem("Description", vscode.TreeItemCollapsibleState.Collapsed),
            ]);
        }

        if (element.label === "Description") {
            const descriptionItem = new vscode.TreeItem(
                this._component.description,
                vscode.TreeItemCollapsibleState.None
            );
            descriptionItem.contextValue = "editDescription"; // Add context for editing
            return Promise.resolve([descriptionItem]);
        }

        return Promise.resolve([]);
    }
}
