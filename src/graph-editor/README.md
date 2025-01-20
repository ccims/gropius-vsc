# @gropius/graph-editor

The `@gropius/graph-editor` is a powerful and customizable graph editor built on top of the [Sprotty](https://github.com/eclipse/sprotty) framework.
It enables users to view and modify Gropius architecture graphs composed of `ComponentVersions`, `Interfaces`, and `Relations`.
Further, the editor displays information about issues on `ComponentVersions` and `Interfaces`, and semantic relations between them.

This package is framework-agnostic and can be integrated into various environments.

## Key Features

- **Graph visualization**: View and interact with a graph of `ComponentVersions`, `Interfaces`, and `Relations`. In addition to the architecture, the graph shows issues and their issue relations.
- **Automatic layouting**: This package provides an API to automatically layout the graph.
- **Highly customizable**: The editor provides hooks for various lifecycle events like selection changes, layout updates, and relation creation.

## Installation

To install the `@gropius/graph-editor` package, use npm:

```bash
npm install @gropius/graph-editor
```

## Basic Usage

Below is an outline of how to use the `@gropius/graph-editor` library to render and manage a graph.

### Setup

```ts
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

// Define your architecture graph and layout
const graph: Graph = {
    // Define the graph structure (components, interfaces, relations, issue relations)
};

const layout: GraphLayout = {
    // Define the layout of the graph (positions, sizes, etc.)
};

// Custom model source for event handling
class ModelSource extends GraphModelSource {
    
    protected handleCreateRelation(context: CreateRelationContext): void {
        console.log("Relation created:", context);
        // Add custom logic for handling new relations
    }

    protected layoutUpdated(partialUpdate: GraphLayout, resultingLayout: GraphLayout): void {
        console.log("Layout updated:", resultingLayout);
        // Add custom logic for layout changes
    }

    protected handleSelectionChanged(selectedElements: SelectedElement<any>[]): void {
        console.log("Selection changed:", selectedElements);
        // Add custom logic for handling selected elements
    }

    protected navigateToElement(element: string): void {
        console.log("Navigate to element:", element);
        // Add custom logic for navigating to elements
    }
}

// Create an instance of the editor
const container = createContainer("your-editor-id");
container.bind(ModelSource).toSelf().inSingletonScope();
container.bind(TYPES.ModelSource).toService(ModelSource);
const modelSource = container.get(ModelSource);

// Update the graph and layout
modelSource.updateGraph({ graph, layout, fitToBounds: true });
```

## Styles
The graph editor uses multiple CSS variables to provide configurable styling.
Following is a list of the available CSS variables (which should be applied to `.sprotty svg`):
- `--diagram-grid`: the color of the grid lines
- `--background-overlay-color`: the color of the background overlay
- `--shape-stroke-color`: the color of the shapes' (components and interfaces) border
- `--version-chip-background`: the background color of the version chips
- `--version-chip-color`: the text color of the version chips
- `--selected-shape-stroke-color`: the border color of a selected shape
- `--selected-shape-fill-color`: the fill color of a selected shape
- `--issue-closed-color`: the color representing a closed issue
- `--issue-open-color`: the color representing an open issue
- `--issue-relation-stroke-color`: the color of the stroke for issue relation lines
- `--highlight-stroke-color`: the border color used for highlighting elements
- `--highlight-fill-color`: the fill color used for highlighted elements



## License

This project is licensed under the terms of the Eclipse Public License 2.0. See the [LICENSE](./LICENSE) file for details.

---

For more details and advanced usage, refer to the [Sprotty documentation](https://sprotty.org/docs/getting-started/).