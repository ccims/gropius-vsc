import { Bounds, Dimension, Point } from "sprotty-protocol";
import { ShapeStyle, StrokeStyle } from "../../gropiusModel.js";
import { Shape } from "../shape.js";
import { ShapeEngine } from "./shapeEngine.js";
import { ArcSegment } from "../../line/model/arcSegment.js";
import { Line } from "../../line/model/line.js";
import { Math2D } from "../../line/math.js";

export class EllipseEngine extends ShapeEngine {
    override generateForBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const sqrt2half = Math.sqrt(2) / 2;
        const borderSize = this.calculate45DegreeStrokeVector(bounds, strokeWidth);
        const center = Bounds.center(bounds);
        return {
            bounds,
            shape: "ELLIPSE",
            outline: this.outline(center, bounds.width - strokeWidth / 2, bounds.height - strokeWidth / 2)
        };
    }

    override generateForInnerBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const sqrt2half = Math.sqrt(2) / 2;
        const borderSize = this.calculate45DegreeStrokeVector(bounds, strokeWidth);
        const outerSize = {
            width: (bounds.width + 2 * borderSize.x) / sqrt2half + 2 * ShapeEngine.DEFAULT_MARGIN,
            height: (bounds.height + 2 * borderSize.y) / sqrt2half + 2 * ShapeEngine.DEFAULT_MARGIN
        };
        const center = Bounds.center(bounds);
        return {
            bounds: {
                ...outerSize,
                x: center.x - outerSize.width / 2,
                y: center.y - outerSize.height / 2
            },
            shape: "ELLIPSE",
            outline: this.outline(center, outerSize.width / 2 - strokeWidth / 2, outerSize.height / 2 - strokeWidth / 2)
        };
    }

    protected outline(center: Point, rx: number, ry: number): Line {
        const width = rx * 2;
        const height = ry * 2;
        const startPos = {
            x: center.x - rx,
            y: center.y
        };
        const segments = [{ x: center.x + rx, y: center.y }, startPos].map((endPos) => ({
            type: ArcSegment.TYPE,
            radiusX: width / 2,
            radiusY: height / 2,
            center,
            clockwise: true,
            end: endPos
        }));
        return {
            start: startPos,
            segments: segments
        };
    }

    private calculate45DegreeStrokeVector(size: Dimension, strokeWidth: number): Point {
        if (strokeWidth === 0) {
            return Point.ORIGIN;
        }
        const sqrt2half = Math.sqrt(2) / 2;
        const dx = size.width / 2;
        const dy = size.height / 2;
        const nx = (dy * sqrt2half) / Math.sqrt(dy ** 2 / 2 + dx ** 2 / 2);
        const ny = (dx * sqrt2half) / Math.sqrt(dy ** 2 / 2 + dx ** 2 / 2);
        return Math2D.scaleTo({ x: nx, y: ny }, strokeWidth);
    }
}
