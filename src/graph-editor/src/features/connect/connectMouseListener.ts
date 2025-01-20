import { injectable } from "inversify";
import { IActionHandler, ICommand, MouseListener, SModelElementImpl, findParentByFeature, isViewport } from "sprotty";
import { Action, Point } from "sprotty-protocol";
import { ConnectAction } from "./connectAction.js";
import { CancelConnectAction } from "./cancelConnectAction.js";
import { isConnectable } from "./connectFeature.js";
import { CreateRelationAction } from "./createRelationAction.js";
import { UpdateRelationEndAction } from "./updateRelationEndAction.js";

@injectable()
export class ConnectMouseListener extends MouseListener implements IActionHandler {
    private connectAction: ConnectAction | undefined;

    private lastMouseMoveEvent?: MouseEvent;
    private lastMouseMoveTarget?: SModelElementImpl;
    private hoveredConnectable?: string;

    handle(action: Action): void | Action | ICommand {
        if (ConnectAction.is(action)) {
            this.connectAction = action;
            if (this.lastMouseMoveEvent != undefined) {
                const updateAction: UpdateRelationEndAction = {
                    kind: UpdateRelationEndAction.KIND,
                    relation: action.relation,
                    end: this.getLastPoint()
                };
                return updateAction;
            }
        }
    }

    override mouseUp(target: SModelElementImpl, event: MouseEvent): Action[] {
        return this.commitConnection(target);
    }

    override mouseOver(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (this.connectAction == undefined) {
            return [];
        }
        if (event.buttons === 0) {
            return this.commitConnection(target);
        }
        const connectable = findParentByFeature(target, isConnectable);
        if (connectable != undefined) {
            this.hoveredConnectable = connectable.id;
        } else {
            this.hoveredConnectable = undefined;
        }
        return this.updateRelation();
    }

    override mouseMove(target: SModelElementImpl, event: MouseEvent): Action[] {
        this.lastMouseMoveEvent = event;
        this.lastMouseMoveTarget = target;
        return this.updateRelation();
    }

    private updateRelation(): Action[] {
        if (this.connectAction == undefined) {
            return [];
        }
        let end: Point | string;
        if (this.hoveredConnectable != undefined) {
            end = this.hoveredConnectable;
        } else {
            end = this.getLastPoint();
        }
        const updateAction: UpdateRelationEndAction = {
            kind: UpdateRelationEndAction.KIND,
            relation: this.connectAction.relation,
            end
        };
        return [updateAction];
    }

    private commitConnection(target: SModelElementImpl): Action[] {
        if (this.connectAction == undefined) {
            return [];
        }
        const connectable = findParentByFeature(target, isConnectable);
        if (connectable == undefined) {
            return this.cancel();
        }
        const targetId = connectable?.id;
        if (targetId == this.connectAction.start) {
            return this.cancel();
        }
        const connectAction: CreateRelationAction = {
            kind: CreateRelationAction.KIND,
            relation: this.connectAction.relation,
            start: this.connectAction.start,
            end: targetId
        };
        this.connectAction = undefined;
        this.hoveredConnectable = undefined;
        return [connectAction];
    }

    private cancel(): Action[] {
        if (this.connectAction == undefined) {
            return [];
        }
        const cancelAction: CancelConnectAction = {
            kind: CancelConnectAction.KIND,
            relation: this.connectAction.relation
        };
        this.connectAction = undefined;
        this.hoveredConnectable = undefined;
        return [cancelAction];
    }

    private getLastPoint(): Point {
        let x = this.lastMouseMoveEvent!.pageX;
        let y = this.lastMouseMoveEvent!.pageY;
        const canvasBounds = this.lastMouseMoveTarget!.root.canvasBounds;
        x -= canvasBounds.x;
        y -= canvasBounds.y;
        const viewport = findParentByFeature(this.lastMouseMoveTarget!, isViewport);
        const zoom = viewport?.zoom ?? 1;
        if (viewport != undefined) {
            x = x / zoom + viewport.scroll.x;
            y = y / zoom + viewport.scroll.y;
        }
        return {
            x,
            y
        };
    }
}
