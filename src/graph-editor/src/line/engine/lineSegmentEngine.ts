import { Math2D } from "../math.js";
import { Point } from "sprotty-protocol";
import { LineSegment } from "../model/lineSegment.js";
import { NearestPointResult, SegmentEngine } from "./segmentEngine.js";

/**
 * Segment engine for LineSegment
 */
export class LineSegmentEngine extends SegmentEngine<LineSegment> {
    override projectPoint(point: Point, segment: LineSegment, segmentStartPoint: Point): NearestPointResult {
        const x1 = segmentStartPoint;
        const x2 = segment.end;

        const dx = x2.x - x1.x;
        const dy = x2.y - x1.y;
        const d2 = dx * dx + dy * dy;
        const t = ((point.x - x1.x) * dx + (point.y - x1.y) * dy) / d2;

        let closest: Point;
        let position: number;
        if (t < 0) {
            closest = x1;
            position = 0;
        } else if (t > 1) {
            closest = x2;
            position = 1;
        } else {
            closest = {
                x: x1.x + t * dx,
                y: x1.y + t * dy
            };
            position = t;
        }
        return {
            position,
            distance: Math2D.distance(closest, point),
            point: closest,
            priority: false
        };
    }

    override projectPointOrthogonal(point: Point, segment: LineSegment, segmentStartPoint: Point): NearestPointResult {
        let verticalMatch: NearestPointResult | undefined = undefined;
        if (Math2D.isInRange(point.x, segmentStartPoint.x, segment.end.x)) {
            const position = (point.x - segmentStartPoint.x) / (segment.end.x - segmentStartPoint.x);
            const projection = {
                x: point.x,
                y: segmentStartPoint.y + position * (segment.end.y - segmentStartPoint.y)
            };
            verticalMatch = {
                position: (point.x - segmentStartPoint.x) / (segment.end.x - segmentStartPoint.x),
                distance: Math2D.distance(point, projection),
                point: projection,
                priority: true
            };
        }
        let horizontalMatch: NearestPointResult | undefined = undefined;
        if (Math2D.isInRange(point.y, segmentStartPoint.y, segment.end.y)) {
            const position = (point.y - segmentStartPoint.y) / (segment.end.y - segmentStartPoint.y);
            const projection = {
                x: segmentStartPoint.x + position * (segment.end.x - segmentStartPoint.x),
                y: point.y
            };
            horizontalMatch = {
                position: (point.y - segmentStartPoint.y) / (segment.end.y - segmentStartPoint.y),
                distance: Math2D.distance(point, projection),
                point: projection,
                priority: true
            };
        }
        if (verticalMatch != undefined) {
            if (horizontalMatch != undefined) {
                if (verticalMatch.distance < horizontalMatch.distance) {
                    return verticalMatch;
                } else {
                    return horizontalMatch;
                }
            } else {
                return verticalMatch;
            }
        } else {
            if (horizontalMatch != undefined) {
                return horizontalMatch;
            } else {
                return this.projectPoint(point, segment, segmentStartPoint);
            }
        }
    }

    override getPoint(position: number, distance: number, segment: LineSegment, segmentStartPoint: Point): Point {
        let linePoint = Math2D.linearInterpolate(segmentStartPoint, segment.end, position);
        if (distance != 0) {
            const normalVector = this.getNormalVector(position, segment, segmentStartPoint);
            linePoint = Math2D.add(linePoint, Math2D.scale(normalVector, distance));
        }
        return linePoint;
    }

    override getNormalVector(_position: number, segment: LineSegment, segmentStartPoint: Point): Point {
        const delta = Math2D.sub(segment.end, segmentStartPoint);
        return Math2D.normalize({ x: delta.y, y: -delta.x });
    }

    override toPathString(segment: LineSegment): string {
        return `L ${segment.end.x} ${segment.end.y}`;
    }
}
