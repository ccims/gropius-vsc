<template>
  <div class="graph-container">
    <div :id="editorId" class="sprotty-container" />
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
  vscodeApi: { type: Object, required: true }
});

const editorId = ref(`workspace-graph-editor-${uuidv4()}`);
const modelSource = shallowRef<CustomModelSource>();
const workspaceData = ref<any>(null);
const issueData = ref<any>(null);
const showIssueRelations = ref(true);

console.log("Start GraphWorkspace.vue.");

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

/**
 * Returns the issuesTypes for the given component
 * @param component 
 */
 function extractIssueTypes(componentversion: any) {
  console.log("START extractIssueTypes!!!");

  if (!componentversion.aggregatedIssues.nodes.length) {
    console.log("Nothing about ISSUES");
    return [];
  }

  const extractedIssues: { id: any; name: any; iconPath: any; count: any; isOpen: any; }[] = [];

  // Extracts issues
  componentversion.aggregatedIssues.nodes.forEach((issue: any) => {
      extractedIssues.push({
          id: issue.id,
          name: issue.type.name,
          iconPath: issue.type.iconPath,
          count: issue.count,
          isOpen: issue.isOpen,
        });
    });
    
  // Sorts: First the open issues than others
  return extractedIssues.sort((a, b) => {
    if (a.isOpen && !b.isOpen) return -1;
    if (!a.isOpen && b.isOpen) return 1;
    return a.name.localeCompare(b.name);
  });
}


function extractIssueRelations(componentVersion: any): any[] {
  console.log("START extractIssueRelations");
  
  if (!componentVersion?.aggregatedIssues?.nodes) {
    console.log('Skipping issue relations for', componentVersion?.id);
    console.log("END extractIssueRelations 1");
    return [];
  }
  
  console.log('Processing issue relations for:', componentVersion.id);
  console.log('Aggregated issues:', componentVersion.aggregatedIssues.nodes);
  
  const aggregatedRelations = new Map<string, { start: string; end: string; count: number }>();
  
  componentVersion.aggregatedIssues.nodes.forEach((aggregatedIssue: any) => {
    console.log('Processing aggregated issue:', aggregatedIssue.id);
    const outgoingRelations = aggregatedIssue.outgoingRelations?.nodes || [];
    
    outgoingRelations.forEach((relation: any) => {
      if (!relation.end?.relationPartner?.id) {
        console.log('Skipping relation - missing end partner ID');
        console.log("END extractIssueRelations 2");
        return;
      }
      
      const startId = componentVersion.id;
      const endId = relation.end.relationPartner.id;
      const key = `${startId}-${endId}`;
      if (startId != endId) {
      if (aggregatedRelations.has(key)) {
        aggregatedRelations.get(key)!.count += aggregatedIssue.count;
      } else {
        aggregatedRelations.set(key, {
          start: startId,
          end: endId,
          count: aggregatedIssue.count
        });
      }
    }
    });
  });

  const result = Array.from(aggregatedRelations.values());
  console.log('Extracted issue relations:', JSON.stringify(result, null, 2));
  console.log("END extractIssueRelations 3");
  return result;
}

/**
 * Create the graph data.
 * @param data : Workspace data to create the necessary graph data.
 * @returns graph and layout
 */
