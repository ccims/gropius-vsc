import { name } from "sprotty";
import { Element } from "./element.js";

export interface IssueType extends Element {
    type: typeof IssueType.TYPE;
    iconPath: string;
    isOpen: boolean;
}

export namespace IssueType {
    export const TYPE = "issueType";

    export function is(element: Element): element is IssueType {
        return element.type === TYPE;
    }
}
