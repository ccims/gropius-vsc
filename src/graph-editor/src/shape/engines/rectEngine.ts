import { Bounds, Point } from "sprotty-protocol";
import { ShapeStyle, StrokeStyle } from "../../gropiusModel.js";
import { Shape } from "../shape.js";
import { PolygonEngine } from "./polygonEngine.js";

export class RectEngine extends PolygonEngine {
    override generateForBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const reducedBounds = this.extendBounds(bounds, -strokeWidth / 2);
        const points: Point[] = [
            { x: reducedBounds.x, y: reducedBounds.y },
            { x: reducedBounds.x + reducedBounds.width, y: reducedBounds.y },
            { x: reducedBounds.x + reducedBounds.width, y: reducedBounds.y + reducedBounds.height },
            { x: reducedBounds.x, y: reducedBounds.y + reducedBounds.height }
        ];
        return this.generateShape(points, style);
    }

    override generateForInnerBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const extendedBounds = this.extendInnerBounds(bounds, style);
        const points: Point[] = [
            { x: extendedBounds.x, y: extendedBounds.y },
            { x: extendedBounds.x + extendedBounds.width, y: extendedBounds.y },
            { x: extendedBounds.x + extendedBounds.width, y: extendedBounds.y + extendedBounds.height },
            { x: extendedBounds.x, y: extendedBounds.y + extendedBounds.height }
        ];
        return this.generateShape(points, style);
    }
}
