import { Point } from "sprotty-protocol";

export interface Graph {
    components: ComponentVersion[];
    relations: Relation[];
    issueRelations: IssueRelation[];
}

export interface Node {
    id: string;
}

export interface IssueType extends Node {
    name: string;
    iconPath: string;
    count: number;
    isOpen: boolean;
}

export interface Selectable extends Node {
    contextMenu: any;
}

export interface IssueAffected extends Selectable {
    name: string;
    version?: string;
    style: ShapeStyle;
    issueTypes: IssueType[];
}

export interface ComponentVersion extends IssueAffected {
    interfaces: Interface[];
}

export interface Relation extends Selectable {
    name: string;
    start: string;
    end: string;
    style: RelationStyle;
}

export interface IssueRelation {
    start: string;
    end: string;
    count: number;
}

export type Interface = IssueAffected;

export interface StrokeStyle {
    stroke?: {
        color?: string;
        dash?: number[];
    };
}

export namespace StrokeStyle {
    export function strokeWidth(style: StrokeStyle): number {
        return 2;
    }
}

export interface FillStyle {
    fill?: {
        color: string;
    };
}

export interface ShapeStyle extends StrokeStyle, FillStyle {
    shape: Shape;
    radius?: number;
}

export interface RelationStyle extends StrokeStyle {
    marker: Marker;
}

export type Shape = "RECT" | "CIRCLE" | "ELLIPSE" | "RHOMBUS" | "HEXAGON";

export type Marker =
    | "ARROW"
    | "DIAMOND"
    | "FILLED_DIAMOND"
    | "TRIANGLE"
    | "FILLED_TRIANGLE"
    | "CIRCLE"
    | "FILLED_CIRCLE";

export interface ElementLayout {
    pos: Point;
}

export interface RelationLayout {
    points: Point[];
}

export interface GraphLayout {
    [id: string]: ElementLayout | RelationLayout | undefined;
}
