import { Element } from "./element.js";

export interface Chip extends Element {
    type: typeof Chip.TYPE;
    text: string;
}

export namespace Chip {
    export const TYPE = "chip";

    export function is(element: Element): element is Chip {
        return element.type === TYPE;
    }
}
