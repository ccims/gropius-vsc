<template>
    <div id="graph-editor-id" class="graph-editor"></div>
  </template>
  
  <script lang="ts">
  import { defineComponent, onMounted } from "vue";
  import "reflect-metadata";  // Needed for the Sprotty model
  import {
    Graph,
    GraphLayout,
    GraphModelSource,
    createContainer,
    CreateRelationContext
  } from "@gropius/graph-editor";
  
  export default defineComponent({
    name: "GraphEditor",
  
    setup() {
      onMounted(() => {
        // Define the graph data (components and relations)
        const graph: Graph = {
          components: [
            {
              id: "component1",
              name: "Component A",
              style: { shape: "RECT", fill: { color: "lightblue" } },
              issueTypes: [],
              interfaces: [],
              contextMenu: {},
            },
            {
              id: "component2",
              name: "Component B",
              style: { shape: "RECT", fill: { color: "lightgreen" } },
              issueTypes: [],
              interfaces: [],
              contextMenu: {},
            },
          ],
          relations: [
            {
              id: "interface1",
              name: "Interface Link",
              start: "component1",
              end: "component2",
              style: { stroke: { color: "black" }, marker: "ARROW" },
              contextMenu: {},
            },
          ],
          issueRelations: [{ start: "component1", end: "component2", count: 3 }],
        };
  
        const layout: GraphLayout = {
          component1: { pos: { x: 100, y: 100 } },
          component2: { pos: { x: 400, y: 100 } },
          interface1: { points: [{ x: 200, y: 125 }, { x: 400, y: 125 }] },
        };
  
        // Create a custom ModelSource class
        class ModelSource extends GraphModelSource {
          protected handleCreateRelation(context: CreateRelationContext): void {
            console.log("Relation created:", context);
          }
  
          protected layoutUpdated(partialUpdate: GraphLayout, resultingLayout: GraphLayout): void {
            console.log("Layout updated:", resultingLayout);
          }
  
          protected handleSelectionChanged(selectedElements: any[]): void {
            console.log("Selection changed:", selectedElements);
          }
  
          protected navigateToElement(element: string): void {
            console.log("Navigate to element:", element);
          }
        }
  
        // Create the Sprotty container and bind the ModelSource
        const container = createContainer("graph-editor-id");
        container.bind(ModelSource).toSelf().inSingletonScope();
  
        const modelSource = container.get(ModelSource);
  
        // Update the graph and layout
        modelSource.updateGraph({ graph, layout, fitToBounds: true });
      });
  
      return {};
    },
  });
  </script>
  
  <style scoped>
  .graph-editor {
    width: 100%;
    height: 500px;
    border: 1px solid #ccc;
    background-color: #f0f0f0;
  }
  </style>
  