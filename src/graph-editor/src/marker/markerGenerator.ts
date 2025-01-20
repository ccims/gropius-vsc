import { ArrowEngine } from "./engines/arrowEngine.js";
import { MarkerEngine } from "./engines/markerEngine.js";
import { Marker as GropiusMarker, RelationStyle, StrokeStyle } from "../gropiusModel.js";
import { DiamondEngine } from "./engines/diamondEngine.js";
import { TriangleEngine } from "./engines/triangleEngine.js";
import { CircleEngine } from "./engines/circleEngine.js";

export class MarkerGenerator {
    static readonly DEFAULT = new MarkerGenerator();

    readonly engines: Map<GropiusMarker, MarkerEngine> = new Map([
        ["ARROW", new ArrowEngine()],
        ["DIAMOND", new DiamondEngine(false)],
        ["FILLED_DIAMOND", new DiamondEngine(true)],
        ["TRIANGLE", new TriangleEngine(false)],
        ["FILLED_TRIANGLE", new TriangleEngine(true)],
        ["CIRCLE", new CircleEngine(false)],
        ["FILLED_CIRCLE", new CircleEngine(true)]
    ]);

    getMarkerInfo(style: RelationStyle): MarkerInfo {
        const strokeWidth = StrokeStyle.strokeWidth(style);
        const engine = this.getEngine(style.marker);
        return {
            path: engine.path,
            startOffset: engine.startOffset(strokeWidth),
            lineOffset: engine.lineOffset(strokeWidth),
            filled: engine.filled
        };
    }

    private getEngine(shape: GropiusMarker): MarkerEngine {
        const engine = this.engines.get(shape);
        if (engine) {
            return engine;
        } else {
            throw new Error(`No engine found for shape ${shape}`);
        }
    }
}

export interface MarkerInfo {
    path: string;
    startOffset: number;
    lineOffset: number;
    filled: boolean;
}
