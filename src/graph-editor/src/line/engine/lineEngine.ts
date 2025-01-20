import { Point } from "sprotty-protocol";
import { ArcSegment } from "../model/arcSegment.js";
import { Line } from "../model/line.js";
import { LineSegment } from "../model/lineSegment.js";
import { Segment } from "../model/segment.js";
import { ArcSegmentEngine } from "./arcSegmentEngine.js";
import { LineSegmentEngine } from "./lineSegmentEngine.js";
import { NearestPointResult, SegmentEngine } from "./segmentEngine.js";
import { Math2D } from "../math.js";
import { SegmentLayout } from "../model/segmentLayout.js";
import { ceilToPrecision, floorToPrecision, roundToPrecision } from "../../base/roundToPrecision.js";

/**
 * Helper to get closest points to a line, and calculate the position of a point on the line
 */
export class LineEngine {
    /**
     * Default instance, can be shared as the engine is stateless
     */
    static DEFAULT = new LineEngine();

    private static readonly EPSILON = 0.00001;

    /**
     * Map of all known engines
     */
    private engines = new Map<string, SegmentEngine<any>>([
        [LineSegment.TYPE, new LineSegmentEngine()],
        [ArcSegment.TYPE, new ArcSegmentEngine()]
    ]);

    /**
     * Finds the nearest point on the provided line to point.
     *
     * @param point the point to project
     * @param line line with associated transform
     * @returns the position of the closest point on the line
     */
    private projectPointOrthogonal(point: Point, line: Line): ProjectionResult {
        return this.projectPointInternal(point, line, (engine, localPoint, segment, startPosition) =>
            engine.projectPointOrthogonal(localPoint, segment, startPosition)
        );
    }

    projectPointOrthogonalWithPrecision(point: Point, line: Line, layout: SegmentLayout): ProjectionResult {
        const roundedPoint = {
            x: roundToPrecision(point.x),
            y: roundToPrecision(point.y)
        };
        const result = this.projectPointOrthogonal(roundedPoint, line);
        if (result.priority) {
            return result;
        }
        let altProjectionPoint1: Point;
        let altProjectionPoint2: Point;
        if (layout == SegmentLayout.VERTICAL_HORIZONTAL) {
            altProjectionPoint1 = { x: floorToPrecision(result.point.x), y: roundedPoint.y };
            altProjectionPoint2 = { x: ceilToPrecision(result.point.x), y: roundedPoint.y };
        } else {
            altProjectionPoint1 = { x: roundedPoint.x, y: floorToPrecision(result.point.y) };
            altProjectionPoint2 = { x: roundedPoint.x, y: ceilToPrecision(result.point.y) };
        }
        let altResult: ProjectionResult;
        const altResult1 = this.projectPointOrthogonal(altProjectionPoint1, line);
        if (altResult1.priority) {
            altResult = altResult1;
        } else {
            const altResult2 = this.projectPointOrthogonal(altProjectionPoint2, line);
            if (altResult2.priority) {
                altResult = altResult2;
            } else {
                throw new Error("Failed to project point with precision");
            }
        }
        return altResult;
    }

    /**
     * Finds the nearest point on the provided line to point.
     *
     * @param point the point to which the nearest point should be found
     * @param line the line
     * @returns the position of the closest point on the line
     */
    projectPoint(point: Point, line: Line): ProjectionResult {
        return this.projectPointInternal(point, line, (engine, localPoint, segment, startPosition) =>
            engine.projectPoint(localPoint, segment, startPosition)
        );
    }

