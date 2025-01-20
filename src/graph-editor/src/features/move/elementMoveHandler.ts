import { Point } from "sprotty-protocol";
import { Component } from "../../model/component.js";
import { Interface } from "../../model/interface.js";
import { BaseSegment, MoveHandler } from "./moveHandler.js";
import { UpdateLayoutAction } from "./updateLayoutAction.js";
import { GraphLayout } from "../../gropiusModel.js";
import { SegmentLayout } from "../../line/model/segmentLayout.js";
import { Relation } from "../../model/relation.js";
import { RelationPath } from "../../smodel/relationPath.js";
import { Line } from "../../line/model/line.js";
import { Math2D } from "../../line/math.js";

export interface PartiallyMovedRelation {
    elementLine: Line;
    path: RelationPath;
}

export class ElementMoveHandler extends MoveHandler {
    private readonly elementLayouts: Record<string, Point> = {};
    private readonly fullyMovedRelationLayouts: Record<string, Point[]> = {};

    constructor(
        elements: (Interface | Component)[],
        fullyMovedRelations: Relation[],
        private readonly startMovedRelations: Record<string, PartiallyMovedRelation>,
        private readonly endMovedRelations: Record<string, PartiallyMovedRelation>
    ) {
        super();
        for (const element of elements) {
            this.elementLayouts[element.id] = {
                x: element.x,
                y: element.y
            };
        }
        for (const relation of fullyMovedRelations) {
            this.fullyMovedRelationLayouts[relation.id] = relation.points;
        }
    }

    generateAction(dx: number, dy: number, commited: boolean, event: MouseEvent): UpdateLayoutAction {
        let offsetX = dx;
        let offsetY = dy;
        if (event.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) {
                offsetY = 0;
            } else {
                offsetX = 0;
            }
        }
        const offset = { x: offsetX, y: offsetY };
        const partialLayout: GraphLayout = {};
        for (const [key, layout] of Object.entries(this.elementLayouts)) {
            partialLayout[key] = {
                pos: {
                    x: layout.x + offsetX,
                    y: layout.y + offsetY
                }
            };
        }
        for (const [key, points] of Object.entries(this.fullyMovedRelationLayouts)) {
            partialLayout[key] = {
                points: points.map((point) => Math2D.add(point, offset))
            };
        }
        for (const [key, { elementLine, path }] of Object.entries(this.startMovedRelations)) {
            let pointToProject: Point;
            const segmentLayout =
                path.segments[0].x != undefined ? SegmentLayout.HORIZONTAL_VERTICAL : SegmentLayout.VERTICAL_HORIZONTAL;
            if (path.segments.length > 2) {
                pointToProject = path.segments[2].start;
            } else {
                pointToProject = path.end;
            }
            const [startSegments, startPoint] = this.projectPointOnElement(
                Math2D.sub(pointToProject, offset),
                undefined,
                true,
                segmentLayout,
                elementLine
            );
            partialLayout[key] = this.layoutFromPath(Math2D.add(startPoint, offset), [
                ...this.translateSegments(startSegments, offset),
                ...path.segments.slice(2)
            ]);
        }
        for (const [key, { elementLine, path }] of Object.entries(this.endMovedRelations)) {
            let pointToProject: Point;
            const segmentLayout =
                path.segments.at(-1)!.x != undefined
                    ? SegmentLayout.HORIZONTAL_VERTICAL
                    : SegmentLayout.VERTICAL_HORIZONTAL;
            if (path.segments.length > 1) {
                pointToProject = path.segments.at(-2)!.start;
            } else {
                pointToProject = path.start;
            }
            const [endSegments] = this.projectPointOnElement(
                Math2D.sub(pointToProject, offset),
                undefined,
                false,
                segmentLayout,
                elementLine
            );
            partialLayout[key] = this.layoutFromPath(path.start, [
                ...path.segments.slice(0, -2),
                ...this.translateSegments(endSegments, offset)
            ]);
        }
        return {
            kind: UpdateLayoutAction.KIND,
            partialLayout
        };
    }

    private translateSegments(segments: BaseSegment[], offset: Point): BaseSegment[] {
        return segments.map((segment) => {
            if (segment.x != undefined) {
                return { x: segment.x + offset.x };
            } else {
                return { y: segment.y + offset.y };
            }
        });
    }
}
