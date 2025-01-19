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

    /**
     * Sets the details of the currently selected component.
     * @param component The component to display in the details view.
     */
    setComponentDetails(component: { id: string; name: string; description: string }): void {
        this._component = component;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Fetches children elements for the tree view.
     * Displays the component title and description with expanded/collapsed functionality.
     * @param element The parent tree item (if any).
     * @returns A list of tree items to display.
     */
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this._component) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Always-visible items for Title and Description
            const titleItem = new vscode.TreeItem("Title", vscode.TreeItemCollapsibleState.Collapsed);
            titleItem.description = this.truncateText(this._component.name); // Show truncated title
            titleItem.contextValue = "editTitle"; // Add context for right-click editing

            const descriptionItem = new vscode.TreeItem(
                `Description`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            descriptionItem.description = this.truncateText(this._component.description); // Show truncated description
            descriptionItem.contextValue = "editDescription"; // Add context for right-click editing

            return Promise.resolve([titleItem, descriptionItem]);
        }

        if (element.label === "Title") {
            // Show the full title as multiple lines when expanded
            const titleLines = this.splitText(this._component.name, 50); // 50 chars per line
            return Promise.resolve(
                titleLines.map((line) => new vscode.TreeItem(line, vscode.TreeItemCollapsibleState.None))
            );
        }

        if (element.label === "Description") {
            // Show the full description as multiple lines when expanded
            const descriptionLines = this.splitText(this._component.description, 50); // 50 chars per line
            return Promise.resolve(
                descriptionLines.map((line) =>
                    new vscode.TreeItem(line, vscode.TreeItemCollapsibleState.None)
                )
            );
        }

        return Promise.resolve([]);
    }

    /**
     * Truncates text to a maximum length and appends "..." if necessary.
     * @param text The text to truncate.
     * @param maxLength The maximum length of the text (default is 50).
     * @returns The truncated text.
     */
    private truncateText(text: string, maxLength: number = 50): string {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    }

    /**
     * Splits a string into chunks of a specified maximum length.
     * @param text The text to split.
     * @param maxLength The maximum length of each chunk.
     * @returns An array of strings.
     */
    private splitText(text: string, maxLength: number): string[] {
        const lines: string[] = [];
        for (let i = 0; i < text.length; i += maxLength) {
            lines.push(text.slice(i, i + maxLength));
        }
        return lines;
    }
}