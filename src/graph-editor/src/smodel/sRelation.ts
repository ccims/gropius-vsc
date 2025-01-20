import { RelationStyle } from "../gropiusModel.js";
import { Relation } from "../model/relation.js";
import { SSelectable } from "./sSelectable.js";
import { Point } from "sprotty-protocol";
import { RelationPath } from "./relationPath.js";

export class SRelation extends SSelectable implements Relation {
    declare type: typeof Relation.TYPE;
    start!: string;
    end?: string | Point;
    points!: Point[];
    style!: RelationStyle;
    selected = false;
    path!: RelationPath | null;
    /**
     * This is to prevent sprotty from trying to move the canvas
     */
    position = null;

    constructor() {
        super();
        this.cachedProperty("path", () => RelationPath.fromRelation(this));
    }

    get contextMenuPos(): Point {
        const path = this.path;
        if (path == null) {
            return Point.ORIGIN;
        } else {
            return path.end;
        }
    }
}
