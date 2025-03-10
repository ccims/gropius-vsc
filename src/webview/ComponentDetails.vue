<template>
  <div id="app">
    <div class="component-details-card">
      <!-- Component Title and Description -->
      <h1 class="component-title">{{ editableTitle }}</h1>
      <p class="component-description">{{ editableDescription }}</p>

      <!-- Editor Section -->
      <div class="editor-section">
        <label for="title" class="label">Title:</label>
        <input
          id="title"
          class="input-field"
          v-model="editableTitle"
          @input="markEdited"
        />
        <label for="description" class="label">Description:</label>
        <textarea
          id="description"
          class="textarea-field"
          v-model="editableDescription"
          @input="markEdited"
        ></textarea>
        <button class="save-button" @click="saveChanges" :disabled="!isEdited">
          Save
        </button>
      </div>

      <!-- Issues Section -->
      <div
        v-if="component && component.issues && component.issues.length > 0"
        class="issues-section"
      >
        <h2>Issues</h2>
        <ul class="issues-list">
          <li v-for="issue in component.issues" :key="issue.id" class="issue-item">
            <p class="issue-title">
              {{ issue.type?.name || "Unknown Type" }}: {{ issue.title }}
            </p>
          </li>
        </ul>
      </div>
      <div v-else class="no-issues" v-if="component">
        <p>No issues found for this component.</p>
      </div>
    </div>
  </div>
</template>

<script>
let vscode; // We'll store the VS Code API object here

export default {
  name: "ComponentDetails",
  data() {
    return {
      component: null,
      editableTitle: "",
      editableDescription: "",
      isEdited: false,
    };
  },
  mounted() {
    // Grab the VS Code API object if it exists
    if (typeof acquireVsCodeApi !== "undefined") {
      vscode = acquireVsCodeApi();
    }

    // If we have the API, let the extension know this Vue app is ready
    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
    }

    // Listen for messages from the extension
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.command === "updateComponentDetails") {
        this.updateComponent(message.data);
      }
    });
  },
  methods: {
    markEdited() {
      this.isEdited =
        this.editableTitle !== this.component?.name ||
        this.editableDescription !== this.component?.description;
    },
    saveChanges() {
      if (!vscode) return;
      const updatedComponent = {
        id: this.component.id,
        name: this.editableTitle,
        description: this.editableDescription,
      };
      vscode.postMessage({
        command: "updateComponent",
        data: updatedComponent,
      });
      this.isEdited = false;
    },
    updateComponent(newComponent) {
      this.component = newComponent;
      this.editableTitle = newComponent.name || "";
      this.editableDescription = newComponent.description || "";
      this.isEdited = false;
    },
  },
};
</script>

<style scoped>
/* Use VS Code theme variables for fonts/colors where possible */
#app {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 14px);
  color: var(--vscode-foreground, #cccccc);
  background: var(--vscode-editor-background, #1e1e1e);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 10px;
}

/* The container for component details */
.component-details-card {
  /* Remove background, borders, and shadows for a simpler look */
  background-color: transparent;
  padding: 0;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
}

/* Title & description */
.component-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--vscode-editor-foreground, #cccccc);
}

.component-description {
  font-size: 1rem;
  margin-bottom: 16px;
  color: var(--vscode-editor-foreground, #cccccc);
}

/* Editor Section */
.editor-section {
  margin-top: 16px;
}

.label {
  display: block;
  font-weight: bold;
  margin: 10px 0 5px;
  color: var(--vscode-foreground, #dddddd);
}

.input-field,
.textarea-field {
  width: 100%;
  padding: 8px;
  font-size: 14px;
  background-color: var(--vscode-editor-background, #3c3c3c);
  color: var(--vscode-editor-foreground, #ffffff);
  border: 1px solid var(--vscode-editorWidget-border, #4a4a4a);
  border-radius: 3px;
  margin-bottom: 8px;
  box-sizing: border-box;
}

.textarea-field {
  height: 80px;
  resize: none;
}

/* Save Button */
.save-button {
  background-color: var(--vscode-button-background, #007acc);
  color: var(--vscode-button-foreground, #ffffff);
  border: none;
  border-radius: 3px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.save-button:hover {
  background-color: var(--vscode-button-hoverBackground, #005f9e);
}

.save-button:disabled {
  background-color: #555555;
  cursor: not-allowed;
}

/* Issues Section */
.issues-section {
  margin-top: 20px;
}

.issues-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.issue-item {
  background-color: var(--vscode-editor-background, #3c3c3c);
  border: 1px solid var(--vscode-editorWidget-border, #4a4a4a);
  border-radius: 3px;
  padding: 8px;
  margin-bottom: 8px;
  transition: background-color 0.3s ease;
}

.issue-item:hover {
  background-color: #505050;
}

.issue-title {
  font-size: 14px;
  color: var(--vscode-editor-foreground, #ffffff);
}

/* No Issues Found */
.no-issues {
  margin-top: 20px;
  font-size: 14px;
  color: #888888;
  text-align: center;
}
</style>