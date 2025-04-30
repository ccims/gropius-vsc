<template>
  <!-- Load VS Code’s codicon font library -->
  <link
    href="https://cdn.jsdelivr.net/npm/@vscode/codicons@latest/dist/codicon.css"
    rel="stylesheet"
  />

  <!-- Root wrapper for padding/scrolling -->
  <div class="webview-root">
    <!-- Workspace-graph button, wrapped in a flex toolbar -->
    <div class="showGraph">
      <div class="version-toolbar">
        <button class="graph-button" @click="openWorkspaceGraph">
          Graph
        </button>
      </div>
    </div>

    <!-- Main component‐versions view -->
    <div class="gropius-component-versions">
      <!-- Loading indicator -->
      <div v-if="loading" class="loading">
        <p>Loading component versions…</p>
      </div>

      <!-- Empty state message -->
      <div v-else-if="treeItems.length === 0" class="empty-state">
        <p>No component versions found. Please check your folder mappings.</p>
      </div>

      <!-- Tree of component versions -->
      <div class="component-tree">
        <div
          class="tree-item"
          v-for="(item, index) in treeItems"
          :key="index"
        >
          <!-- Wrap node + description so hover works on both -->
          <div
            class="node-container"
            @mouseenter="hoveredItem = item"
            @mouseleave="hoveredItem = null"
          >
            <!-- Row representing name + twistie + versions -->
            <div
              class="tree-node"
              :class="{ 'has-children': item.children && item.children.length > 0 }"
              @click="handleNodeClick(item)"
            >
              <!-- Expand/collapse twistie -->
              <span v-if="item.children && item.children.length > 0" class="twisty">
                <span v-if="item.expanded" class="codicon codicon-chevron-down"></span>
                <span v-else class="codicon codicon-chevron-right"></span>
              </span>

              <!-- Fallback icon when no children -->
              <img
                v-else
                class="custom-icon"
                :src="customIconPath"
                alt="Component"
                @error="handleImageError"
              />

              <!-- Component name -->
              <span class="node-name">
                {{ item.name }}
              </span>

              <!-- Version badges -->
              <span class="version-tags">
                <span
                  class="version-tag"
                  v-for="(version, vIndex) in item.versions"
                  :key="vIndex"
                  @click.stop="handleVersionClick(item, version, vIndex)"
                  :class="{
                    clicked: clickedVersion === `${item.id}-${version}-${vIndex}`,
                    active: activeVersion === `${item.id}-${version}-${vIndex}`
                  }"
                >
                  {{ version }}
                </span>
              </span>
            </div>

            <!-- Description shown on hover -->
            <div
              class="description-panel"
              v-if="hoveredItem === item && item.description"
            >
              {{ item.description }}
            </div>
          </div>

          <!-- Render child nodes recursively -->
          <div
            class="children"
            v-if="item.expanded && item.children && item.children.length > 0"
          >
            <div
              class="tree-item"
              v-for="(child, childIndex) in item.children"
              :key="childIndex"
            >
              <div
                class="node-container"
                @mouseenter="hoveredItem = child"
                @mouseleave="hoveredItem = null"
              >
                <div class="tree-node child-node" @click="handleNodeClick(child)">
                  <img
                    class="custom-icon"
                    :src="customIconPath"
                    alt="Component"
                    @error="handleImageError"
                  />

                  <span class="node-name">
                    {{ child.name }}
                  </span>

                  <span class="version-tags">
                    <span
                      class="version-tag"
                      v-for="(version, vIndex) in child.versions"
                      :key="vIndex"
                      @click.stop="handleVersionClick(child, version, vIndex)"
                      :class="{
                        clicked: clickedVersion === `${child.id}-${version}-${vIndex}`,
                        active: activeVersion === `${child.id}-${version}-${vIndex}`
                      }"
                    >
                      {{ version }}
                    </span>
                  </span>
                </div>

                <div
                  class="description-panel"
                  v-if="hoveredItem === child && child.description"
                >
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
  id?: string;                // GraphQL node ID
  componentVersionIds?: string[];
  name: string;               // Display name
  description?: string;
  versions?: string[];
  children?: TreeItem[];
  expanded: boolean;          // UI state
}

// VS Code Webview API
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
};
const vscode = acquireVsCodeApi();

