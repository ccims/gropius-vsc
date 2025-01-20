import { Bounds, Point } from "sprotty-protocol";
import { ShapeStyle, Shape as GropiusShape, StrokeStyle } from "../../gropiusModel.js";
import { Shape } from "../shape.js";
import { ShapeEngine } from "./shapeEngine.js";
import { Line } from "../../line/model/line.js";
import { LineSegment } from "../../line/model/lineSegment.js";
import { Math2D } from "../../line/math.js";
import { Segment } from "../../line/model/segment.js";
import { ArcSegment } from "../../line/model/arcSegment.js";

export abstract class PolygonEngine extends ShapeEngine {
    generateShape(points: Point[], style: ShapeStyle): Shape {
        const radius = style.radius ?? 0;
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const xCoordinates = points.map((p) => p.x);
        const yCoordinates = points.map((p) => p.y);
        const maxX = Math.max(...xCoordinates);
        const maxY = Math.max(...yCoordinates);
        const minX = Math.min(...xCoordinates);
        const minY = Math.min(...yCoordinates);
        let line: Line;
        if (radius > 0) {
            line = this.generateRoundedPolygon(points, radius);
        } else {
            line = this.generatePolygon(points);
        }
        const bounds: Bounds = {
            x: minX - strokeWidth / 2,
            y: minY - strokeWidth / 2,
            width: maxX - minX + strokeWidth,
            height: maxY - minY + strokeWidth
        };
        return {
            bounds,
            shape: style.shape,
            outline: line
        };
    }

    private generatePolygon(points: Point[]): Line {
        return {
            start: points.at(-1)!,
            segments: points.map((p) => ({
                type: LineSegment.TYPE,
                end: p
            }))
        };
    }

    private generateRoundedPolygon(points: Point[], radius: number): Line {
        const segmentPoints = [points.at(-1)!, ...points, points.at(0)!];
        const roundedCorners: RoundedCorner[] = [];
        for (let i = 0; i < points.length; i++) {
            const last = segmentPoints[i];
            const current = segmentPoints[i + 1];
            const next = segmentPoints[i + 2];
            const toLast = Math2D.sub(last, current);
            const toNext = Math2D.sub(next, current);
            const lenToLast = Math2D.length(toLast);
            const lenToNext = Math2D.length(toNext);
            const modifiedRadius = Math.min(radius, lenToLast / 2, lenToNext / 2);
            const angle = Math2D.angleBetween(toLast, toNext);
            const lengthAtStroke = modifiedRadius / Math.tan(angle / 2);
            const lengthToCenter = Math.sqrt(modifiedRadius * modifiedRadius + lengthAtStroke * lengthAtStroke);
            const start = Math2D.add(current, Math2D.scaleTo(toLast, lengthAtStroke));
            const end = Math2D.add(current, Math2D.scaleTo(toNext, lengthAtStroke));
            const center = Math2D.add(
                current,
                Math2D.scaleTo(Math2D.add(Math2D.normalize(toLast), Math2D.normalize(toNext)), lengthToCenter)
            );
            roundedCorners.push({
                start,
                end,
                center,
                radius: modifiedRadius
            });
        }
        const withNext = [...roundedCorners, roundedCorners.at(0)!];
        const segments: Segment[] = [];
        for (let i = 0; i < roundedCorners.length; i++) {
            const current = roundedCorners[i];
            const next = withNext[i + 1];
            const corner: ArcSegment = {
                type: ArcSegment.TYPE,
                center: current.center,
                radiusX: current.radius,
                radiusY: current.radius,
                clockwise: true,
                end: current.end
            };
            const lineToNext: LineSegment = {
                type: LineSegment.TYPE,
                end: next.start
            };
            segments.push(corner, lineToNext);
        }
        return {
            start: roundedCorners[0].start,
            segments
        };
    }

    protected extendInnerBounds(bounds: Bounds, style: ShapeStyle): Bounds {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        return this.extendBounds(
            bounds,
            strokeWidth / 2 + Math.max(ShapeEngine.DEFAULT_MARGIN, (style.radius ?? 0) * (1 - 1 / Math.sqrt(2)))
        );
    }
}

interface RoundedCorner {
    start: Point;
    end: Point;
    center: Point;
    radius: number;
}
