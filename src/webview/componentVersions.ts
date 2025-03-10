import { createApp } from 'vue';
import ComponentsView from './ComponentVersions.vue';

const app = createApp(ComponentsView);
const vm = app.mount('#app');
// Optionally expose the instance globally if needed:
(window as any).vueComponentsApp = vm;
console.log("ComponentsView mounted.");
