<template>
    <div> 
        <!-- Show workspace graph -->
        <div class="showGraph">
            <button class="graph-button" @click="openWorkspaceGraph">
            Graph
            </button>
        </div>
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
                            @click="handleNodeClick(item)">
                            <!-- Use the VS Code codicon for twisties -->
                            <span v-if="item.children && item.children.length > 0" class="twisty">
                                <span v-if="item.expanded"
                                    class="codicon codicon-chevron-down explorer-arrow expanded"></span>
                                <span v-else class="codicon codicon-chevron-right explorer-arrow collapsed"></span>
                            </span>
                            <img v-else class="custom-icon" :src="customIconPath" alt="Component"
                                @error="handleImageError" />

                            <span class="node-name">
                                {{ item.name }}
                            </span>

                            <span class="version-tags">
                                <span class="version-tag" v-for="(version, vIndex) in item.versions" :key="vIndex"
                                    @click.stop="handleVersionClick(item, version, vIndex)" :class="{
                                        'clicked': clickedVersion === `${item.id}-${version}-${vIndex}`,
                                        'active': activeVersion === `${item.id}-${version}-${vIndex}`
                                    }">
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
                                <div class="tree-node child-node" @click="handleNodeClick(child)">
                                    <img class="custom-icon" :src="customIconPath" alt="Component"
                                        @error="handleImageError" />

                                    <span class="node-name">
                                        {{ child.name }}
                                    </span>

                                    <span class="version-tags">
                                        <span class="version-tag" v-for="(version, vIndex) in child.versions" :key="vIndex"
                                            @click.stop="handleVersionClick(child, version, vIndex)" :class="{
                                                'clicked': clickedVersion === `${child.id}-${version}-${vIndex}`,
                                                'active': activeVersion === `${child.id}-${version}-${vIndex}`
                                            }">
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
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';

interface TreeItem {
    id?: string; // optional property
    componentVersionIds?: string[];
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

        const activeVersion = ref<string | null>(null);

        const loading = ref(true);
        const treeItems = ref<TreeItem[]>([]);
        const customIconPath = ref((window as any).customIconPath || '');
        const hoveredItem = ref<TreeItem | null>(null);

        const clickedVersion = ref<string | null>(null);
        const clickFeedbackTimer = ref<number | null>(null);

        const activeComponent = ref<string | null | undefined>(null);


        // Handle version tag click
        const handleVersionClick = (item: TreeItem, version: string, index: number) => {
            const uniqueId = `${item.id}-${version}-${index}`;
            const versionId = item.componentVersionIds && item.componentVersionIds[index];

            console.log("[GropiusComponentVersions.vue] handleVersionClick: clicked version", {
                uniqueId,
                versionId,
                componentId: item.id
            });

            // Set temporary click feedback
            clickedVersion.value = uniqueId;
            if (clickFeedbackTimer.value !== null) {
                clearTimeout(clickFeedbackTimer.value);
            }
            clickFeedbackTimer.value = setTimeout(() => {
                clickedVersion.value = null;
            }, 500) as unknown as number;

            activeVersion.value = uniqueId;

            if (versionId) {
                // Send message to trigger component version issues
                console.log("[GropiusComponentVersions.vue] Posting message 'showComponentVersionIssues' with data:", {
                componentName: item.name,
                version: version,
                componentId: item.id,
                componentVersionId: versionId
                });
                vscode.postMessage({
                command: 'showComponentVersionIssues',
                data: {
                    componentName: item.name,
                    version: version,
                    componentId: item.id,
                    componentVersionId: versionId
                }
                });
            } else {
                console.error("[GropiusComponentVersions.vue] handleVersionClick: Missing versionId for", item);
            }
        };

        const handleNodeClick = (item: TreeItem) => {
            // If the item has children, toggle expansion
            if (item.children && item.children.length > 0) {
                toggleExpand(item);
            }
            // Otherwise, handle as component click
            else if (item.id) {
                handleComponentClick(item);
            }
        };

        // Function to toggle the expanded state of a tree item
        const toggleExpand = (item: TreeItem) => {
            item.expanded = !item.expanded;
        };

