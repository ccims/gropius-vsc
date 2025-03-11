<template>
    <div id="app">
      <ul v-if="issues.length">
        <li v-for="issue in issues" :key="issue.id" class="component-item">
          <div class="component-title-line">
            <img :src="getIconPath(issue.type.name, issue.state.isOpen)" class="issue-icon" alt="Issue Icon" />
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
    },
    methods: {
      getIconPath(type, isOpen) {
        switch (type) {
          case "Bug":
            return Boolean(isOpen) ? new URL("../../resources/icons/bug-green.png", import.meta.url).href : new URL("../../resources/icons/bug-red.png", import.meta.url).href
          case "Misc":
            return Boolean(isOpen) ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href
          case "Feature":
            return Boolean(isOpen) ? new URL("../../resources/icons/magnifier-green.png", import.meta.url).href : new URL("../../resources/icons/magnifier-red.png", import.meta.url).href
            case "Task":
            return Boolean(isOpen) ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href

          }
      }
    }
  };
  </script>
  
  <!-- We omit <style> here, since all styling is in global.css -->
  