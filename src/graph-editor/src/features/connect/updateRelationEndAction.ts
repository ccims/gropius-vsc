import { Action, Point } from "sprotty-protocol";

export interface UpdateRelationEndAction extends Action {
    kind: typeof UpdateRelationEndAction.KIND;
    relation: string;
    end: string | Point;
}

export namespace UpdateRelationEndAction {
    export const KIND = "updateRelationEnd";
}
