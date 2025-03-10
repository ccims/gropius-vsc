<template>
  <div id="app">
    <ul v-if="components.length">
      <li
        v-for="component in components"
        :key="component.id"
        class="component-item"
      >
        <!-- The entire row is clickable and shows a lighter background on hover -->
        <div
          class="component-title-line"
          @click="toggleDescription(component.id)"
        >
          <span class="component-name">{{ component.name }}</span>
          (v<span class="component-version">
            {{ component.versions?.nodes?.[0]?.version || "N/A" }}
          </span>)
        </div>
        <!-- Description is shown only if expanded[component.id] is true -->
        <p
          class="component-description"
          v-if="expanded[component.id]"
        >
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
      expanded: {}
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
      if (message && message.command === "updateComponents") {
        this.components = message.data;
      }
    });
  },
  methods: {
    toggleDescription(componentId) {
      if (this.expanded[componentId] === undefined) {
        this.expanded[componentId] = false;
      }
      this.expanded[componentId] = !this.expanded[componentId];
    }
  }
};
</script>

<style scoped>
/* Match the Explorer style with minimal spacing and a left indent. */
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

/* Each component item with minimal spacing and a divider */
.component-item {
  border-bottom: 1px solid var(--vscode-settings-dropdownBorder, #555);
  padding: 0;
}

.component-item:last-child {
  border-bottom: none;
}

/* The clickable line for the component's name and version */
.component-title-line {
  cursor: pointer;
  display: block;       /* Let the entire row be clickable */
  padding: 4px 0 4px 8px; /* Some left padding for the text */
  width: 100%;
}

/* Hover effect: lighter background color for the entire row */
.component-title-line:hover {
  background-color: var(--vscode-list-hoverBackground, #2a2d2e);
}

/* Normal text (no bold) for the component name */
.component-name {
  font-weight: normal;
}

/* Keep version text subdued */
.component-version {
  color: var(--vscode-foreground, #cccccc);
}

/* Description is toggled. It's hidden unless expanded[component.id] is true. */
.component-description {
  color: #999999; /* lighter text for the description */
  margin-left: 8px;
  margin-top: 2px;
  font-size: 0.9rem;
}
</style>
