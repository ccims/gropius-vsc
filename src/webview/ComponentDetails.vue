<template>
  <div id="app">
    <h1>Component Details</h1>
    <div v-if="component">
      <p><strong>Title:</strong></p>
      <input v-model="editableTitle" @input="markEdited" />

      <p><strong>Description:</strong></p>
      <textarea v-model="editableDescription" @input="markEdited"></textarea>

      <button @click="saveChanges" :disabled="!isEdited">Save</button>
    </div>
    <div v-else>
      <p>No component selected.</p>
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
    // Notify VS Code that the app is ready
    vscode.postMessage({ command: "vueAppReady" });

    // Listen for messages from VS Code
    window.addEventListener("message", (event) => {
      console.log("Raw event data received:", event);

      if (event.data) {
        console.log("Processed component data:", event.data);
        this.component = event.data;
        this.editableTitle = event.data.name || "";
        this.editableDescription = event.data.description || "";
        console.log("Vue component updated with:", {
          component: this.component,
          editableTitle: this.editableTitle,
          editableDescription: this.editableDescription,
        });
      } else {
        console.warn("No data received in message.");
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

      console.log("Sending updated component data to VS Code:", updatedComponent);
      vscode.postMessage({
        command: "updateComponent",
        data: updatedComponent,
      });

      this.isEdited = false;
    },
  },
};
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: Arial, sans-serif;
}

input,
textarea {
  margin: 10px 0;
  width: 100%;
  padding: 8px;
  font-size: 14px;
}

button {
  padding: 10px 20px;
  background-color: #0074d9;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

h1 {
  color: #333;
}
</style>
