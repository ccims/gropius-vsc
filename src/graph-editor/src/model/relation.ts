import { Point } from "sprotty-protocol";
import { RelationStyle } from "../gropiusModel.js";
import { SegmentLayout } from "../line/model/segmentLayout.js";
import { Element } from "./element.js";
import { Selectable } from "./selectable.js";

export interface Relation extends Selectable {
    type: typeof Relation.TYPE;
    start: string;
    end?: string | Point;
    style: RelationStyle;
    points: Point[];
}

export namespace Relation {
    export const TYPE = "relation";

    export function is(element: Element): element is Relation {
        return element.type === TYPE;
    }
}
