<template>
  <div id="app">
    <div class="component-details-card">
      <h1 class="component-title">{{ editableTitle }}</h1>
      <p class="component-description">{{ editableDescription }}</p>
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
#app {
  font-family: Arial, sans-serif;
  background-color: #1e1e1e;
  color: white;
  padding: 20px;
}

.component-details-card {
  background-color: #2b2b2b;
  border-radius: 10px;
  padding: 20px;
  width: 600px;
  margin: 0 auto;
}

.component-title {
  font-size: 24px;
  margin-bottom: 10px;
}

.component-description {
  font-size: 16px;
  margin-bottom: 20px;
}

.editor-section {
  margin-top: 20px;
}

.label {
  display: block;
  font-weight: bold;
  margin: 10px 0 5px;
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

.save-button {
  background-color: #007acc;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  font-size: 14px;
  margin-top: 10px;
  cursor: pointer;
}

.save-button:disabled {
  background-color: #555555;
  cursor: not-allowed;
}

h1 {
  color: #fff;
}
</style>