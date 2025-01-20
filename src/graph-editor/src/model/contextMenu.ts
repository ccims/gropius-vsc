import { Element } from "./element.js";

export interface ContextMenu extends Element {
    type: typeof ContextMenu.TYPE;
    targetId: string;
}

export namespace ContextMenu {
    export const TYPE = "contextMenu";

    export function is(element: Element): element is ContextMenu {
        return element.type === TYPE;
    }
}
