<template>
    <div id="app">
      <h1>Component Issues</h1>
      <ul v-if="issues.length">
        <li v-for="issue in issues" :key="issue.id" class="issue-item">
          <span class="issue-title">{{ issue.title }}</span>
        </li>
      </ul>
      <p v-else>No issues available.</p>
    </div>
  </template>
  
  <script>
  let vscode;
  export default {
    name: "ComponentIssues",
    data() {
      return {
        issues: []
      };
    },
    mounted() {
      if (typeof acquireVsCodeApi !== "undefined") {
        vscode = acquireVsCodeApi();
      }
      if (vscode) {
        vscode.postMessage({ command: "vueAppReady" });
      }
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message && message.command === "updateComponentIssues") {
          this.issues = message.data;
        }
      });
    }
  };
  </script>
  
  <style scoped>
  #app {
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground, #cccccc);
    margin: 0;
    padding: 8px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .issue-item {
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-settings-dropdownBorder, #555);
  }
  .issue-item:last-child {
    border-bottom: none;
  }
  .issue-title {
    font-weight: normal;
  }
  </style>
  