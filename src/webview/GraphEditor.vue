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
import { onMounted, shallowRef, ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

const props = defineProps({
  projectId: { type: String, required: true },
  vscodeApi: { type: Object, required: true }
});

const editorId = ref(`graph-editor-${uuidv4()}`);
const modelSource = shallowRef<CustomModelSource>();
const projectData = ref<any>(null);
const showIssueRelations = ref(true);

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

function extractIssueTypes(relationPartner: any) {
  return relationPartner.aggregatedIssues?.nodes
    .map((issue: any) => ({
      id: issue.id,
      name: issue.type.name,
      iconPath: issue.type.iconPath,
      count: issue.count,
      isOpen: issue.isOpen
    }))
    .sort((a: any, b: any) => {
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      return a.name.localeCompare(b.name);
    }) ?? [];
}

function extractIssueRelations(relationPartner: any): any[] {
  if (!showIssueRelations.value) {
    return [];
  }
  
  const aggregatedRelations = new Map<string, { start: string; end: string; count: number }>();
  
  relationPartner?.aggregatedIssues?.nodes?.forEach((aggregatedIssue: any) => {
    // Each aggregated issue might have multiple outgoing relations
    aggregatedIssue.outgoingRelations?.nodes?.forEach((relation: any) => {
      // The relationPartner.id is the component or interface that owns the issue
      const startId = relationPartner.id;
      // The end.relationPartner.id is the target component or interface
      const endId = relation.end?.relationPartner?.id;
      
      if (!endId) {
        return;
      }
      
      // Create a unique key based on the start and end components/interfaces
      const key = `${startId}-${endId}`;
      
      if (aggregatedRelations.has(key)) {
        // If this relation already exists, update its count
        const existing = aggregatedRelations.get(key)!;
        existing.count += aggregatedIssue.count;
      } else {
        // Create a new relation
        aggregatedRelations.set(key, {
          start: startId,
          end: endId,
          count: aggregatedIssue.count
        });
      }
    });
  });

  return Array.from(aggregatedRelations.values());
}

function createGraphData(data: any = null): { graph: Graph; layout: GraphLayout } {
  // Log initial data received
  console.log('Starting createGraphData with data:', data);

  const project = data?.node;
  const graph: Graph = {
    components: [],
    relations: [],
    issueRelations: []
  };
  const layout: GraphLayout = {};

  // Early return if no components data
  if (!project?.components?.nodes) {
    console.log('No components found in project data, returning empty graph');
    return { graph, layout };
  }

  // Process components
  project.components.nodes.forEach((componentNode: any) => {
    console.log('\n--- Processing Component ---');
    console.log('Component ID:', componentNode.id);
    console.log('Component Name:', componentNode.component?.name);
    
    const template = componentNode.component?.template || {};
    
    // Process interfaces
    const interfaces = componentNode.interfaceDefinitions?.nodes
      .filter((def: any) => def.visibleInterface)
      .map((def: any) => {
        console.log('\n------ Processing Interface ------');
        console.log('Interface ID:', def.visibleInterface.id);
        const interfaceSpec = def.interfaceSpecificationVersion.interfaceSpecification;
        console.log('Interface Spec Name:', interfaceSpec.name);

        // Log interface issues before processing
        console.log('Interface Aggregated Issues:', def.visibleInterface.aggregatedIssues?.nodes);

        // Process interface issue relations
        const interfaceIssueRelations = extractIssueRelations(def.visibleInterface);
        console.log('Extracted Interface Issue Relations:', interfaceIssueRelations);
        graph.issueRelations.push(...interfaceIssueRelations);
        console.log('Current Issue Relations Count:', graph.issueRelations.length);

        return {
          id: def.visibleInterface.id,
          name: interfaceSpec.name,
          version: def.interfaceSpecificationVersion.version,
          style: {
            shape: interfaceSpec.template.shapeType || 'HEXAGON',
            fill: { color: interfaceSpec.template.fill?.color || 'transparent' },
            stroke: { color: interfaceSpec.template.stroke?.color || 'rgb(209, 213, 219)' }
          },
          issueTypes: extractIssueTypes(def.visibleInterface),
          contextMenu: {}
        };
      }) ?? [];

    // Log component issues before processing
    console.log('\n--- Processing Component Issues ---');
    console.log('Component Aggregated Issues:', componentNode.aggregatedIssues?.nodes);

    // Process component issue relations
    const componentIssueRelations = extractIssueRelations(componentNode);
    console.log('Extracted Component Issue Relations:', componentIssueRelations);
    graph.issueRelations.push(...componentIssueRelations);
    console.log('Updated Issue Relations Count:', graph.issueRelations.length);

    // Add component to graph
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
      issueTypes: extractIssueTypes(componentNode),
      contextMenu: {}
    });

    // Process relations
    console.log('\n--- Processing Component Relations ---');
    componentNode.outgoingRelations?.nodes?.forEach((relation: any) => {
      if (relation.end?.id) {
        console.log('Adding relation:', {
          from: componentNode.id,
          to: relation.end.id,
          type: relation.template?.name
        });
        
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
  });

  // Apply layouts
  console.log('\n--- Processing Layouts ---');
  project.relationPartnerLayouts?.nodes?.forEach((layoutNode: any) => {
    if (layoutNode.relationPartner?.id && layoutNode.pos) {
      layout[layoutNode.relationPartner.id] = {
        pos: layoutNode.pos
      };
    }
  });

  // Log final graph state
  console.log('\n=== Final Graph State ===');
  console.log('Components:', graph.components.length);
  console.log('Relations:', graph.relations.length);
  console.log('Issue Relations:', graph.issueRelations.length);
  console.log('Layout entries:', Object.keys(layout).length);

  return { graph, layout };
}

function handleMessage(event: MessageEvent) {
  const message = event.data;
  console.log('Received message:', message);
  
  if (message.type === 'projectData') {
    projectData.value = message.data;
    updateGraph(message.data);
  }
}

async function updateGraph(data: any = null) {
  if (!modelSource.value) {
    console.warn('ModelSource not initialized');
    return;
  }

  const { graph, layout } = createGraphData(data);
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
  
  const container = createContainer(editorId.value);
  container.bind(CustomModelSource).toSelf().inSingletonScope();
  container.bind(TYPES.ModelSource).toService(CustomModelSource);
  modelSource.value = container.get<CustomModelSource>(CustomModelSource);

  window.addEventListener('message', handleMessage);

  // Initialize with empty graph
  updateGraph();

  // Request project data
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
  background-color: rgb(5, 5, 7);
  --diagram-grid: rgba(255, 255, 255, 0.1);
  background-image: radial-gradient(circle, var(--diagram-grid) 1px, transparent 1px);
  background-size: 20px 20px;
  --background-overlay-color: rgba(255, 255, 255, 0.05);
  --shape-stroke-color: rgb(209, 213, 219);
  --version-chip-background: rgba(59, 131, 246, 0.437);
  --version-chip-color: rgb(143, 174, 220);
  --selected-shape-stroke-color: rgba(59, 131, 246, 0.555);
  --selected-shape-fill-color: rgba(59, 130, 246, 0.1);
  --issue-open-color: rgb(34, 197, 94);
  --issue-closed-color: rgb(239, 68, 68);
  --issue-relation-stroke-color: rgba(209, 213, 219, 0.4);
  --highlight-stroke-color: rgb(59, 130, 246);
  --highlight-fill-color: rgba(59, 130, 246, 0.2);
}
</style>