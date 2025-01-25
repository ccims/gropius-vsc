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
  CreateRelationContext,
  LayoutEngine
} from "@gropius/graph-editor";
import { TYPES } from "sprotty";
import { PropType, onMounted, shallowRef, ref, computed } from "vue";
import { v4 as uuidv4 } from "uuid";

// Define props including the VS Code API
const props = defineProps({
  projectId: {
    type: String,
    required: true
  },
  vscodeApi: {
    type: Object,
    required: true
  }
});

// Setup reactive refs
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

async function autolayout(graph: Graph): Promise<GraphLayout> {
  const layoutEngine = new LayoutEngine(graph);
  const coordinates = await layoutEngine.layout();
  const resultingLayout: GraphLayout = {};
  coordinates.forEach((pos, id) => {
    resultingLayout[id] = { pos };
  });
  return resultingLayout;
}

function createGraphData(data: any = null): { graph: Graph; layout: GraphLayout } {
  console.log('Creating graph data from:', data);

  const project = data?.node;
  const graph: Graph = {
    components: [],
    relations: [],
    issueRelations: []
  };
  const layout: GraphLayout = {};

  // Only proceed if we have project data
  if (!project?.components?.nodes) {
    return { graph, layout };
  }

  // Process components and their interfaces
  project.components.nodes.forEach((componentNode: any) => {
    const template = componentNode.component?.template || {};

    // Process interfaces for this component
    const interfaces = componentNode.interfaceDefinitions.nodes
      .filter((def: any) => def.visibleInterface)
      .map((def: any) => {
        const interfaceSpec = def.interfaceSpecificationVersion.interfaceSpecification;
        const interfaceTemplate = interfaceSpec.template;

        // Process issue relations for interfaces
        if (def.visibleInterface.aggregatedIssues?.nodes) {
          const interfaceIssueRelations = def.visibleInterface.aggregatedIssues.nodes.flatMap((issue: any) =>
            issue.outgoingRelations?.nodes?.map((relation: any) => ({
              start: issue.id,
              end: relation.end.relationPartner.id,
              count: issue.count
            })) || []
          );
          graph.issueRelations.push(...interfaceIssueRelations);
        }

        return {
          id: def.visibleInterface.id,
          name: interfaceSpec.name,
          version: def.interfaceSpecificationVersion.version,
          style: {
            shape: interfaceTemplate.shapeType || 'HEXAGON',
            fill: { color: interfaceTemplate.fill?.color || 'transparent' },
            stroke: { color: interfaceTemplate.stroke?.color || 'rgb(209, 213, 219)' }
          },
          contextMenu: {},
          issueTypes: def.visibleInterface.aggregatedIssues?.nodes.map((issue: any) => ({
            id: issue.id,
            name: issue.type.name,
            iconPath: issue.type.iconPath,
            count: issue.count,
            isOpen: issue.isOpen
          })) || []
        };
      });

    // Process issue relations for the component
    if (componentNode.aggregatedIssues?.nodes) {
      const componentIssueRelations = componentNode.aggregatedIssues.nodes.flatMap((issue: any) =>
        issue.outgoingRelations?.nodes?.map((relation: any) => ({
          start: issue.id,
          end: relation.end.relationPartner.id,
          count: issue.count
        })) || []
      );
      graph.issueRelations.push(...componentIssueRelations);
    }

    // Add component with its interfaces and issues
    graph.components.push({
      id: componentNode.id,
      name: componentNode.component?.name || 'Unnamed',
      version: String(componentNode.version || '1.0'),
      style: {
        shape: template.shapeType || 'RECT',
        fill: { color: template.fill?.color || 'transparent' },
        stroke: { color: template.stroke?.color || 'rgb(209, 213, 219)' }
      },
      interfaces,
      contextMenu: {},
      issueTypes: componentNode.aggregatedIssues?.nodes.map((issue: any) => ({
        id: issue.id,
        name: issue.type.name,
        iconPath: issue.type.iconPath,
        count: issue.count,
        isOpen: issue.isOpen
      })) || []
    });

    // Process outgoing relations
    if (componentNode.outgoingRelations?.nodes) {
      componentNode.outgoingRelations.nodes.forEach((relation: any) => {
        if (relation.end?.id) {
          graph.relations.push({
            id: relation.id,
            name: relation.template?.name || 'Relation',
            start: componentNode.id,
            end: relation.end.id,
            style: {
              stroke: relation.template?.stroke || { color: '#1f2937' },
              marker: relation.template?.markerType || 'ARROW'
            },
            contextMenu: {}
          });
        }
      });
    }
  });

  // Apply layouts
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
  console.log('Received message:', message);
  switch (message.type) {
    case 'projectData':
      projectData.value = message.data;
      updateGraph(message.data);
      break;
  }
}

// Update graph with new data
async function updateGraph(data: any = null) {
  if (!modelSource.value) {
    console.warn('ModelSource not initialized');
    return;
  }

  const { graph, layout } = createGraphData(data);

  // If layout is empty (no saved positions), use automatic layout
  const finalLayout = Object.keys(layout).length === 0 ?
    await autolayout(graph) : layout;

  console.log('Updating graph with layout:', finalLayout);
  modelSource.value.updateGraph({
    graph,
    layout: finalLayout,
    fitToBounds: true
  });
}

onMounted(() => {
  console.log('Component mounted, initializing...');
  // Initialize the container and model source
  const container = createContainer(editorId.value);
  container.bind(CustomModelSource).toSelf().inSingletonScope();
  container.bind(TYPES.ModelSource).toService(CustomModelSource);
  modelSource.value = container.get<CustomModelSource>(CustomModelSource);

  // Set up message handling
  window.addEventListener('message', handleMessage);

  // Initialize with test data
  updateGraph();

  // Request project data from extension using the provided VS Code API
  console.log('Sending ready message...');
  props.vscodeApi.postMessage({
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

  /* Dark theme background */
  background-color: rgb(5, 5, 7);
  --diagram-grid: rgba(255, 255, 255, 0.1);

  /* The grid pattern */
  background-image: radial-gradient(circle, var(--diagram-grid) 1px, transparent 1px);
  background-size: 20px 20px;
  --background-overlay-color: rgba(255, 255, 255, 0.05);

  /* Component and interface styling */
  --shape-stroke-color: rgb(209, 213, 219);
  --version-chip-background: rgba(59, 131, 246, 0.437);
  --version-chip-color: rgb(143, 174, 220);

  /* Selection and highlight colors */
  --selected-shape-stroke-color: rgba(59, 131, 246, 0.555);
  --selected-shape-fill-color: rgba(59, 130, 246, 0.1);   

  /* Issue status colors */
  --issue-open-color: rgb(34, 197, 94);
  --issue-closed-color: rgb(239, 68, 68);
  --issue-relation-stroke-color: rgba(209, 213, 219, 0.4);

  /* Highlight effects */
  --highlight-stroke-color: rgb(59, 130, 246);
  --highlight-fill-color: rgba(59, 130, 246, 0.2);

  /* Add the dotted grid background */
  background-image: radial-gradient(circle, var(--diagram-grid) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>