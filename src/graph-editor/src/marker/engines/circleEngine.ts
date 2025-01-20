import { MarkerEngine } from "./markerEngine.js";

export class CircleEngine extends MarkerEngine {
    constructor(filled: boolean) {
        super("M -12 0 A 6 6 0 1 0 0 0 A 6 6 0 1 0 -12 0", filled);
    }

    override startOffset(strokeWidth: number): number {
        const miterLength = strokeWidth / 2;
        return miterLength;
    }

    override lineOffset(strokeWidth: number): number {
        return -12;
    }
}
