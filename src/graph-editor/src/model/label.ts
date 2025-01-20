import { Element } from "./element.js";

export interface Label extends Element {
    type: typeof Label.TYPE;
    text: string;
    withBackground: boolean;
}

export namespace Label {
    export const TYPE = "label";

    export function is(element: Element): element is Label {
        return element.type === TYPE;
    }
}
