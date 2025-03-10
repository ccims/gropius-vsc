import { createApp } from 'vue';
import ComponentDetails from './ComponentDetails.vue';

const app = createApp(ComponentDetails);
const vm = app.mount('#app');
// Expose the mounted instance globally so that the webview can call updateComponent:
(window as any).vueApp = vm;
