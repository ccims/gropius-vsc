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
    projectId: "3a24498b-5134-4c27-a15c-a1b03514b81d",  
    vscodeApi: vscodeApi  
});

app.mount('#app');