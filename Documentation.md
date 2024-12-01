### How to build the extension

Open gropius-vsc

Run:
npm install vue @vue/compiler-sfc webpack webpack-cli vue-loader css-loader style-loader vue-tsc ts-loader --save-dev

Run:
npm run webpack

Click F5

Click Ctrl+Shift+P and then ...

### Commands

Show My Webview: Opens a custom webview in VS Code, displaying a UI powered by the Vue.js app.
- Creates a WebviewPanel in VS Code with a title (e.g., "My Webview").
- Loads the HTML content (including your Vue.js app) into the webview.
- Displays a simple interface that can be expanded with interactive components and data from your extension.

Refresh Projects: Refreshes the contents of the "Projects" Tree View in the Explorer sidebar.
- Triggers the refresh method in the ProjectsProvider Tree Data Provider.
- Updates the tree view with the latest data, such as newly added or removed projects.

Open Project: Handles the action of opening a specific project from the "Projects" Tree View.
- When a user clicks on a project in the tree, this command is triggered.
- Displays a message (e.g., Opening project: [project name]) or performs additional logic, such as opening a project-specific file or directory.

### Next Steps (i.e., Personal Notes)

- Add functionality to dynamically manage the list of projects (e.g., fetching from a server or reading from a configuration file).
- Enhance child elements for projects (e.g., tasks, files, etc.).
- Add icons or custom UI elements for better visual representation.