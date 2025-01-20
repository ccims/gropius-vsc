import { IssueRelationHighlightable } from "../features/issueRelationHighlight/IssueRelationHighlightable.js";
import { IssueRelation } from "../model/issueRelation.js";
import { SElement } from "./sElement.js";

export class SIssueRelation extends SElement implements IssueRelation, IssueRelationHighlightable {
    declare type: typeof IssueRelation.TYPE;
    start!: string;
    end!: string;
    startIndex!: number;
    endIndex!: number;
    startType!: string;
    endType!: string;
    count!: number;
    highlighted = false;
}
