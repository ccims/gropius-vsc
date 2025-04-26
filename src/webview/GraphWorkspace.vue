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
  LayoutEngine,
  StrokeStyle
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

  if (!componentversion.aggregatedIssues.nodes.length) {
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

/**
 * Extract the IssueRelations
 * start: issueID
 * end: issueID
 * count: count
 * @param componentVersion 
 */

function extractIssueRelations(componentVersion: any): any[] {
  if (!componentVersion?.aggregatedIssues?.nodes) {
    return [];
  }  
  const aggregatedRelations = new Map<string, { start: string; end: string; count: number }>();
  componentVersion.aggregatedIssues.nodes.forEach((aggregatedIssue: any) => {
    const outgoingRelations = aggregatedIssue.outgoingRelations?.nodes || [];
    outgoingRelations.forEach((relation: any) => {
      if (!relation.end?.relationPartner?.id) {
        return;
      }
      const startId = relation.start.id;
      const endId = relation.end.id;
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
  return result;
}

/**
 * Extracts the relations between components
 * @param componentVersion 
 */
function extractRelations(componentVersion: any): any[] {
  if (!componentVersion?.incomingRelations?.nodes) {
    return [];
  }
  const relations = new Map<string, { id: string; name: string; start: string; end: string; style: {}; contextMenu: {} }>();
  componentVersion.incomingRelations.nodes.forEach((relation: any) => {
      if (!relation.end?.id) {
        return;
      }
    let stroke: StrokeStyle["stroke"] = undefined;
    if (relation.template.stroke != undefined) {
        stroke = {
            color: relation.template.stroke.color ?? undefined,
            dash: relation.template.stroke.dash ?? undefined
        };
    }
    const id = relation.id;
    const name = relation.name;
    const startId = relation.start.id;
    const endId = relation.end.id;
    const style = {stroke: stroke, marker: relation.template.markerType};
    const key = `${startId}-${endId}`;
    relations.set(key, {
      id: id,
      name: name,
      start: startId,
      end: endId,
      style: style,
      contextMenu: {}
        });
  });
  const result = Array.from(relations.values());
  return result;
}

function extractInterfaces(componentVersion: any): any []{
  if(!componentVersion?.interfaceDefinitions?.nodes){
    return [];
  }
  const interfaceResult = new Map<string, { id: string; name: string; version: string; style: {}; issueTypes: any []; contextMenu: {} }>();
  componentVersion.interfaceDefinitions?.nodes.forEach((interfaceInstance: any) => {
    if(!interfaceInstance.visibleInterface.id) {
      return [];
    }
    const id = interfaceInstance.visibleInterface.id;
    const name = interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.name;
    const version = interfaceInstance.interfaceSpecificationVersion.version;
    const style = {fill: {color: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.fill?.color || 'transparent'}, stroke: {color: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.stroke.color || 'rgb(209, 213, 219)', dash: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.stroke.dash ?? undefined}, radius: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.shapeRadius, shape: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.shapeType};
    const issueTypes = extractIssueTypes(interfaceInstance.visibleInterface);
    const contextMenu = {
      type: "interface"
    };
    interfaceResult.set(id, {
      id: id,
      name: name,
      version: version,
      style: style,
      issueTypes: issueTypes,
      contextMenu: contextMenu,
    });
  });
  const result = Array.from(interfaceResult.values())
  return result ?? [];
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
    return { graph, layout };
  }

  workspace.nodes.forEach((component: any) => {
    if (component.versions?.nodes?.length > 1) {
      component.versions?.nodes.forEach((version: any) => {
        graph.issueRelations.push(...extractIssueRelations(version));
        graph.relations.push(...extractRelations(version));
        const compInterfaces = extractInterfaces(version);
        graph.components.push({
          id: version.id,
          name: component.name,
          version: version.version,
          style: {
            shape: component?.template?.shapeType || 'RECT',
            fill: { color: component?.template?.fill?.color || 'transparent' },
            stroke: { color: component?.template?.stroke?.color || 'rgb(209, 213, 219)' }
          },
          interfaces: compInterfaces,
          issueTypes: extractIssueTypes(version) || [],
          contextMenu: {}
        });
      });
    } else {
      component.versions?.nodes.forEach((version: any) => {
        graph.issueRelations.push(...extractIssueRelations(version));
        graph.relations.push(...extractRelations(version));
        const compInterfaces = extractInterfaces(version);
        graph.components.push({
          id: version.id,
          name: component.name,
          version: version.version,
          style: {
            shape: component?.template?.shapeType || 'RECT',
            fill: { color: component?.template?.fill?.color || 'transparent' },
            stroke: { color: component?.template?.stroke?.color || 'rgb(209, 213, 219)' }
          },
          interfaces: compInterfaces,
          issueTypes: extractIssueTypes(version) || [],
          contextMenu: {}
        });
      });
    }
});
// Filter the relations
if (workspace.nodes.length > 0){
  graph.relations = filterRelations(graph.relations, getComponentVersion(workspace.nodes));
}
  return { graph, layout };
}

/**
 * Helper function to extract componentversions ids for relations.
 * @param data 
 */
function getComponentVersion(data: any): string[] {
  const result: string[] = [];
  data.forEach((component: any) => {
    component.versions.nodes.forEach((version: any) => {
      result.push(version.id);
    });
  });
  console.log(result);
  return result;
}



/**
 * 
 * @param relations graph relations
 * @param values Component values
 */
function filterRelations(relations: any, values: any) : any[] {
    const versions = new Set<string>();
    const result: any[] = [];
    values.forEach((component: any) => {
      versions.add(component);
    });
    relations.forEach((relation: any) => {
        if(versions.has(relation.start) && versions.has(relation.end)) {
            result.push(relation);
        }
    });
    return result;
}

function handleMessage(event: MessageEvent) {
  const message = event.data;
  
  if (message.type === "workspaceData") {
    workspaceData.value = message.data;
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

  modelSource.value.updateGraph({
    graph,
    layout: finalLayout,
    fitToBounds: true
  });
}

onMounted(() => {
  
  const container = createContainer(editorId.value);
  container.bind(CustomModelSource).toSelf().inSingletonScope();
  container.bind(TYPES.ModelSource).toService(CustomModelSource);
  modelSource.value = container.get<CustomModelSource>(CustomModelSource);

  window.addEventListener('message', handleMessage);

  // Initialize with empty graph
  updateGraph();

  // Request project data
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