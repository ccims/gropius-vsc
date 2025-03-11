<template>
    <div id="app">
      <div v-if="issue">
        <h2>{{ issue.title }}</h2>
        <p><strong>ID:</strong> {{ issue.id }}</p>
        <p><strong>Description:</strong> {{ issue.description }}</p>
        <p>
          <strong>Type:</strong>
          {{ issue.type ? issue.type.name : 'N/A' }}
        </p>
        <p>
          <strong>Status:</strong>
          <span v-if="issue.state && issue.state.isOpen">Open</span>
          <span v-else>Closed</span>
        </p>
        <p v-if="issue.component">
          <strong>Component:</strong>
          {{ issue.component.name }} (ID: {{ issue.component.id }})
        </p>
        <p v-if="issue.project">
          <strong>Project:</strong>
          {{ issue.project.name }} (ID: {{ issue.project.id }})
        </p>
        <p v-if="issue.body">
          <strong>Body:</strong> {{ issue.body.body }}
          <em>(Last modified: {{ issue.body.lastModifiedAt }})</em>
        </p>
        <p v-if="issue.estimatedTime !== undefined">
          <strong>Estimated Time:</strong> {{ issue.estimatedTime }}
        </p>
        <p v-if="issue.hasPermission !== undefined">
          <strong>Has READ permission:</strong> {{ issue.hasPermission ? 'Yes' : 'No' }}
        </p>
      </div>
      <p v-else>No issue selected.</p>
    </div>
  </template>
  
  <script>
  let vscode;
  export default {
    name: "IssueDetails",
    data() {
      return {
        issue: null
      };
    },
    mounted() {
      console.log("[IssueDetails.vue] Mounted");
      if (typeof acquireVsCodeApi !== "undefined") {
        vscode = acquireVsCodeApi();
        console.log("[IssueDetails.vue] vscode API acquired");
      } else {
        console.error("[IssueDetails.vue] acquireVsCodeApi is undefined");
      }
      // Restore persisted state if available
      const state = vscode.getState();
      if (state && state.issue) {
        this.issue = state.issue;
        console.log("[IssueDetails.vue] Restored persisted issue:", this.issue);
      }
      window.addEventListener("message", (event) => {
        console.log("[IssueDetails.vue] Received message event:", event);
        const message = event.data;
        console.log("[IssueDetails.vue] Message data:", message);
        if (message && message.command === "displayIssue") {
          console.log("[IssueDetails.vue] Processing displayIssue message");
          this.issue = message.issue;
          vscode.setState({ issue: this.issue });
          if (this.issue) {
            console.log("[IssueDetails.vue] Issue updated:", this.issue);
          } else {
            console.warn("[IssueDetails.vue] Received null issue");
          }
        }
      });
      if (vscode) {
        vscode.postMessage({ command: "vueAppReady" });
        console.log("[IssueDetails.vue] Posted vueAppReady message");
      }
    }
  };
  </script>
  