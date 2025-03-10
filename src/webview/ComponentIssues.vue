<template>
    <div id="app">
      <ul v-if="issues.length">
        <li v-for="issue in issues" :key="issue.id" class="component-item">
          <div class="component-title-line">
            <span class="component-name">{{ issue.title }}</span>
          </div>
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
  
  <!-- We omit <style> here, since all styling is in global.css -->
  