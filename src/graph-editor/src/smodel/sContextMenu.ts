import { SElement } from "./sElement.js";
import { ContextMenu } from "../model/contextMenu.js";
import { Point } from "sprotty-protocol";
import { SSelectable } from "./sSelectable.js";

export class SContextMenu extends SElement implements ContextMenu {
    declare type: typeof ContextMenu.TYPE;
    targetId!: string;
    pos!: Point;

    constructor() {
        super();
        this.cachedProperty("pos", () => {
            const target = this.root.index.getById(this.targetId) as SSelectable;
            return target.contextMenuPos;
        });
    }
}
