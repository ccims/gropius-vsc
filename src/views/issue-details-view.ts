import * as vscode from "vscode";

export class IssueDetailsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private _issue: { id: string; title: string } | null = null;

    // Getter for the issue property
    get issue(): { id: string; title: string } | null {
        return this._issue;
    }

    /**
     * Sets the details of the currently selected issue.
     * @param issue The issue to display in the details view.
     */
    setIssueDetails(issue: { id: string; title: string }): void {
        this._issue = issue;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Fetches children elements for the tree view.
     * Displays the issue title with expand/collapse functionality.
     * @param element The parent tree item (if any).
     * @returns A list of tree items to display.
     */
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this._issue) {
            return Promise.resolve([]);
        }

        if (!element) {
            const titleItem = new vscode.TreeItem("Title", vscode.TreeItemCollapsibleState.Collapsed);
            titleItem.description = this.truncateText(this._issue.title);
            titleItem.contextValue = "editTitle";
            return Promise.resolve([titleItem]);
        }

        if (element.label === "Title") {
            const titleLines = this.splitText(this._issue.title, 50);
            return Promise.resolve(
                titleLines.map((line) => new vscode.TreeItem(line, vscode.TreeItemCollapsibleState.None))
            );
        }

        return Promise.resolve([]);
    }

    /**
     * Truncates text to a maximum length and appends "..." if necessary.
     */
    private truncateText(text: string, maxLength: number = 50): string {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    }

    /**
     * Splits a string into chunks of a specified maximum length.
     */
    private splitText(text: string, maxLength: number): string[] {
        const lines: string[] = [];
        for (let i = 0; i < text.length; i += maxLength) {
            lines.push(text.slice(i, i + maxLength));
        }
        return lines;
    }
}