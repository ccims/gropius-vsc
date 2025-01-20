import { MarkerEngine } from "./markerEngine.js";

export class DiamondEngine extends MarkerEngine {
    constructor(filled: boolean) {
        super("M -12 -6 L 0 0 L -12 6 L -24 0 Z", filled);
    }

    override startOffset(strokeWidth: number): number {
        const miterLength = strokeWidth / Math.sin(Math.atan(0.5)) / 2;
        return miterLength;
    }

    override lineOffset(strokeWidth: number): number {
        return -24;
    }
}
