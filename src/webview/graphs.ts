import { createApp } from 'vue';
import Graphs from './Graphs.vue';

const app = createApp(Graphs);
app.mount('#app');
// Optionally expose the instance if needed:
(window as any).vueApp = app;
