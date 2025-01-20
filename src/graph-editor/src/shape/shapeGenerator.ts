import { ShapeEngine } from "./engines/shapeEngine.js";
import { Shape as GropiusShape, ShapeStyle } from "../gropiusModel.js";
import { Bounds } from "sprotty-protocol";
import { Shape } from "./shape.js";
import { EllipseEngine } from "./engines/ellipseEngine.js";
import { CircleEngine } from "./engines/circleEngine.js";
import { RectEngine } from "./engines/rectEngine.js";
import { RhombusEngine } from "./engines/rhombusEngine.js";
import { HexagonEngine } from "./engines/hexagonEngine.js";

export class ShapeGenerator {
    static DEFAULT = new ShapeGenerator();

    private engines = new Map<GropiusShape, ShapeEngine>([
        ["CIRCLE", new CircleEngine()],
        ["ELLIPSE", new EllipseEngine()],
        ["RECT", new RectEngine()],
        ["RHOMBUS", new RhombusEngine()],
        ["HEXAGON", new HexagonEngine()]
    ]);

    generateForBounds(shape: GropiusShape, bounds: Bounds, style: ShapeStyle): Shape {
        const engine = this.getEngine(shape);
        return engine.generateForBounds(bounds, style);
    }

    generateForInnerBounds(shape: GropiusShape, bounds: Bounds, style: ShapeStyle): Shape {
        const engine = this.getEngine(shape);
        return engine.generateForInnerBounds(bounds, style);
    }

    private getEngine(shape: GropiusShape): ShapeEngine {
        const engine = this.engines.get(shape);
        if (engine) {
            return engine;
        } else {
            throw new Error(`No engine found for shape ${shape}`);
        }
    }
}
