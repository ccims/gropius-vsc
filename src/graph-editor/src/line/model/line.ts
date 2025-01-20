import { Point } from "sprotty-protocol";
import { Segment } from "./segment.js";

/**
 * A line beginning at a start point, and consisting of a set of segments.
 * A line may be closed or not.
 * Note: mathematically, this is a path
 */
export interface Line {
    /**
     * The start position of the line
     */
    start: Point;
    /**
     * The segments of the line
     */
    segments: Segment[];
}

export namespace Line {
    export function isClosed(line: Line): boolean {
        return line.start.x === line.segments.at(-1)!.end.x && line.start.y === line.segments.at(-1)!.end.y;
    }
}
