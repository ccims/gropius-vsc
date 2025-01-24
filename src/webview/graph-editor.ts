import { createApp } from 'vue';
import GraphEditor from './GraphEditor.vue';

// Create the Vue app and mount it
const app = createApp(GraphEditor, {
    // You can pass props here if needed
    projectId: "3a24498b-5134-4c27-a15c-a1b03514b81d"
});

app.mount('#app');