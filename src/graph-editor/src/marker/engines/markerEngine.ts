export abstract class MarkerEngine {
    constructor(
        readonly path: string,
        readonly filled: boolean
    ) {}

    abstract startOffset(strokeWidth: number): number;

    abstract lineOffset(strokeWidth: number): number;
}
