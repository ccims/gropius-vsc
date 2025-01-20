import { Selectable } from "sprotty-protocol";
import { IssueRelationHighlightable } from "../features/issueRelationHighlight/IssueRelationHighlightable.js";
import { IssueType } from "../model/issueType.js";
import { SElement } from "./sElement.js";

export class SIssueType extends SElement implements IssueType, IssueRelationHighlightable, Selectable {
    declare type: typeof IssueType.TYPE;
    iconPath!: string;
    isOpen!: boolean;
    highlighted = false;
    selected = false;
}
