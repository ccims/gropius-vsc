const PRECISION = 10;

export function roundToPrecision(value: number): number {
    return Math.round(value / PRECISION) * PRECISION;
}

export function floorToPrecision(value: number): number {
    return Math.floor(value / PRECISION) * PRECISION;
}

export function ceilToPrecision(value: number): number {
    return Math.ceil(value / PRECISION) * PRECISION;
}
