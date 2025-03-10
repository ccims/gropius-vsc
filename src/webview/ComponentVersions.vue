<template>
  <div id="app">
    <ul v-if="components.length">
      <li
        v-for="component in components"
        :key="component.id"
        class="component-item"
      >
        <!-- The entire row is clickable and toggles the description -->
        <div class="component-title-line" @click="toggleDescription(component.id)">
          <span class="component-name">{{ component.name }}</span>
          (v<span class="component-version">
            {{ component.versions?.nodes?.[0]?.version || "N/A" }}
          </span>)
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
      // Listen for the message with the correct command:
      if (message && message.command === "updateComponentVersions") {
        this.components = message.data;
      }
    });
  },
  methods: {
    toggleDescription(componentId) {
      // Create a new object to trigger reactivity in Vue 3.
      this.expanded = {
        ...this.expanded,
        [componentId]: !this.expanded[componentId]
      };
    }
  }
};
</script>

<style scoped>
/* Match the Explorer style with minimal spacing and a left indent */
#app {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground, #cccccc);
  margin: 0;
  padding: 0 0 0 16px; /* Align with the tree above */
}

/* Remove default list styling */
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Each component item with a thin divider */
.component-item {
  border-bottom: 1px solid var(--vscode-settings-dropdownBorder, #555);
  padding: 0;
}

.component-item:last-child {
  border-bottom: none;
}

/* The entire clickable row */
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

/* Component name: normal weight */
.component-name {
  font-weight: normal;
}

/* Version text styling */
.component-version {
  color: var(--vscode-foreground, #cccccc);
}

/* Description styling: light grey and indented */
.component-description {
  color: #999999;
  margin-left: 8px;
  margin-top: 2px;
  font-size: 0.9rem;
}
</style>
