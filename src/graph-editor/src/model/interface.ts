import { Element } from "./element.js";
import { IssueAffected } from "./issueAffected.js";

export interface Interface extends IssueAffected {
    type: typeof Interface.TYPE;
}

export namespace Interface {
    export const TYPE = "interface";

    export function is(element: Element): element is Interface {
        return element.type === TYPE;
    }
}