function createGraphData(data: any = null): { graph: Graph; layout: GraphLayout } {
  const workspace = data?.components;
  const graph: Graph = {
    components: [],
    relations: [],
    issueRelations: []
  };
  const layout: GraphLayout = {};

  if (!workspace?.nodes) {
    console.log("Something went wrong with workspace data in GraphWorkspace.vue");
    return { graph, layout };
  }

  workspace.nodes.forEach((component: any) => {
    if (component.versions?.nodes?.length > 1) {
      component.versions?.nodes.forEach((version: any) => {
        graph.issueRelations.push(...extractIssueRelations(version));
        graph.components.push({
          id: version.id,
          name: component.name,
          version: version.version,
          style: {
            shape: component?.template?.shapeType || 'RECT',
            fill: { color: component?.template?.fill?.color || 'transparent' },
            stroke: { color: component?.template?.stroke?.color || 'rgb(209, 213, 219)' }
          },
          interfaces: [],
          issueTypes: extractIssueTypes(version) || [],
          contextMenu: {}
        });
      });
    } else {
      component.versions?.nodes.forEach((version: any) => {
        graph.issueRelations.push(...extractIssueRelations(version));
        graph.components.push({
          id: version.id,
          name: component.name,
          version: version.version,
          style: {
            shape: component?.template?.shapeType || 'RECT',
            fill: { color: component?.template?.fill?.color || 'transparent' },
            stroke: { color: component?.template?.stroke?.color || 'rgb(209, 213, 219)' }
          },
          interfaces: [],
          issueTypes: extractIssueTypes(version) || [],
          contextMenu: {}
        });
      });
    }
});

graph.issueRelations.forEach((relation) => {
  console.log("IssueRelation START: " + relation.start);
  console.log("IssueRelation END: " + relation.end);
  console.log("IssueRelation COUNT: " + relation.count);
});

//graph.issueRelations.push(...[{start: "d2bb5c86-aa45-41cb-802a-37f1ce487ddb", end: "a3a3693b-3995-43dd-ae80-6136b27ebc39", count:1}, {start: "a3a3693b-3995-43dd-ae80-6136b27ebc39", end: "87c7a566-2ccd-4f1e-be77-d947ed417ea3", count:1}]);
//graph.issueRelations.push(...[{start: "ca54dc74-5cad-438a-8606-3c11d4363b4f", end: "ca54dc74-5cad-438a-8606-3c11d4363b4f", count:1}, {start: "ca54dc74-5cad-438a-8606-3c11d4363b4f", end: "ca54dc74-5cad-438a-8606-3c11d4363b4f", count:1}]);


  /*
  
graph.components.forEach(component => {
  console.log("ID:", component.id);
  console.log("Name:", component.name);
  console.log("Version:", component.version);
  console.log("-----------------");
});
  */

  //console.log('Issue relations in final graph:', JSON.stringify(graph.issueRelations, null, 2));
  return { graph, layout };
}

function handleMessage(event: MessageEvent) {
  const message = event.data;
  console.log('Received message:', message);
  
  if (message.type === "workspaceData") {
    workspaceData.value = message.data;
    updateGraph(message.data);
    //TODO: update graph with workspace data
  } else if (message.type === "issueData") {
    issueData.value = message.data;
    // TODO: update graph with issue data
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
  
  /*
  graph.components.forEach(element => {
    console.log("Name: " + element.name);
    console.log("ID: " + element.id);
    console.log("Version: " + element.version);
    console.log("Issues: " + element.issueTypes)
    console.log("TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT");
  });

  graph.components = [{
    id: "85b5b28e-b25d-4ce7-81b7-39d30aa96f97",
    name: "multi versions component",
    version: '1.0',
    contextMenu: {},
    interfaces: [],
    style: {
        shape: 'RECT',
        fill: { color: 'transparent' },
        stroke: { color: 'rgb(209, 213, 219)' }
      },
    issueTypes: []
  }, {
        id: '85b5b28e-b25d-4ce7-81b7-39d30aa96f97', 
        name: 'multi versions component', 
        version: '2.0', 
        contextMenu: {},
        interfaces: [],
    style: {
        shape: 'RECT',
        fill: { color: 'transparent' },
        stroke: { color: 'rgb(209, 213, 219)' }
      },
        issueTypes: []
      }];
  */

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
    type: 'ready'
  });
});
</script>

<style scoped>
.graph-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.sprotty-container {
  flex: 1;
  min-height: 0;
}

:deep(.sprotty) {
  height: 100%;
  width: 100%;
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
  --version-chip-background: rgb(0, 34, 90);
  --version-chip-color: rgb(143, 174, 220);
  --selected-shape-stroke-color: rgba(59, 131, 246, 0.555);
  --selected-shape-fill-color: rgba(59, 130, 246, 0.1);
  --issue-open-color: rgb(34, 197, 94);
  --issue-closed-color: rgb(239, 68, 68);
  --issue-relation-stroke-color: rgb(209, 213, 219);
  --highlight-stroke-color: rgb(59, 130, 246);
  --highlight-fill-color: rgba(59, 130, 246, 0.2);
}
</style>