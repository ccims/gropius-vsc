import { Element } from "./element.js";
import { IssueAffected } from "./issueAffected.js";

export interface Component extends IssueAffected {
    type: typeof Component.TYPE;
}

export namespace Component {
    export const TYPE = "component";

    export function is(element: Element): element is Component {
        return element.type === TYPE;
    }
}
