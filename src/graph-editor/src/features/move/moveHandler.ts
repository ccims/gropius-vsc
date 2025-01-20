import { Action, Point } from "sprotty-protocol";
import { RelationLayout } from "../../gropiusModel.js";
import { SegmentLayout } from "../../line/model/segmentLayout.js";
import { roundToPrecision } from "../../base/roundToPrecision.js";
import { LineEngine } from "../../line/engine/lineEngine.js";
import { Line } from "../../line/model/line.js";
import { RelationPath, RelationPathSegment } from "../../smodel/relationPath.js";

export type BaseSegment =
    | {
          x: number;
          y?: undefined;
      }
    | {
          y: number;
          x?: undefined;
      };

/**
 * Handler which can handle element moves
 */
export abstract class MoveHandler {
    /**
     * Creates the action handling the move
     *
     * @param dx the absolute x offset
     * @param dy the absolute y offset
     * @param commited if true, this is the final action of the transaction
     * @param event the mouse event which triggered the move
     * @returns the generated action
     */
    abstract generateAction(dx: number, dy: number, commited: boolean, event: MouseEvent): Action;

    protected projectPointOnElement(
        point: Point,
        oldSegment: RelationPathSegment | undefined,
        start: boolean,
        layout: SegmentLayout,
        elementLine: Line
    ): [BaseSegment[], Point] {
        const roundedPoint = { x: roundToPrecision(point.x), y: roundToPrecision(point.y) };
        const projection = LineEngine.DEFAULT.projectPointOrthogonalWithPrecision(roundedPoint, elementLine, layout);
        let projectedPoint = projection.point;
        const result: BaseSegment[] = [];
        if (projectedPoint.x == roundedPoint.x) {
            if (start) {
                result.push({ y: roundedPoint.y });
            } else {
                result.push({ y: projectedPoint.y });
            }
        } else if (projectedPoint.y == roundedPoint.y) {
            if (start) {
                result.push({ x: roundedPoint.x });
            } else {
                result.push({ x: projectedPoint.x });
            }
        } else {
            if (oldSegment != undefined) {
                const oldStart = start ? oldSegment.start : RelationPath.segmentEnd(oldSegment);
                const oldEnd = start ? RelationPath.segmentEnd(oldSegment) : oldSegment.start;
                const horizontal = oldSegment.x != undefined;
                const newEnd = start ? roundedPoint : roundedPoint;
                const oldVector = horizontal ? oldStart.x - oldEnd.x : oldStart.y - oldEnd.y;
                const newVector = horizontal ? oldStart.x - newEnd.x : oldStart.y - newEnd.y;
                if (Math.sign(oldVector) == Math.sign(newVector)) {
                    projectedPoint = oldStart;
                }
            }
            if (start) {
                if (layout == SegmentLayout.HORIZONTAL_VERTICAL) {
                    result.push({ x: roundedPoint.x }, { y: roundedPoint.y });
                } else {
                    result.push({ y: roundedPoint.y }, { x: roundedPoint.x });
                }
            } else {
                if (layout == SegmentLayout.VERTICAL_HORIZONTAL) {
                    result.push({ x: projectedPoint.x }, { y: projectedPoint.y });
                } else {
                    result.push({ y: projectedPoint.y }, { x: projectedPoint.x });
                }
            }
        }
        return [result, projectedPoint];
    }

    protected layoutFromPath(start: Point, path: BaseSegment[]): RelationLayout {
        const simplified = RelationPath.simplifyPath(start, path);
        if (simplified.length > 1) {
            const points: Point[] = [];
            let current = { x: start.x, y: start.y };
            for (let i = 0; i < simplified.length - 1; i++) {
                const segment = simplified[i];
                if (segment.x != undefined) {
                    current = { x: segment.x, y: current.y };
                } else {
                    current = { x: current.x, y: segment.y };
                }
                points.push(current);
            }
            return { points };
        } else {
            const res = {
                points: [
                    {
                        x: (start.x + (simplified[0].x ?? start.x)) / 2,
                        y: (start.y + (simplified[0].y ?? start.y)) / 2
                    }
                ]
            };
            return res;
        }
    }
}
