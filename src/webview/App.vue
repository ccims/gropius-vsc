<template>
    <div class="graph-editor h-full">
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
  import { onMounted, ref, watch } from "vue";
  import { v4 as uuidv4 } from "uuid";
  
  // Props for graph data
  const props = defineProps<{
    graph: Graph;
    layout: GraphLayout;
  }>();
  
  // Emit events for graph interactions
  const emit = defineEmits<{
    (event: 'update:layout', value: GraphLayout): void;
    (event: 'selectionChanged', value: SelectedElement<any>[]): void;
  }>();
  
  // Create unique ID for the editor instance
  const editorId = ref(`graph-editor-${uuidv4()}`);
  const modelSource = ref<GraphModelSource>();
  
  // Custom model source to handle graph events
  class CustomModelSource extends GraphModelSource {
    protected override handleCreateRelation(context: CreateRelationContext): void {
      console.log('Relation created:', context);
    }
  
    protected override layoutUpdated(partialUpdate: GraphLayout, resultingLayout: GraphLayout): void {
      emit('update:layout', resultingLayout);
    }
  
    protected override handleSelectionChanged(selectedElements: SelectedElement<any>[]): void {
      emit('selectionChanged', selectedElements);
    }
  
    protected override navigateToElement(element: string): void {
      console.log('Navigate to:', element);
    }
  }
  
  // Initialize the graph after component is mounted
  onMounted(() => {
    const container = createContainer(editorId.value);
    container.bind(CustomModelSource).toSelf().inSingletonScope();
    container.bind(TYPES.ModelSource).toService(CustomModelSource);
    modelSource.value = container.get<CustomModelSource>(CustomModelSource);
  
    // Initialize with empty graph
    const initialGraph: Graph = {
      components: [
        {
          id: 'comp1',
          name: 'Component 1',
          version: '1.0',
          style: {
            shape: 'RECT',
            stroke: { color: '#2563eb' },
            fill: { color: '#dbeafe' }
          },
          interfaces: [],
          contextMenu: {},
          issueTypes: []
        },
        {
          id: 'comp2',
          name: 'Component 2',
          version: '1.0',
          style: {
            shape: 'RECT',
            stroke: { color: '#16a34a' },
            fill: { color: '#dcfce7' }
          },
          interfaces: [],
          contextMenu: {},
          issueTypes: []
        }
      ],
      relations: [
        {
          id: 'rel1',
          name: 'Connects',
          start: 'comp1',
          end: 'comp2',
          style: {
            stroke: { color: '#6b7280' },
            marker: 'ARROW'
          },
          contextMenu: {}
        }
      ],
      issueRelations: []
    };
  
    const initialLayout: GraphLayout = {
      comp1: { pos: { x: 100, y: 100 } },
      comp2: { pos: { x: 300, y: 100 } }
    };
  
    // Update the graph with initial data
    modelSource.value?.updateGraph({
      graph: initialGraph,
      layout: initialLayout,
      fitToBounds: true
    });
  });
  
  // Watch for graph data changes
  watch(() => props.graph, (newGraph) => {
    modelSource.value?.updateGraph({
      graph: newGraph,
      fitToBounds: false
    });
  });
  
  // Watch for layout changes
  watch(() => props.layout, (newLayout) => {
    modelSource.value?.updateGraph({
      layout: newLayout,
      fitToBounds: true
    });
  });
  </script>
  
  <style scoped>
  .graph-editor {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  
  :deep(.sprotty svg) {
    width: 100%;
    height: 100%;
    --diagram-grid: #f3f4f6;
    --background-overlay-color: rgba(0, 0, 0, 0.05);
    --shape-stroke-color: #374151;
    --version-chip-background: #ffffff;
    --version-chip-color: #374151;
    --selected-shape-stroke-color: #3b82f6;
    --selected-shape-fill-color: rgba(59, 130, 246, 0.1);
  }
  </style>