    projectPointInternal(
        point: Point,
        line: Line,
        segmentLayoutCallback: <T extends Segment>(
            engine: SegmentEngine<T>,
            localPoint: Point,
            segment: T,
            startPosition: Point
        ) => NearestPointResult
    ): ProjectionResult {
        if (line.segments.length == 0) {
            throw new Error("Line must have at least one segment");
        }
        const localPoint = point;
        const lengthPerSegment = 1 / line.segments.length;
        let minDistance = Number.POSITIVE_INFINITY;
        let relativePosition = 0;
        let segmentIndex = 0;
        let startPosition = line.start;
        let projectedPoint: Point;
        let hasPriority = false;
        for (let i = 0; i < line.segments.length; i++) {
            const segment = line.segments[i];
            const engine = this.getEngine(segment);
            const candidate = segmentLayoutCallback(engine, localPoint, segment, startPosition);
            if (
                (candidate.distance < minDistance && hasPriority == candidate.priority) ||
                (candidate.priority && !hasPriority)
            ) {
                minDistance = candidate.distance;
                relativePosition = candidate.position;
                segmentIndex = i;
                projectedPoint = candidate.point;
                hasPriority = candidate.priority;
            }
            startPosition = segment.end;
        }
        return {
            pos: lengthPerSegment * (segmentIndex + relativePosition),
            relativePos: relativePosition,
            segment: segmentIndex,
            point: projectedPoint!,
            priority: hasPriority
        };
    }

    getPoint(position: number, distance: number, line: Line): Point {
        if (line.segments.length == 0) {
            return line.start;
        }
        const segmentIndex = this.calcSegmentIndex(position, line.segments.length);
        const relativePosition = position * line.segments.length - segmentIndex;

        const segmentStartPos = segmentIndex == 0 ? line.start : line.segments[segmentIndex - 1].end;
        const lineSegment = line.segments[segmentIndex];
        const engine = this.getEngine(lineSegment);
        const localPoint = engine.getPoint(relativePosition, distance, lineSegment, segmentStartPos);
        return localPoint;
    }

    getNormal(position: number, line: Line): Point {
        const segmentIndex = this.calcSegmentIndex(position, line.segments.length);
        const relativePosition = position * line.segments.length - segmentIndex;
        if (relativePosition < LineEngine.EPSILON && (segmentIndex > 0 || Line.isClosed(line))) {
            const prevNormal = this.getNormalInternal(segmentIndex - 1, 1, line);
            const currentNormal = this.getNormalInternal(segmentIndex, relativePosition, line);
            return Math2D.add(prevNormal, currentNormal);
        } else if (
            relativePosition > 1 - LineEngine.EPSILON &&
            (segmentIndex < line.segments.length - 1 || Line.isClosed(line))
        ) {
            const nextNormal = this.getNormalInternal(segmentIndex + 1, 0, line);
            const currentNormal = this.getNormalInternal(segmentIndex, relativePosition, line);
            return Math2D.add(nextNormal, currentNormal);
        } else {
            return this.getNormalInternal(segmentIndex, relativePosition, line);
        }
    }

    private getNormalInternal(segmentIndex: number, relativePosition: number, line: Line) {
        const normalizedSegmentIndex = (segmentIndex + line.segments.length) % line.segments.length;
        const lineSegment = line.segments[normalizedSegmentIndex];
        const engine = this.getEngine(lineSegment);
        const segmentStartPos =
            normalizedSegmentIndex == 0 ? line.start : line.segments[normalizedSegmentIndex - 1].end;
        return engine.getNormalVector(relativePosition, lineSegment, segmentStartPos);
    }

    toPathString(line: Line): string {
        const startPosition = line.start;
        let path = `M ${startPosition.x} ${startPosition.y}`;
        for (const segment of line.segments) {
            const engine = this.getEngine(segment);
            path += engine.toPathString(segment);
        }
        path += "Z";
        return path;
    }

    private getEngine<T extends Segment>(segment: T): SegmentEngine<T> {
        const engine = this.engines.get(segment.type);
        if (engine) {
            return engine;
        } else {
            throw new Error(`Unknown segment type: ${segment.type}`);
        }
    }

    private calcSegmentIndex(position: number, segmentCount: number): number {
        return Math.min(Math.max(Math.floor(position * segmentCount), 0), segmentCount - 1);
    }
}

/**
 * Result of a point projection
 */
export interface ProjectionResult {
    /**
     * Position on the line which is closest to the provided point
     */
    pos: number;
    /**
     * The relative position on the segment
     */
    relativePos: number;
    /**
     * The segment index
     */
    segment: number;
    /**
     * The projected point
     */
    point: Point;
    /**
     * If the projection result is a priority result
     */
    priority: boolean;
}
