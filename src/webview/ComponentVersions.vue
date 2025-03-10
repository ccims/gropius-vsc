<template>
  <div id="app">
    <ul v-if="components.length">
      <li v-for="component in components" :key="component.id" class="component-item">
        <!-- The entire row is clickable: toggles description and sends the component id -->
        <div class="component-title-line" @click="handleClick(component)">
          <span class="component-name">{{ component.name }}</span>
          <span class="component-versions">{{ formatVersions(component.versions.nodes) }}</span>
        </div>
        <!-- The description is shown only if expanded[component.id] is true -->
        <p class="component-description" v-if="expanded[component.id]">
          {{ component.description }}
        </p>
      </li>
    </ul>
    <p v-else>No components available.</p>
  </div>
</template>

<script>
let vscode;
export default {
  name: "ComponentVersions",
  data() {
    return {
      components: [],
      expanded: {} // maps component IDs to booleans
    };
  },
  mounted() {
    if (typeof acquireVsCodeApi !== "undefined") {
      vscode = acquireVsCodeApi();
    }
    if (vscode) {
      // Notify the extension that this Vue app is ready.
      vscode.postMessage({ command: "vueAppReady" });
    }
    window.addEventListener("message", (event) => {
      const message = event.data;
      // Listen for the message with command "updateComponentVersions"
      if (message && message.command === "updateComponentVersions") {
        this.components = message.data;
      }
    });
  },
  methods: {
    toggleDescription(componentId) {
      // Update the expanded state to trigger reactivity.
      this.expanded = {
        ...this.expanded,
        [componentId]: !this.expanded[componentId]
      };
    },
    handleClick(component) {
      this.toggleDescription(component.id);
      if (vscode) {
        // Send the component id so that the issues view can filter issues for that component.
        vscode.postMessage({ command: "selectComponent", componentId: component.id });
      }
    },
    formatVersions(versions) {
      if (!versions || !versions.length) return "";
      // Map each version to a string "(v<version>)" and join them with a space.
      return versions.map(v => `(v${v.version})`).join(" ");
    }
  }
};
</script>

<style scoped>
/* Match Explorer style: minimal spacing with a left indent */
#app {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground, #cccccc);
  margin: 0;
  padding: 0 0 0 16px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.component-item {
  border-bottom: 1px solid var(--vscode-settings-dropdownBorder, #555);
  padding: 0;
}

.component-item:last-child {
  border-bottom: none;
}

/* Entire clickable row */
.component-title-line {
  cursor: pointer;
  display: block;
  padding: 4px 0 4px 8px;
  width: 100%;
}

/* Hover effect: background color change */
.component-title-line:hover {
  background-color: var(--vscode-list-hoverBackground, #2a2d2e);
}

.component-name {
  font-weight: normal;
}

.component-versions {
  margin-left: 8px;
  font-style: italic;
  color: var(--vscode-foreground, #cccccc);
}

.component-description {
  color: #999999;
  margin-left: 8px;
  margin-top: 2px;
  font-size: 0.9rem;
}
</style>
