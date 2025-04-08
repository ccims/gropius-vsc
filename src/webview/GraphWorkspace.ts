import { createApp } from 'vue';
import GraphWorkspace from './GraphWorkspace.vue';

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

const app = createApp(GraphWorkspace, {
    vscodeApi: vscodeApi
});

app.mount('#app');