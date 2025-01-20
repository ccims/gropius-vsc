import { Point } from "sprotty-protocol";
import { Segment } from "../model/segment.js";

/**
 * Base class for all segment engines.
 * Provides functions to get the nearest point on the line, and a point at a specific position.
 * The position of a point on a line is defined by a number between 0 and 1.
 */
export abstract class SegmentEngine<T extends Segment> {
    /**
     * Finds the nearest point on the provided segment to point.
     *
     * @param point the point to which the nearest point should be found
     * @param segment the segment on which the point must be
     * @param segmentStartPoint the start position of the segment
     * @returns a definition of the nearest point and its distance
     */
    abstract projectPoint(point: Point, segment: T, segmentStartPoint: Point): NearestPointResult;

    /**
     * Projects a point orthogonally on a segment, meaning using either only a horizontal or vertical line to the segment.
     * If such a projection is not possible, a regular projection is used.
     *
     * @param point the point to project
     * @param segment the segment on which the point must be
     * @param segmentStartPoint the start position of the segment
     * @returns a definition of the projected point and its distance
     */
    abstract projectPointOrthogonal(point: Point, segment: T, segmentStartPoint: Point): NearestPointResult;

    /**
     * Gets a point on a segment
     *
     * @param position the position of the point on the segment, a number between 0 and 1
     * @param distance the distance of the point to the
     * @param segment the segment on which the point should be
     * @param segmentStartPoint the start position of the segment
     * @returns the point on the segment
     */
    abstract getPoint(position: number, distance: number, segment: T, segmentStartPoint: Point): Point;

    /**
     * Generates the normal vector for at a specific position
     *
     * @param position the position of the point on the segment, a number between 0 and 1
     * @param distance the distance of the point to the
     * @param segment the segment on which the point should be
     * @param segmentStartPoint the start position of the segment
     * @returns the normal vector
     */
    abstract getNormalVector(position: number, segment: T, segmentStartPoint: Point): Point;

    /**
     * Converts the segment to a path string
     *
     * @param segment the segment to convert
     * @returns the path string
     */
    abstract toPathString(segment: T): string;
}

/**
 * Result of getNearestPoint
 */
export interface NearestPointResult {
    /**
     * The segment specific value between 0 and 1 which defines where on the segment the point is
     */
    position: number;
    /**
     * The distance to the provided point
     */
    distance: number;
    /**
     * The actual point on the line
     */
    point: Point;
    /**
     * If this result has priority
     */
    priority: boolean;
}
