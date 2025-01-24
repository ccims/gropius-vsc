<template>
    <div class="h-full position-relative">
      <div :id="editorId" class="sprotty h-full" />
    </div>
  </template>
  
  <script setup lang="ts">
  import "reflect-metadata";
  import {
    Graph,
    GraphLayout,
    GraphModelSource,
    SelectedElement,
    createContainer,
    CreateRelationContext
  } from "@gropius/graph-editor";
  import { TYPES } from "sprotty";
  import { PropType, onMounted, shallowRef, ref, computed } from "vue";
  import { v4 as uuidv4 } from "uuid";
  
  // Declare vscode API
  declare const vscode: {
    postMessage(message: any): void;
  };
  
  const props = defineProps({
    projectId: {
      type: String,
      default: "test-project-id"
    }
  });
  
  // Use refs for reactive state
  const editorId = ref(`graph-editor-${uuidv4()}`);
  const modelSource = shallowRef<CustomModelSource>();
  const projectData = ref<any>(null);
  
  class CustomModelSource extends GraphModelSource {
    protected override handleCreateRelation(context: CreateRelationContext): void {
      console.log('Create relation:', context);
    }
  
    protected override layoutUpdated(partialUpdate: GraphLayout, resultingLayout: GraphLayout): void {
      console.log('Layout updated:', resultingLayout);
    }
  
    protected override handleSelectionChanged(selectedElements: SelectedElement<any>[]): void {
      console.log('Selection changed:', selectedElements);
    }
  
    protected override navigateToElement(element: string): void {
      console.log('Navigate to:', element);
    }
  }
  
  function createGraphData(data: any = null): { graph: Graph; layout: GraphLayout } {
    if (!data?.node) {
      // Return test data if no project data available
      return {
        graph: {
          components: [
            {
              id: 'comp1',
              name: 'Component 1',
              version: '1.0',
              style: {
                shape: 'RECT',
                fill: { color: '#dbeafe' },
                stroke: { color: '#2563eb' }
              },
              interfaces: [],
              contextMenu: {},
              issueTypes: []
            }
          ],
          relations: [],
          issueRelations: []
        },
        layout: {
          comp1: { pos: { x: 100, y: 100 } }
        }
      };
    }
  
    const project = data.node;
    const graph: Graph = {
      components: [],
      relations: [],
      issueRelations: []
    };
    const layout: GraphLayout = {};
  
    // Process components and their layouts
    if (project.components?.nodes) {
      project.components.nodes.forEach((node: any) => {
        const template = node.component?.template || {};
        graph.components.push({
          id: node.id,
          name: node.component?.name || 'Unnamed',
          version: String(node.version || '1.0'),
          style: {
            shape: template.shapeType || 'RECT',
            fill: { color: template.fill?.color || '#dbeafe' },
            stroke: { color: template.stroke?.color || '#2563eb' }
          },
          interfaces: [],
          contextMenu: {},
          issueTypes: []
        });
      });
    }
  
    // Apply layouts from relationPartnerLayouts
    if (project.relationPartnerLayouts?.nodes) {
      project.relationPartnerLayouts.nodes.forEach((layoutNode: any) => {
        if (layoutNode.relationPartner?.id && layoutNode.pos) {
          layout[layoutNode.relationPartner.id] = {
            pos: layoutNode.pos
          };
        }
      });
    }
  
    return { graph, layout };
  }
  
  // Handle messages from extension
  function handleMessage(event: MessageEvent) {
    const message = event.data;
    switch (message.type) {
      case 'projectData':
        projectData.value = message.data;
        updateGraph(message.data);
        break;
    }
  }
  
  // Update graph with new data
  function updateGraph(data: any = null) {
    if (!modelSource.value) return;
  
    const { graph, layout } = createGraphData(data);
    modelSource.value.updateGraph({
      graph,
      layout,
      fitToBounds: true
    });
  }
  
  onMounted(() => {
    // Initialize the container and model source
    const container = createContainer(editorId.value);
    container.bind(CustomModelSource).toSelf().inSingletonScope();
    container.bind(TYPES.ModelSource).toService(CustomModelSource);
    modelSource.value = container.get<CustomModelSource>(CustomModelSource);
  
    // Set up message handling
    window.addEventListener('message', handleMessage);
  
    // Initialize with test data
    updateGraph();
  
    // Request project data from extension
    vscode.postMessage({ 
      type: 'ready', 
      projectId: props.projectId 
    });
  });
  </script>
  
  <style scoped>
  :deep(.sprotty) {
    height: 100%;
  }
  
  :deep(.sprotty svg) {
    width: 100%;
    height: 100%;
    --diagram-grid: rgba(0, 0, 0, 0.1);
    --background-overlay-color: rgba(0, 0, 0, 0.05);
    --shape-stroke-color: #374151;
    --version-chip-background: #ffffff;
    --version-chip-color: #374151;
    --selected-shape-stroke-color: #3b82f6;
    --selected-shape-fill-color: rgba(59, 130, 246, 0.1);
  }
  </style>