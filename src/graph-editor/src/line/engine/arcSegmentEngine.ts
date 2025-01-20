import { Math2D } from "../math.js";
import { Point } from "sprotty-protocol";
import { ArcSegment } from "../model/arcSegment.js";
import { projectPointOnConic } from "./conicProjection.js";
import { NearestPointResult, SegmentEngine } from "./segmentEngine.js";

/**
 * Segment engine for ArcSegment
 */
export class ArcSegmentEngine extends SegmentEngine<ArcSegment> {
    override projectPoint(point: Point, segment: ArcSegment, segmentStartPoint: Point): NearestPointResult {
        const possiblePoints = [segmentStartPoint, segment.end];
        possiblePoints.push(
            ...projectPointOnConic(
                this.conicEquationOfEllipse(segment.radiusX, segment.radiusY, segment.center.x, segment.center.y),
                point
            )
        );
        return this.findBestPoint(possiblePoints, point, segment, segmentStartPoint, false)!;
    }

    override projectPointOrthogonal(point: Point, segment: ArcSegment, segmentStartPoint: Point): NearestPointResult {
        const possiblePoints: Point[] = [];
        const h = segment.center.x;
        const k = segment.center.y;
        const b = (point.y - k) ** 2 / segment.radiusY ** 2;
        if (b <= 1) {
            const deltaX = segment.radiusX * Math.sqrt(1 - b);
            possiblePoints.push({ x: h - deltaX, y: point.y });
            possiblePoints.push({ x: h + deltaX, y: point.y });
        }

        const a = (point.x - h) ** 2 / segment.radiusX ** 2;
        if (a <= 1) {
            const deltaY = segment.radiusY * Math.sqrt(1 - a);
            possiblePoints.push({ x: point.x, y: k - deltaY });
            possiblePoints.push({ x: point.x, y: k + deltaY });
        }
        return (
            this.findBestPoint(possiblePoints, point, segment, segmentStartPoint, true) ??
            this.projectPoint(point, segment, segmentStartPoint)
        );
    }

    private findBestPoint(
        possiblePoints: Point[],
        point: Point,
        segment: ArcSegment,
        segmentStartPoint: Point,
        priority: boolean
    ): NearestPointResult | undefined {
        if (possiblePoints.length == 0) {
            return undefined;
        }
        const { startAngle, deltaAngle } = this.getArcData(segmentStartPoint, segment);
        let minDist = Number.POSITIVE_INFINITY;
        let minPos = 0;
        let minPoint = possiblePoints[0];
        for (let i = 0; i < possiblePoints.length; i++) {
            const pos = possiblePoints[i];
            const dist = Math2D.distance(pos, point);
            if (dist < minDist) {
                if (i <= 1) {
                    minPos = i;
                } else {
                    const relativePos = Math2D.sub(pos, segment.center);
                    const angle = Math2D.angle({
                        x: relativePos.x / segment.radiusX,
                        y: relativePos.y / segment.radiusY
                    });
                    let deltaPosAngle = angle - startAngle;
                    if (deltaPosAngle < 0 && deltaAngle > 0) {
                        deltaPosAngle += 2 * Math.PI;
                    } else if (deltaAngle > 0 && deltaAngle < 0) {
                        deltaPosAngle -= 2 * Math.PI;
                    }
                    if (Math.abs(deltaPosAngle) < Math.abs(deltaAngle)) {
                        minPos = deltaPosAngle / deltaAngle;
                    } else {
                        continue;
                    }
                }
                minPoint = pos;
                minDist = dist;
            }
        }

        return {
            point: minPoint,
            distance: minDist,
            position: minPos,
            priority
        };
    }

    /**
     * Calculates the coefficients of the conic equation for an ellipse with the given semi-axes lengths and center coordinates.
     *
     * @param dx The semi-axis length in the x-direction.
     * @param dy The semi-axis length in the y-direction.
     * @param cx The x-coordinate of the center.
     * @param cy The y-coordinate of the center.
     * @returns A tuple with the coefficients A, B, C, D, E, and F of the conic equation, in that order.
     */
    private conicEquationOfEllipse(
        dx: number,
        dy: number,
        cx: number,
        cy: number
    ): [number, number, number, number, number, number] {
        const A = dy ** 2;
        const B = 0;
        const C = dx ** 2;
        const D = -cx * A;
        const E = -cy * C;
        const F = A * cx * cx + C * cy * cy - dx * dx * dy * dy;
        return [A, B, C, D, E, F];
    }

    override getPoint(position: number, distance: number, segment: ArcSegment, segmentStartPoint: Point): Point {
        const { startAngle, deltaAngle } = this.getArcData(segmentStartPoint, segment);
        const finalAngle = startAngle + position * deltaAngle;
        const center = segment.center;
        const normal = Math2D.scaleTo(this.getNormalVector(position, segment, segmentStartPoint), distance);
        const point = {
            x: center.x + segment.radiusX * Math.cos(finalAngle),
            y: center.y + segment.radiusY * Math.sin(finalAngle)
        };
        return Math2D.add(point, normal);
    }

    override getNormalVector(position: number, segment: ArcSegment, segmentStartPoint: Point): Point {
        const { startAngle, deltaAngle } = this.getArcData(segmentStartPoint, segment);
        const a = startAngle + position * deltaAngle;
        const dx = segment.radiusX;
        const dy = segment.radiusY;
        const nx = (dy * Math.cos(a)) / Math.sqrt((dy * Math.cos(a)) ** 2 + (dx * Math.sin(a)) ** 2);
        const ny = (dx * Math.sin(a)) / Math.sqrt((dy * Math.cos(a)) ** 2 + (dx * Math.sin(a)) ** 2);

        return { x: nx, y: ny };
    }

    /**
     * Generates additional data for an arc
     *
     * @param segmentStartPoint the start point of the arc
     * @param segment the arc
     * @returns the additional data
     */
    private getArcData(segmentStartPoint: Point, segment: ArcSegment): ArcData {
        const relativeStart = Math2D.sub(segmentStartPoint, segment.center);
        const relativeEnd = Math2D.sub(segment.end, segment.center);
        const startAngle = Math2D.angle(relativeStart);
        const endAngle = Math2D.angle(relativeEnd);
        let deltaAngle: number;
        if (segment.clockwise) {
            deltaAngle = endAngle - startAngle;
            if (deltaAngle < 0) {
                deltaAngle += 2 * Math.PI;
            }
        } else {
            deltaAngle = startAngle - endAngle;
            if (deltaAngle > 0) {
                deltaAngle -= 2 * Math.PI;
            }
        }
        return {
            startAngle,
            endAngle,
            deltaAngle
        };
    }

    override toPathString(segment: ArcSegment): string {
        return `A ${segment.radiusX} ${segment.radiusY} 0 0 ${segment.clockwise ? "1" : "0"} ${segment.end.x} ${
            segment.end.y
        }`;
    }
}

/**
 * Some additional data about an arc
 */
interface ArcData {
    /**
     * The angle of the start pos
     */
    startAngle: number;
    /**
     * The angle of the end pos
     */
    endAngle: number;
    /**
     * The delta of the two angles in the correct direction
     */
    deltaAngle: number;
}
