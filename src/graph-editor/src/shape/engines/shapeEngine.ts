import { Bounds } from "sprotty-protocol";
import { Shape } from "../shape.js";
import { ShapeStyle } from "../../gropiusModel.js";

export abstract class ShapeEngine {
    static readonly DEFAULT_MARGIN = 5;

    abstract generateForBounds(bounds: Bounds, style: ShapeStyle): Shape;
    abstract generateForInnerBounds(bounds: Bounds, style: ShapeStyle): Shape;

    protected extendBounds(bounds: Bounds, margin: number): Bounds {
        return {
            x: bounds.x - margin,
            y: bounds.y - margin,
            width: bounds.width + 2 * margin,
            height: bounds.height + 2 * margin
        };
    }
}