        const handleImageError = (event: Event) => {
            console.error('Failed to load icon:', customIconPath.value);
            // Use a fallback icon if the image fails to load
            (event.target as HTMLImageElement).style.display = 'none';
        };

        // handle component clicks
        const handleComponentClick = (item: TreeItem) => {
            activeComponent.value = item.id;
            activeVersion.value = null;

            console.log("[GropiusComponentVersions.vue] handleComponentClick: clicked component", {
                componentName: item.name,
                componentId: item.id
            });

            if (item.id) {
                vscode.postMessage({
                command: 'showComponentIssues',
                data: {
                    componentName: item.name,
                    componentId: item.id
                }
                });
            } else {
                console.error("[GropiusComponentVersions.vue] handleComponentClick: Missing componentId for", item);
            }
        };
        const openWorkspaceGraph = () => {
            console.log("Start workspace graph!");
            if (vscode) {
                vscode.postMessage({ command: "showWorkspaceGraph" });
            }
        };

        onMounted(() => {
            document.body.classList.add('vscode-codicon-host');
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
            hoveredItem,
            clickedVersion,
            handleVersionClick,
            activeVersion,
            activeComponent,
            handleComponentClick,
            handleNodeClick,
            openWorkspaceGraph
        };
    }
});
</script>

<style>
@import "@vscode/codicons/dist/codicon.css";

.node-container {
    margin-bottom: 0;
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
    margin-bottom: 0px;
}

.tree-node {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 22px;
    line-height: 22px;
    font-size: var(--vscode-font-size);
    cursor: pointer;
}

.tree-node:hover {
    background-color: var(--vscode-list-hoverBackground);
}


.codicon {
    font-family: 'codicon' !important;
    font-size: 16px;
    font-style: normal;
    font-weight: normal;
    display: inline-block;
    text-decoration: none;
    width: 16px;
    height: 16px;
    line-height: 16px;
    margin-right: 4px;
    text-align: center;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    user-select: none;
}

.codicon-chevron-right:before {
    content: "\ea6a";
}

.codicon-chevron-down:before {
    content: "\ea69";
}

.custom-icon {
    width: 16px;
    height: 16px;
    margin-right: 6px;
}

.node-name {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.version-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.version-tag {
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.75em;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    height: 16px;
    line-height: 1.4;
    display: inline-flex;
    align-items: center;
}

.version-tag:hover {
    background-color: var(--vscode-button-hoverBackground, #0e639c);
    box-shadow: 0 0 0 1px rgba(0, 120, 212, 0.4);
    transform: translateY(-1px);
}

.version-tag.clicked {
    background-color: var(--vscode-button-background, #0e639c);
    transform: translateY(1px);
    box-shadow: 0 0 0 1px rgba(0, 120, 212, 0.6);
}

.children {
    margin-left: 16px;
    margin-top: 0px;
}

.child-node {
    padding-left: 0px;
}

.has-children {
    font-weight: normal;
}

.version-tag.active {
    background-color: var(--vscode-button-background, #0e639c);
    border: 1px solid var(--vscode-button-border, #0e639c);
}

.description-panel {
    margin-top: 2px;
    margin-left: 2px;
    padding: 8px 12px;
    background-color: var(--vscode-editor-background);
    color: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    border-radius: 0 3px 3px 0;
    line-height: 1.6;
    animation: fadeIn 0.2s ease-in;
    word-wrap: break-word;
    overflow-wrap: break-word;
    cursor: text;
    user-select: text;
    /* Animation properties */
    opacity: 0;
    transform: translateY(5px);
    animation: slideUpFade 0.3s ease forwards;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
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

.twisty .codicon {
    font-family: "codicon" !important;
}

.explorer-arrow {
    width: 16px;
    height: 22px;
    display: inline-block;
    position: relative;
}

.explorer-arrow.collapsed::before {
    content: ">";
    position: absolute;
    left: 2px;
    top: 0;
    font-size: 16px;
    line-height: 22px;
}

.explorer-arrow.expanded::before {
    content: "v";
    position: absolute;
    left: 2px;
    top: -2px;
    font-size: 16px;
    line-height: 22px;
}
.twisty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 22px;
    margin-right: 4px;
}

/* Workspace graph */

.showGraph {
  position:relative;
}
.graph-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
}
.graph-button:hover{
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}
</style>