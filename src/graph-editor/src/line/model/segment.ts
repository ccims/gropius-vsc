import { Point } from "sprotty-protocol";

/**
 * Segment of a Line
 */
export interface Segment {
    /**
     * The type of line segment
     */
    type: string;
    /**
     * End position
     */
    end: Point;
}
