import { createApp } from 'vue';
import GraphIssue from './GraphIssue.vue';

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

const app = createApp(GraphIssue, {
    vscodeApi: vscodeApi
});

app.mount('#app');