<template>
    <div id="app">
      <ul v-if="projects.length">
        <li v-for="project in projects" :key="project.id" class="project-item">
          <div class="project-name">{{ project.name }}</div>
          <button class="show-graph-btn" @click="onShowGraph(project.id)">
            Show Graph
          </button>
        </li>
      </ul>
      <p v-else>No projects available.</p>
    </div>
  </template>
  
  <script>
  let vscode;
  export default {
    name: "GraphsView",
    data() {
      return {
        projects: []
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
        if (message.command === "updateProjects") {
          this.projects = message.data;
        }
      });
    },
    methods: {
      onShowGraph(projectId) {
        if (vscode) {
          vscode.postMessage({ command: "showGraph", projectId });
        }
      }
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
  .project-item {
    border-bottom: 1px solid var(--vscode-settings-dropdownBorder, #555);
    padding: 8px 0;
  }
  .project-item:last-child {
    border-bottom: none;
  }
  .project-name {
    margin-bottom: 4px;
  }
  .show-graph-btn {
    background-color: var(--vscode-button-background, #007acc);
    color: var(--vscode-button-foreground, #ffffff);
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .show-graph-btn:hover {
    background-color: var(--vscode-button-hoverBackground, #005f9e);
  }
  </style>
  