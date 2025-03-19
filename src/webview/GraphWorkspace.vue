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
    if (!relationPartner?.aggregatedIssues?.nodes) {
      return [];
    }
    
    return relationPartner.aggregatedIssues.nodes
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
      });
  }
  
  function extractIssueRelations(relationPartner: any, projectId: string): any[] {
    if (!showIssueRelations.value || !relationPartner?.aggregatedIssues?.nodes) {
      console.log('Skipping issue relations for', relationPartner?.id, 'showIssueRelations:', showIssueRelations.value);
      return [];
    }
    
    console.log('Processing issue relations for:', relationPartner.id);
    console.log('Aggregated issues:', relationPartner.aggregatedIssues.nodes);
    
    const aggregatedRelations = new Map<string, { start: string; end: string; count: number }>();
    
    relationPartner.aggregatedIssues.nodes.forEach((aggregatedIssue: any) => {
      console.log('Processing aggregated issue:', aggregatedIssue.id);
      const outgoingRelations = aggregatedIssue.outgoingRelations?.nodes || [];
      
      outgoingRelations.forEach((relation: any) => {
        if (!relation.end?.relationPartner?.id) {
          console.log('Skipping relation - missing end partner ID');
          return;
        }
        
        const startId = relationPartner.id;
        const endId = relation.end.relationPartner.id;
        const key = `${startId}-${endId}`;
        
        if (aggregatedRelations.has(key)) {
          aggregatedRelations.get(key)!.count += aggregatedIssue.count;
        } else {
          aggregatedRelations.set(key, {
            start: startId,
            end: endId,
            count: aggregatedIssue.count
          });
        }
      });
    });
  
    const result = Array.from(aggregatedRelations.values());
    console.log('Extracted issue relations:', JSON.stringify(result, null, 2));
    return result;
  }
  
  function createGraphData(data: any = null): { graph: Graph; layout: GraphLayout } {
    console.log('==================== START GRAPH DATA ====================');
    console.log('Project ID:', data?.id);
    console.log('Number of components:', data?.node?.components?.nodes?.length || 0);
    if (data?.node?.components?.nodes) {
      data.node.components.nodes.forEach((comp: any, index: number) => {
        console.log(`\nComponent ${index + 1}:`);
        console.log('ID:', comp.id);
        console.log('Name:', comp.component?.name);
        console.log('Aggregated Issues:', comp.aggregatedIssues?.nodes?.length || 0);
        if (comp.aggregatedIssues?.nodes) {
          comp.aggregatedIssues.nodes.forEach((issue: any, i: number) => {
            console.log(`  Issue ${i + 1}:`, {
              id: issue.id,
              type: issue.type?.name,
              count: issue.count,
              outgoingRelations: issue.outgoingRelations?.nodes?.length || 0
            });
          });
        }
      });
    }
    console.log('==================== END GRAPH DATA ====================\n');
    const project = data?.node;
    const graph: Graph = {
      components: [],
      relations: [],
      issueRelations: []
    };
    const layout: GraphLayout = {};
    
    console.log('Starting to process project:', project?.id);
  
    if (!project?.components?.nodes) {
      return { graph, layout };
    }
  
    const projectId = data.id;
  
    project.components.nodes.forEach((componentNode: any) => {
      console.log('Processing component:', componentNode.id);
      // Process interfaces
      const interfaces = componentNode.interfaceDefinitions?.nodes
        .filter((def: any) => def.visibleInterface)
        .map((def: any) => {
          console.log('Processing interface:', def.visibleInterface.id);
          const interfaceSpec = def.interfaceSpecificationVersion.interfaceSpecification;
          const interfaceIssueRelations = extractIssueRelations(def.visibleInterface, projectId);
          console.log('Interface issue relations:', interfaceIssueRelations.length);
          graph.issueRelations.push(...interfaceIssueRelations);
  
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
        }) || [];
  
      // Process component issue relations
      const componentIssueRelations = extractIssueRelations(componentNode, projectId);
      console.log('Component issue relations:', componentIssueRelations.length);
      graph.issueRelations.push(...componentIssueRelations);
  
      // Add component
      graph.components.push({
        id: componentNode.id,
        name: componentNode.component?.name || 'Unnamed',
        version: String(componentNode.version || '1.0'),
        style: {
          shape: componentNode.component?.template?.shapeType || 'RECT',
          fill: { color: componentNode.component?.template?.fill?.color || 'transparent' },
          stroke: { color: componentNode.component?.template?.stroke?.color || 'rgb(209, 213, 219)' }
        },
        interfaces,
        issueTypes: extractIssueTypes(componentNode),
        contextMenu: {}
      });
  
      // Process relations specific to this project
      const outgoingRelations = componentNode.outgoingRelations?.nodes || [];
      outgoingRelations.forEach((relation: any) => {
        if (relation.end?.id) {
          graph.relations.push({
            id: relation.id,
            name: relation.template?.name || 'Relation',
            start: componentNode.id,
            end: relation.end.id,
            style: {
              stroke: relation.template?.stroke || {},
              marker: relation.template?.markerType || 'ARROW'
            },
            contextMenu: {}
          });
        }
      });
    });
  
    // Apply layouts
    project.relationPartnerLayouts?.nodes?.forEach((layoutNode: any) => {
      if (layoutNode.relationPartner?.id && layoutNode.pos) {
        layout[layoutNode.relationPartner.id] = {
          pos: layoutNode.pos
        };
      }
    });
  
    console.log('Final graph structure:', {
      componentCount: graph.components.length,
      relationCount: graph.relations.length,
      issueRelationCount: graph.issueRelations.length
    });
    console.log('Issue relations in final graph:', JSON.stringify(graph.issueRelations, null, 2));
    
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
  
    console.log('Updating graph with:', {
      components: graph.components.length,
      relations: graph.relations.length,
      issueRelations: graph.issueRelations.length
    });
  
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