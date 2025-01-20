import { Bounds, Point } from "sprotty-protocol";
import { ShapeStyle, StrokeStyle } from "../../gropiusModel.js";
import { Shape } from "../shape.js";
import { PolygonEngine } from "./polygonEngine.js";

export class RhombusEngine extends PolygonEngine {
    override generateForBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const reducedBounds = this.extendBounds(bounds, -strokeWidth / 2);
        const points: Point[] = [
            { x: reducedBounds.x + reducedBounds.width / 2, y: reducedBounds.y },
            { x: reducedBounds.x + reducedBounds.width, y: reducedBounds.y + reducedBounds.height / 2 },
            { x: reducedBounds.x + reducedBounds.width / 2, y: reducedBounds.y + reducedBounds.height },
            { x: reducedBounds.x, y: reducedBounds.y + reducedBounds.height / 2 }
        ];
        return this.generateShape(points, style);
    }

    override generateForInnerBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const extendedBounds = this.extendInnerBounds(bounds, style);
        const points: Point[] = [
            { x: extendedBounds.x + extendedBounds.width / 2, y: extendedBounds.y - extendedBounds.height / 2 },
            { x: extendedBounds.x + extendedBounds.width * 1.5, y: extendedBounds.y + extendedBounds.height / 2 },
            { x: extendedBounds.x + extendedBounds.width / 2, y: extendedBounds.y + extendedBounds.height * 1.5 },
            { x: extendedBounds.x - extendedBounds.width / 2, y: extendedBounds.y + extendedBounds.height / 2 }
        ];
        return this.generateShape(points, style);
    }
}
