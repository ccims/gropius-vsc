import { Action } from "sprotty-protocol";

export interface HoverHighlightAction extends Action {
    kind: typeof HoverHighlightAction.KIND;
    affected: string[];
    unaffected: string[];
}

export namespace HoverHighlightAction {
    export const KIND = "hoverHighlight";
}
