<template>
    <div class="gropius-component-versions">
        <div v-if="loading" class="loading">
            <p>Loading component versions...</p>
        </div>
        <div v-else-if="treeItems.length === 0" class="empty-state">
            <p>No component versions found. Please check your folder mappings.</p>
        </div>
        <div class="component-tree">
            <div class="tree-item" v-for="(item, index) in treeItems" :key="index">
                <!-- Wrap both the node and its description in a single container -->
                <div class="node-container" @mouseenter="hoveredItem = item" @mouseleave="hoveredItem = null">
                    <div class="tree-node" :class="{ 'has-children': item.children && item.children.length > 0 }"
                        @click="toggleExpand(item)">
                        <span class="icon" v-if="item.children && item.children.length > 0">
                            {{ item.expanded ? '▾' : '▸' }}
                        </span>
                        <img v-else class="custom-icon" :src="customIconPath" alt="Component"
                            @error="handleImageError" />

                        <span class="node-name">
                            {{ item.name }}
                        </span>

                        <span class="version-tags" v-if="item.versions && item.versions.length > 0">
                            <span class="version-tag" v-for="(version, vIndex) in item.versions" :key="vIndex">
                                {{ version }}
                            </span>
                        </span>
                    </div>

                    <div class="description-panel" v-if="hoveredItem === item && item.description">
                        {{ item.description }}
                    </div>
                </div>

                <div class="children" v-if="item.expanded && item.children && item.children.length > 0">
                    <div class="tree-item" v-for="(child, childIndex) in item.children" :key="childIndex">
                        <!-- Same pattern for child nodes -->
                        <div class="node-container" @mouseenter="hoveredItem = child" @mouseleave="hoveredItem = null">
                            <div class="tree-node child-node">
                                <img class="custom-icon" :src="customIconPath" alt="Component"
                                    @error="handleImageError" />

                                <span class="node-name">
                                    {{ child.name }}
                                </span>

                                <span class="version-tags" v-if="child.versions && child.versions.length > 0">
                                    <span class="version-tag" v-for="(version, vIndex) in child.versions" :key="vIndex">
                                        {{ version }}
                                    </span>
                                </span>
                            </div>

                            <div class="description-panel" v-if="hoveredItem === child && child.description">
                                {{ child.description }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';

interface TreeItem {
    name: string;
    description?: string;
    versions?: string[];
    children?: TreeItem[];
    expanded: boolean;
}

// Acquire the vscode API
declare const acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
    setState: (state: any) => void;
    getState: () => any;
};

const vscode = acquireVsCodeApi();

export default defineComponent({
    name: 'GropiusComponentVersions',
    setup() {
        const loading = ref(true);
        const treeItems = ref<TreeItem[]>([]);
        const customIconPath = ref((window as any).customIconPath || '');
        const hoveredItem = ref<TreeItem | null>(null);

        // Function to toggle the expanded state of a tree item
        const toggleExpand = (item: TreeItem) => {
            item.expanded = !item.expanded;
        };

        const handleImageError = (event: Event) => {
            console.error('Failed to load icon:', customIconPath.value);
            // Use a fallback icon if the image fails to load
            (event.target as HTMLImageElement).style.display = 'none';
        };

        onMounted(() => {
            // Request component version data from the extension
            vscode.postMessage({ command: 'getComponentVersions' });

            // Listen for messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;

                if (message.command === 'componentVersionsData') {
                    console.log("Received component versions data:", message.data);
                    treeItems.value = message.data.map((item: any) => ({
                        ...item,
                        expanded: false
                    }));
                    loading.value = false;
                }
            });
        });

        return {
            loading,
            treeItems,
            toggleExpand,
            customIconPath,
            handleImageError,
            hoveredItem
        };
    }
});
</script>

<style>
.node-container {
    margin-bottom: 4px;
    cursor: pointer;
}

.gropius-component-versions {
    padding: 0;
    margin: 0;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
}

.loading {
    text-align: center;
    padding: 20px;
}

.empty-state {
    text-align: center;
    padding: 20px;
    color: var(--vscode-disabledForeground);
}

.tree-item {
    margin-bottom: 4px;
}

.tree-node {
    display: flex;
    align-items: center;
    padding: 5px;
    border-radius: 3px;
}

.tree-node:hover {
    background-color: var(--vscode-list-hoverBackground);
}

.icon {
    margin-right: 6px;
    display: inline-block;
    min-width: 16px;
    text-align: center;
}

.custom-icon {
    width: 16px;
    height: 16px;
    margin-right: 6px;
}

.node-name {
    flex-grow: 1;
}

.version-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.version-tag {
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.85em;
}

.children {
    margin-left: 20px;
    margin-top: 4px;
}

.child-node {
    padding-left: 4px;
}

.has-children {
    font-weight: bold;
}

.description-panel {
    margin-top: 2px;
    margin-left: 2px;
    padding: 3px 5px;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    border-radius: 0 3px 3px 0;
    line-height: 1.4;
    animation: fadeIn 0.2s ease-in;
    word-wrap: break-word;
    overflow-wrap: break-word;
    cursor: text;
    user-select: text;
    /* Animation properties */
    opacity: 0;
    transform: translateY(5px);
    animation: slideUpFade 0.3s ease forwards;
}

@keyframes slideUpFade {
    0% {
        opacity: 0;
        transform: translateY(5px);
    }

    100% {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>