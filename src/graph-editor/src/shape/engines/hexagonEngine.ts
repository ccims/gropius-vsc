import { Bounds, Point } from "sprotty-protocol";
import { PolygonEngine } from "./polygonEngine.js";
import { Shape } from "../shape.js";
import { ShapeStyle, StrokeStyle } from "../../gropiusModel.js";

export class HexagonEngine extends PolygonEngine {
    override generateForBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const reducedBounds = this.extendBounds(bounds, -strokeWidth / 2);
        const center = Bounds.center(reducedBounds);
        const sideLength1 = Math.cos(Math.PI / 6) * reducedBounds.width;
        const sideLength2 = Math.tan(Math.PI / 6) * reducedBounds.height;
        const sideLength = Math.min(sideLength1, sideLength2);
        const points = this.regularHexagon(center, sideLength);
        return this.generateShape(points, style);
    }

    override generateForInnerBounds(bounds: Bounds, style: ShapeStyle): Shape {
        const extendedBounds = this.extendInnerBounds(bounds, style);
        const center = Bounds.center(extendedBounds);
        let sideLength: number;
        if (extendedBounds.width / extendedBounds.height < 1 / (2 * Math.cos(Math.PI / 6))) {
            sideLength = extendedBounds.height / (2 * Math.cos(Math.PI / 6));
        } else {
            const sidePartLength = extendedBounds.height / (2 * Math.sin(Math.PI / 3));
            const topPartLength = (extendedBounds.width - sidePartLength) / (1 + 2 * Math.sin(Math.PI / 6));
            sideLength = sidePartLength + topPartLength;
        }
        const points = this.regularHexagon(center, sideLength);
        return this.generateShape(points, style);
    }

    private regularHexagon(center: Point, sideLength: number): Point[] {
        const toLeft = Math.sin(Math.PI / 6) * sideLength;
        const toTop = Math.cos(Math.PI / 6) * sideLength;
        return [
            { x: center.x - sideLength / 2 - toLeft, y: center.y },
            { x: center.x - sideLength / 2, y: center.y - toTop },
            { x: center.x + sideLength / 2, y: center.y - toTop },
            { x: center.x + sideLength / 2 + toLeft, y: center.y },
            { x: center.x + sideLength / 2, y: center.y + toTop },
            { x: center.x - sideLength / 2, y: center.y + toTop }
        ];
    }
}
