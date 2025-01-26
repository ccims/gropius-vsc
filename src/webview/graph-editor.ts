import { createApp } from 'vue';
import GraphEditor from './GraphEditor.vue';

declare global {
    interface Window {
        acquireVsCodeApi(): {
            postMessage(message: any): void;
            getState(): any;
            setState(state: any): void;
        };
    }
}

const vscodeApi = window.acquireVsCodeApi();

const app = createApp(GraphEditor, {
    vscodeApi: vscodeApi
});

app.mount('#app');