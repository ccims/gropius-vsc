import { Element } from "./element.js";

export interface IssueRelation extends Element {
    type: typeof IssueRelation.TYPE;
    start: string;
    end: string;
    startIndex: number;
    endIndex: number;
    startType: string;
    endType: string;
    count: number;
}

export namespace IssueRelation {
    export const TYPE = "issueRelation";

    export function is(element: Element): element is IssueRelation {
        return element.type === TYPE;
    }
}
