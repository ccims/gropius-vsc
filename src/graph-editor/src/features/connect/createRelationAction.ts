import { Action } from "sprotty-protocol";

export interface CreateRelationAction extends Action {
    kind: typeof CreateRelationAction.KIND;
    relation: string;
    start: string;
    end: string;
}

export namespace CreateRelationAction {
    export const KIND = "createRelation";
}
