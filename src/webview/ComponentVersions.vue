<template>
  <div id="app">
    <ul v-if="components.length">
      <li v-for="component in components" :key="component.id" class="component-item">
        <!-- The row is clickable to send the component id, and shows description on hover -->
        <div class="component-title-line"
             @click="selectComponent(component.id)"
             @mouseenter="hoveredComponent = component.id"
             @mouseleave="hoveredComponent = null">
          <span class="component-name">{{ component.name }}</span>
          <span class="component-versions">{{ formatVersions(component.versions.nodes) }}</span>
        </div>
        <!-- Show description only when hovered -->
        <p class="component-description" v-if="hoveredComponent === component.id">
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
        hoveredComponent: null
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
        if (message && message.command === "updateComponentVersions") {
          this.components = message.data;
        }
      });
    },
    methods: {
      selectComponent(componentId) {
        if (vscode) {
          // Send the component id to trigger the issues view update.
          vscode.postMessage({ command: "selectComponent", componentId });
        }
      },
      formatVersions(versions) {
        if (!versions || !versions.length) return "";
        // Format each version as "(vX)" and join them with a space.
        return versions.map(v => `(v${v.version})`).join(" ");
      }
    }
  };
</script>

<!-- No <style> block here since we're relying on global.css -->