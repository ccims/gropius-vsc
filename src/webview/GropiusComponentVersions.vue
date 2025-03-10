<template>
    <div class="gropius-component-versions">
      <div v-if="loading" class="loading">
        <p>Loading component versions...</p>
      </div>
      <div v-else class="component-tree">
        <div class="tree-item" v-for="(item, index) in treeItems" :key="index">
          <div 
            class="tree-node"
            :class="{ 'has-children': item.children && item.children.length > 0 }"
            @click="toggleExpand(item)"
          >
            <span class="icon" v-if="item.children && item.children.length > 0">
              {{ item.expanded ? '▼' : '►' }}
            </span>
            <span class="icon component-icon" v-else>📦</span>
            <span class="node-name">{{ item.name }}</span>
            <span class="version-tags" v-if="item.versions && item.versions.length > 0">
              <span class="version-tag" v-for="(version, vIndex) in item.versions" :key="vIndex">
                {{ version }}
              </span>
            </span>
          </div>
          
          <div class="children" v-if="item.expanded && item.children && item.children.length > 0">
            <div class="tree-item" v-for="(child, childIndex) in item.children" :key="childIndex">
              <div class="tree-node child-node">
                <span class="icon component-icon">📦</span>
                <span class="node-name">{{ child.name }}</span>
                <span class="version-tags" v-if="child.versions && child.versions.length > 0">
                  <span class="version-tag" v-for="(version, vIndex) in child.versions" :key="vIndex">
                    {{ version }}
                  </span>
                </span>
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
  
      // Function to toggle the expanded state of a tree item
      const toggleExpand = (item: TreeItem) => {
        item.expanded = !item.expanded;
      };
  
      onMounted(() => {
        // Request component version data from the extension
        vscode.postMessage({ command: 'getComponentVersions' });
  
        // Listen for messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          if (message.command === 'componentVersionsData') {
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
        toggleExpand
      };
    }
  });
  </script>
  
  <style>
  .gropius-component-versions {
    padding: 10px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
  }
  
  .loading {
    text-align: center;
    padding: 20px;
  }
  
  .tree-item {
    margin-bottom: 4px;
  }
  
  .tree-node {
    display: flex;
    align-items: center;
    padding: 5px;
    border-radius: 3px;
    cursor: pointer;
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
  
  .component-icon {
    color: #3794ff;
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
  </style>