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
      <div v-if="component && component.issues && component.issues.length > 0" class="issues-section">
        <h2>Issues</h2>
        <ul class="issues-list">
          <li v-for="issue in component.issues" :key="issue.id" class="issue-item">
            <p class="issue-title">{{ issue.title }}</p>
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
    vscode.postMessage({ command: "vueAppReady" });

    window.addEventListener("message", (event) => {
      if (event.data) {
        this.component = event.data;
        this.editableTitle = event.data.name || "";
        this.editableDescription = event.data.description || "";
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
  },
};
</script>

<style scoped>
/* General Styling */
#app {
  font-family: Arial, sans-serif;
  background-color: #1e1e1e;
  color: white;
  padding: 20px;
}

/* Card for Component Details */
.component-details-card {
  background-color: #2b2b2b;
  border-radius: 10px;
  padding: 20px;
  width: 600px;
  margin: 0 auto;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
}

/* Component Title and Description */
.component-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #ffffff;
}

.component-description {
  font-size: 16px;
  margin-bottom: 20px;
  color: #cccccc;
}

/* Editor Section */
.editor-section {
  margin-top: 20px;
}

.label {
  display: block;
  font-weight: bold;
  margin: 10px 0 5px;
  color: #dddddd;
}

.input-field,
.textarea-field {
  width: calc(100% - 20px); /* Adjusted to add padding around */
  padding: 10px;
  font-size: 14px;
  background-color: #3c3c3c;
  color: white;
  border: 1px solid #4a4a4a;
  border-radius: 5px;
}

.textarea-field {
  height: 100px;
  resize: none;
}

/* Save Button */
.save-button {
  background-color: #007acc;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  font-size: 14px;
  margin-top: 10px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.save-button:hover {
  background-color: #005f9e;
}

.save-button:disabled {
  background-color: #555555;
  cursor: not-allowed;
}

/* Issues Section */
.issues-section {
  margin-top: 30px;
}

.issues-list {
  list-style-type: none;
  padding: 0;
}

.issue-item {
  background-color: #3c3c3c;
  border: 1px solid #4a4a4a;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 10px;
  transition: background-color 0.3s ease;
}

.issue-item:hover {
  background-color: #505050;
}

.issue-title {
  font-size: 14px;
  color: #ffffff;
}

/* No Issues Found */
.no-issues {
  margin-top: 20px;
  font-size: 14px;
  color: #888888;
  text-align: center;
}
</style>
