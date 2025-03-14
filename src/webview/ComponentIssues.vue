<template>
  <div id="app">
    <ul v-if="issues.length">
      <li 
        v-for="issue in issues" 
        :key="issue.id" 
        class="component-item"
        @click="openIssueDetails(issue.id)"
      >
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
    // Restore persisted state if available
    const state = vscode.getState();
    if (state && state.issues) {
      this.issues = state.issues;
      console.log("[ComponentIssues.vue] Restored persisted issues:", this.issues);
    }
    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
    }
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message && message.command === "updateComponentIssues") {
        this.issues = message.data;
        vscode.setState({ issues: this.issues });
      }
    });
  },
  methods: {
    getIconPath(type, isOpen) {
      switch (type) {
        case "Bug":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/bug-green.png", import.meta.url).href
            : new URL("../../resources/icons/bug-red.png", import.meta.url).href;
        case "Misc":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        case "Feature":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href
            : new URL("../../resources/icons/lightbulb-feature-red.png", import.meta.url).href;
        case "Task":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
      }
    },
    openIssueDetails(issueId) {
      console.log("ComponentIssues.vue: Opening issue details for issue id:", issueId);
      // Send a message with command "issueClicked" and the correct issue id
      vscode.postMessage({ command: "issueClicked", issueId });
    }
  }
};
</script>
