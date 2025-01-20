import { MouseListener, SModelElementImpl, findParentByFeature } from "sprotty";
import { Action } from "sprotty-protocol";
import { HoverHighlightAction } from "./hoverHighlightAction.js";
import { SRoot } from "../../smodel/sRoot.js";
import { isIssueRelationHighlightable } from "./issueHighlightableFeature.js";

export class HighlightMouseListener extends MouseListener {
    lastHighlighted?: string;

    override mouseOver(target: SModelElementImpl, event: MouseEvent): Action[] {
        const highlightable = findParentByFeature(target, isIssueRelationHighlightable);
        const currentHighlighted = event.buttons != 0 ? undefined : highlightable?.id;
        if (this.lastHighlighted != currentHighlighted) {
            const root = target.root as SRoot;
            const action: HoverHighlightAction = {
                kind: HoverHighlightAction.KIND,
                affected: root.getRelatedHighlightable(currentHighlighted),
                unaffected: root.getRelatedHighlightable(this.lastHighlighted)
            };
            this.lastHighlighted = currentHighlighted;
            return [action];
        }
        return [];
    }
}