export default defineComponent({
  name: 'GropiusComponentVersions',

  setup() {
    // === Reactive state ===
    const loading = ref(true);
    const treeItems = ref<TreeItem[]>([]);
    const customIconPath = ref((window as any).customIconPath || '');
    const hoveredItem = ref<TreeItem | null>(null);

    const clickedVersion = ref<string | null>(null);
    const clickFeedbackTimer = ref<number | null>(null);

    const activeVersion = ref<string | null>(null);
    const activeComponent = ref<string | null | undefined>(null);

    // === Handlers ===

    // When a version badge is clicked
    const handleVersionClick = (
      item: TreeItem,
      version: string,
      index: number
    ) => {
      const uniqueId = `${item.id}-${version}-${index}`;
      const versionId = item.componentVersionIds?.[index];

      // Show click feedback briefly
      clickedVersion.value = uniqueId;
      if (clickFeedbackTimer.value !== null) {
        clearTimeout(clickFeedbackTimer.value);
      }
      clickFeedbackTimer.value = setTimeout(() => {
        clickedVersion.value = null;
      }, 500) as unknown as number;

      activeVersion.value = uniqueId;

      if (versionId) {
        vscode.postMessage({
          command: 'showComponentVersionIssues',
          data: {
            componentName: item.name,
            version,
            componentId: item.id,
            componentVersionId: versionId
          }
        });
      } else {
        console.error(
          "[GropiusComponentVersions.vue] handleVersionClick: Missing versionId for",
          item
        );
      }
    };

    // Click on the node row
    const handleNodeClick = (item: TreeItem) => {
      if (item.children?.length) {
        toggleExpand(item);
      } else if (item.id) {
        handleComponentClick(item);
      }
    };

    // Toggle expand/collapse of children
    const toggleExpand = (item: TreeItem) => {
      item.expanded = !item.expanded;
    };

    // Image load error fallback
    const handleImageError = (event: Event) => {
      console.error('Failed to load icon:', customIconPath.value);
      (event.target as HTMLImageElement).style.display = 'none';
    };

    // Click on a component (no children)
    const handleComponentClick = (item: TreeItem) => {
      activeComponent.value = item.id;
      activeVersion.value = null;
      if (item.id) {
        vscode.postMessage({
          command: 'showComponentIssues',
          data: {
            componentName: item.name,
            componentId: item.id
          }
        });
      } else {
        console.error(
          "[GropiusComponentVersions.vue] handleComponentClick: Missing componentId for",
          item
        );
      }
    };

    // Show the workspace-level graph
    const openWorkspaceGraph = () => {
      vscode.postMessage({ command: 'showWorkspaceGraph' });
    };

    // === Lifecycle ===
    onMounted(() => {
      document.body.classList.add('vscode-codicon-host');
      vscode.postMessage({ command: 'getComponentVersions' });

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'componentVersionsData') {
          // Initialize our tree
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
      customIconPath,
      hoveredItem,
      clickedVersion,
      activeVersion,
      activeComponent,
      handleVersionClick,
      handleNodeClick,
      handleImageError,
      handleComponentClick,
      openWorkspaceGraph
    };
  }
});
</script>

<style>

#app {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground, #cccccc);
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  max-width: 100%;
  margin-left: -25px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

body {
  padding: 0 0 0 25px !important;
}

.webview-root {
  margin: 0;
  padding: 0 0 0 12px;
  text-align: left;
  display: block;
  max-width: 100%;
}

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

.loading, .empty-state {
  text-align: center;
  padding: 20px;
}

.empty-state {
  color: var(--vscode-disabledForeground);
}

.tree-item {
  margin-bottom: 0px;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  height: 22px;
  line-height: 22px;
  font-size: var(--vscode-font-size);
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.tree-node:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.codicon {
  font-family: 'codicon' !important;
  font-size: 16px;
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  margin-right: 4px;
  user-select: none;
}

.codicon-chevron-right:before { content: "\ea6a"; }
.codicon-chevron-down:before  { content: "\ea69"; }

.custom-icon {
  width: 20px;
  height: 20px;
  margin-right: 6px;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
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
  box-shadow: 0 0 0 1px rgba(0,120,212,0.4);
  transform: translateY(-1px);
}

.version-tag.clicked {
  background-color: var(--vscode-button-background, #0e639c);
  transform: translateY(1px);
  box-shadow: 0 0 0 1px rgba(0,120,212,0.6);
}

.version-tag.active {
  background-color: var(--vscode-button-background, #0e639c);
  border: 1px solid var(--vscode-button-border, #0e639c);
}

.children {
  margin-left: 16px;
}

.child-node {
  padding-left: 0px;
}

.has-children {
  font-weight: normal;
}

.description-panel {
  margin-top: 2px;
  margin-left: 2px;
  padding: 8px 12px;
  background-color: var(--vscode-editor-background);
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  border-radius: 0 3px 3px 0;
  line-height: 1.6;
  animation: slideUpFade 0.3s ease forwards;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  cursor: text;
  user-select: text;
  word-wrap: break-word;
  overflow-wrap: break-word;
  opacity: 0;
  transform: translateY(5px);
}

@keyframes slideUpFade {
  0% { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
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

.twisty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 22px;
  margin-right: 4px;
}

/* Workspace graph button container */
.showGraph {
  position: relative;
  top: 0;
  right:0;
}

.graph-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  margin-top: 0;
}

.graph-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

/* Flex wrapper for right-aligning the graph button */
.version-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: 4px 8px;
  align-items: center;
}
</style>
