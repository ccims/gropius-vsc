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
import { json } from "stream/consumers";

const props = defineProps({
    vscodeApi: { type: Object, required: true }
});

const editorId = ref(`workspace-graph-editor-${uuidv4()}`);
const modelSource = shallowRef<CustomModelSource>();
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
 * @param componentversion
 */
function extractIssueTypes(componentversion: any) {
    console.log("START extractIssueTypes!!!");

    if (!componentversion.aggregatedIssues) {
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

/**
 * Extract the IssueRelations
 * start: issueID
 * end: issueID
 * count: count
 * @param componentVersion 
 */

function extractIssueRelations(componentVersion: any): any[] {
    console.log("START extractIssueRelations");
    if (!componentVersion?.aggregatedIssues?.nodes) {
        console.log('Skipping issue relations for', componentVersion?.id);
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
    console.log("START extractRelations!");
    if (!componentVersion?.incomingRelations?.nodes) {
        console.log('No relation on componentversion: ' + componentVersion?.id);
        return [];
    }
    const relations = new Map<string, { id: string; name: string; start: string; end: string; style: {}; contextMenu: {} }>();
    componentVersion.incomingRelations?.nodes.forEach((relation: any) => {
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
        const style = { stroke: stroke, marker: relation.template.markerType };
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

function extractInterfaces(componentVersion: any): any[] {
    console.log("Start extractInterfaces");
    if (!componentVersion?.interfaceDefinitions?.nodes) {
        console.log("No Interfaces for componentversion: " + componentVersion.id);
        console.log("BREAK 1");
        return [];
    }
    const interfaceResult = new Map<string, { id: string; name: string; version: string; style: {}; issueTypes: any[]; contextMenu: {} }>();
    componentVersion.interfaceDefinitions?.nodes.forEach((interfaceInstance: any) => {
        if (!interfaceInstance.visibleInterface.id) {
            console.log("BREAK 4");
            return [];
        }
        console.log("BREAK 2");
        const id = interfaceInstance.visibleInterface.id;
        const name = interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.name;
        const version = interfaceInstance.interfaceSpecificationVersion.version;
        const style = { fill: { color: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.fill?.color || 'transparent' }, stroke: { color: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.stroke.color || 'rgb(209, 213, 219)', dash: interfaceInstance.interfaceSpecificationVersion.interfaceSpecification.template.stroke.dash ?? undefined } };
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
    console.log("BREAK 3");
    const result = Array.from(interfaceResult.values())
    return result ?? [];
}

function extractComponent4NextIssues(nextIssue: any, issueTypeOfSelectedIssue: any): any {
    return {
                id: nextIssue.id,
                name: nextIssue.component.name,
                version: nextIssue.version,
                style: {
                    shape: nextIssue.component.template.shapeType || 'RECT',
                    fill: { color: nextIssue.component.template?.fill?.color || 'transparent'},
                    stroke: { color: nextIssue.component.template?.stroke?.color || 'rgb(209, 213, 219)'}
                    },
                    interfaces: [],
                    issueTypes: issueTypeOfSelectedIssue,
                    contextMenu: {}
                    }

}

function extractNextComponent(nextComponent: any, issueRelation: any): any {
    return  {
            id: nextComponent.id,
            name: nextComponent.component.name,
            version: nextComponent.version,
            style: {
                shape: nextComponent.component.template.shapeType || 'RECT',
                fill: { color: nextComponent.component.template?.fill?.color || 'transparent'},
                stroke: { color: nextComponent.component.template?.stroke?.color || 'rgb(209, 213, 219)'}
            },
            interfaces: [],
            issueTypes: extractIssueTypes(issueRelation),
            contextMenu: {}
        }
}

function extractIssueType4Initial(query: any, aggregatedByID: any) : any {

    return [{ 
        id: aggregatedByID,
        name: query.type.name,
        iconPath: query.type.iconPath,
        count: 1,
        isOpen: query.state.isOpen,
    }];

}

/**
 * Create the graph data.
 * @param data : Workspace data to create the necessary graph data.
 * @returns graph and layout
 */
function createGraphData(data: any = null, workspace: any = null): { graph: Graph; layout: GraphLayout } {
    console.log("111111111111111111111111111111111111111");
    console.log(JSON.stringify(data));
    console.log("333333333333333333333333333333333333333333");
    const query = data?.node;
    const graph: Graph = {
        components: [],
        relations: [],
        issueRelations: []
    };
    const layout: GraphLayout = {};

    if (!query) {
        console.log("Something went wrong with issue data in GraphIssue.vue");
        return { graph, layout };
    }
    /*
    let issueTypeOfSelectedIssue: { id: any; name: any; iconPath: any; count: any; isOpen: any; }[] = [];
    issueTypeOfSelectedIssue.push({ 
        id: query.id,
        name: query.type.name,
        iconPath: query.type.iconPath,
        count: 1,
        isOpen: query.state.isOpen,
    });

    */

    interface IssueRelation {
        start: string;
        end: string;
        count: number;
    }
    let temp_saved_componentVersions = new Map <string, { id: any; name: any; version: any; style: any; interfaces: any, issueTypes: any, contextMenu: any}>();
    let compRelationSize = new Map <string, any>();
    let issueRelationsArray = new Map <string, IssueRelation>();
    // selected issue
    if (query.aggregatedBy.nodes.length == 1) {
        console.log("Exact one component version for this issue!!!");
        const nextIssue = query.aggregatedBy.nodes[0].relationPartner;
        temp_saved_componentVersions.set( nextIssue.component.name, extractComponent4NextIssues(nextIssue, extractIssueType4Initial(query, query.aggregatedBy.nodes[0].id)));

    } else if (query.aggregatedBy.nodes.length > 1) {
        console.log("More than one component version for this issue!!!");
        query.aggregatedBy.nodes.forEach((componentVersion: any) => {
            const nextIssue = componentVersion.relationPartner;
            if (temp_saved_componentVersions.has(nextIssue.component.name)){
                if(isInWorkspace(nextIssue.id, workspace)){
                    // componentversion of the new element is in workspace
                    if(isInWorkspace(temp_saved_componentVersions.get(nextIssue.component.name)?.id, workspace)) {
                        // componentversion of the existing element is in workspace
                        if(nextIssue.incomingRelations?.nodes?.length > compRelationSize.get(nextIssue.component.name)) {
                            compRelationSize.set(nextIssue.component.name, nextIssue.incomingRelations?.nodes.length);
                            temp_saved_componentVersions.set(nextIssue.component.name, extractComponent4NextIssues(nextIssue, extractIssueType4Initial(query, componentVersion.id)));
                        }
                        // ELSE: no change
                    } else {
                        compRelationSize.set(nextIssue.component.name, nextIssue.incomingRelations?.nodes.length);
                        temp_saved_componentVersions.set(nextIssue.component.name, extractComponent4NextIssues(nextIssue, extractIssueType4Initial(query, componentVersion.id)));
                    }
                } else {
                    if(!isInWorkspace(temp_saved_componentVersions.get(nextIssue.component.name)?.id, workspace)) {
                        if(nextIssue.incomingRelations?.nodes?.length > compRelationSize.get(nextIssue.component.name)) {
                            compRelationSize.set(nextIssue.component.name, nextIssue.incomingRelations?.nodes.length);
                            temp_saved_componentVersions.set(nextIssue.component.name, extractComponent4NextIssues(nextIssue, extractIssueType4Initial(query, componentVersion.id)));
                        }
                        // ELSE: no change
                    }
                    // ELSE: no change
                }
            } else {
                compRelationSize.set(nextIssue.component.name, nextIssue.incomingRelations?.nodes.length);
                temp_saved_componentVersions.set(nextIssue.component.name, extractComponent4NextIssues(nextIssue, extractIssueType4Initial(query, componentVersion.id)));
            }

        });

    }
    /*
        query.affects.nodes.forEach((componentversion: any) => {
                    //graph.issueRelations.push(...extractIssueRelations(component.version));
                    //graph.relations.push(...extractRelations(component.version));
                    //const compInterfaces = extractInterfaces(version);
                    //console.log("Interface: " + JSON.stringify(compInterfaces));

                    
                    graph.components.push({
                        id: componentversion.id,
                        name: componentversion.component.name,
                        version: componentversion.version,
                        style: {
                            shape: componentversion?.template?.shapeType || 'RECT',
                            fill: { color: componentversion?.template?.fill?.color || 'transparent' },
                            stroke: { color: componentversion?.template?.stroke?.color || 'rgb(209, 213, 219)' }
                        },
                        interfaces: [], //compInterfaces,
                        issueTypes: extractIssueTypes(componentversion) || [],
                        contextMenu: {}
                    });
        });
        */

    // Incoming issue relations
    query.incomingRelations?.nodes.forEach((issueRelation: any) => {
      const startId = query.id;
      const endId = issueRelation.issue.id;
      const key = `${startId}-${endId}`;
      if (startId != endId) {
        if(issueRelationsArray.has(key)) {
            issueRelationsArray.get(key)!.count ++;
        } else {
            issueRelationsArray.set(key, { start: startId, end: endId, count: 1});
        }
      }
   if (issueRelation.issue.aggregatedBy.nodes.length == 1) {
    console.log("Exact one component version for this issue!!!");
    const nextComponent = issueRelation.issue.aggregatedBy.nodes[0].relationPartner;
    if (!temp_saved_componentVersions.has(nextComponent.component.name)) {
        temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
    }
   } else if (issueRelation.issue.aggregatedBy.nodes.length > 1) {
    console.log("More than one component version for this issue!!!");
    issueRelation.issue.aggregatedBy.nodes.forEach((componentVersion: any) => {
        const nextComponent = componentVersion.relationPartner;
            if (temp_saved_componentVersions.has(nextComponent.component.name)){
                if(isInWorkspace(nextComponent.id, workspace)){
                    // componentversion of the new element is in workspace
                    if(isInWorkspace(temp_saved_componentVersions.get(nextComponent.component.name)?.id, workspace)) {
                        // componentversion of the existing element is in workspace
                        if(nextComponent.incomingRelations?.nodes?.length > compRelationSize.get(nextComponent.component.name)) {
                            compRelationSize.set(nextComponent.component.name, nextComponent.incomingRelations?.nodes.length);
                            temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
                        }
                        // ELSE: no change
                    } else {
                        compRelationSize.set(nextComponent.component.name, nextComponent.incomingRelations?.nodes.length);
                        temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
                    }
                } else {
                    if(!isInWorkspace(temp_saved_componentVersions.get(nextComponent.component.name)?.id, workspace)) {
                        if(nextComponent.incomingRelations?.nodes?.length > compRelationSize.get(nextComponent.component.name)) {
                            compRelationSize.set(nextComponent.component.name, nextComponent.incomingRelations?.nodes.length);
                            temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
                        }
                        // ELSE: no change
                    }
                    // ELSE: no change
                }
            } else {
                compRelationSize.set(nextComponent.component.name, nextComponent.incomingRelations?.nodes.length);
                temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
            }
        });
    }
    });
    
    // Outgoing issue relations
    query.outgoingRelations.nodes.forEach((issueRelation: any) => {
      const startId = query.id;
      const endId = issueRelation.relatedIssue.id;
      const key = `${startId}-${endId}`;
      if (startId != endId) {
        if(issueRelationsArray.has(key)) {
            issueRelationsArray.get(key)!.count ++;
        } else {
            issueRelationsArray.set(key, { start: startId, end: endId, count: 1});
        }
        }
        if (issueRelation.relatedIssue.aggregatedBy.nodes.length == 1) {
            console.log("Just one relationpartner!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("Exact one component version for this issue!!!");
            const nextComponent = issueRelation.relatedIssue.aggregatedBy.nodes[0].relationPartner;
            if (!temp_saved_componentVersions.has(nextComponent.component.name)) {
                temp_saved_componentVersions.set(nextComponent.component.name, extractNextComponent(nextComponent, issueRelation));
            }

        } else if (issueRelation.relatedIssue.aggregatedBy.nodes.length > 1) {
            console.log("MOre than one relationpartner?????????????????????????");
            console.log("More than one component version for this issue!!!");
            issueRelation.relatedIssue.aggregatedBy.nodes.forEach((componentVersion: any) => {
                const partnerComponent = componentVersion.relationPartner;
                if (temp_saved_componentVersions.has(partnerComponent.component.name)){
                    if(isInWorkspace(partnerComponent.id, workspace)){
                        // componentversion of the new element is in workspace
                        if(isInWorkspace(temp_saved_componentVersions.get(partnerComponent.component.name)?.id, workspace)) {
                            // componentversion of the existing element is in workspace
                            if(partnerComponent.incomingRelations.nodes?.length > compRelationSize.get(partnerComponent.component.name)) {
                                compRelationSize.set(partnerComponent.component.name, partnerComponent.incomingRelations?.nodes.length);
                                temp_saved_componentVersions.set(partnerComponent.component.name, extractNextComponent(partnerComponent, issueRelation));
                            }
                            // ELSE: no change
                        } else {
                            compRelationSize.set(partnerComponent.component.name, partnerComponent.incomingRelations?.nodes.length);
                            temp_saved_componentVersions.set(partnerComponent.component.name, extractNextComponent(partnerComponent, issueRelation));
                        }
                    } else {
                        if(!isInWorkspace(temp_saved_componentVersions.get(partnerComponent.component.name)?.id, workspace)) {
                            if(partnerComponent.incomingRelations.nodes?.length > compRelationSize.get(partnerComponent.component.name)) {
                                compRelationSize.set(partnerComponent.component.name, partnerComponent.incomingRelations?.nodes.length);
                                temp_saved_componentVersions.set(partnerComponent.component.name, extractNextComponent(partnerComponent, issueRelation));
                            }
                            // ELSE: no change
                        }
                        // ELSE: no change
                    }
                } else {
                    compRelationSize.set(partnerComponent.component.name, partnerComponent.incomingRelations?.nodes.length);
                    temp_saved_componentVersions.set(partnerComponent.component.name, extractNextComponent(partnerComponent, issueRelation));
                }


            });

        }
    });

    //graph.issueRelations.push(...Array.from(issueRelationsArray.values()));

    console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    console.log(temp_saved_componentVersions);
    console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY");

    temp_saved_componentVersions.forEach((component) => {
        graph.relations.push();
        graph.components.push(component);
    });
    console.log("__________________________________________");
    console.log("Komponenten: ");
    graph.components.forEach((component) => {
        console.log("ID: " + component.id);
        console.log("Name: " + component.name);
        console.log("Version: " + component.version);
        //console.log("Style: " + component.style);
        console.log("Interface: " + component.interfaces);
        console.log("ISSUES: ");
        component.issueTypes.forEach((issue) => {
            console.log("IssueID: " + issue.id);
            console.log("Issuename: " + issue.name);
            console.log("issue count: " + issue.count);
            //console.log("issue iconpath :" + issue.iconPath);
            console.log("isOpen: " + issue.isOpen);
        });
        //console.log("contextmenu: " + component.contextMenu);
    });
    console.log("ISSUE RELATIONS: ");
    graph.issueRelations.forEach((relation) => {
        console.log("IssueRelation START: " + relation.start);
        console.log("IssueRelation END: " + relation.end);
        console.log("IssueRelation COUNT: " + relation.count);
    });
    console.log("__________________________________________");

    console.log(JSON.stringify(graph));

    return { graph, layout };
}

function isInWorkspace(component: any, workspace:  [{
              id: any;
              componentVersionIds: any;
              name: any;
              description:  any;
              versions: any;
              expanded: any;
            }]) {
    workspace.forEach((element) => {
        if( element.componentVersionIds == component){
            return true;
        }        
    });

    return false;
}

function handleMessage(event: MessageEvent) {
    const message = event.data;
    console.log('Received message:', message);

    if (message.type === "issueData") {
        issueData.value = message.data;
        updateGraph(message.data, message.workspace);
    }
}

async function updateGraph(data: any = null, workspace: any = null) {
    console.log("Start updateGraph issue.");
    if (!modelSource.value) {
        console.warn('ModelSource not initialized');
        return;
    }

    const { graph, layout } = createGraphData(data, workspace);
    const finalLayout = Object.keys(layout).length === 0 ?
        await autolayout(graph) : layout;

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