import { Action, Point } from "sprotty-protocol";
import { RelationPath, RelationPathSegment } from "../../smodel/relationPath.js";
import { BaseSegment, MoveHandler } from "./moveHandler.js";
import { RelationLayout } from "../../gropiusModel.js";
import { SegmentLayout } from "../../line/model/segmentLayout.js";
import { Line } from "../../line/model/line.js";
import { UpdateLayoutAction } from "./updateLayoutAction.js";
import { Math2D } from "../../line/math.js";

export class RelationMoveHandler extends MoveHandler {
    constructor(
        readonly relation: string,
        readonly path: RelationPath,
        readonly segment: number,
        readonly startLine: Line,
        readonly endLine: Line
    ) {
        super();
    }

    generateAction(dx: number, dy: number, commited: boolean, event: MouseEvent): Action {
        let replacedStartSegments = 0;
        let replacedEndSegments = 0;
        const movedSegment = this.path.segments[this.segment];
        // do we move a vertical segment
        const vertical = movedSegment.y != undefined;
        const segmentCount = this.path.segments.length;
        const startSegments: BaseSegment[] = [];
        let newStartPoint: Point | undefined = undefined;
        const endSegments: BaseSegment[] = [];
        let moveVector: Point;
        if (vertical) {
            moveVector = { x: dx, y: 0 };
        } else {
            moveVector = { x: 0, y: dy };
        }
        if (this.segment <= 1) {
            replacedStartSegments = this.segment + 1;
            const [segments, projectedPoint] = this.projectPointOnElement(
                Math2D.add(RelationPath.segmentEnd(movedSegment), moveVector),
                this.segment == 1 ? this.path.segments[0] : undefined,
                true,
                vertical ? SegmentLayout.HORIZONTAL_VERTICAL : SegmentLayout.VERTICAL_HORIZONTAL,
                this.startLine
            );
            startSegments.push(...segments);
            newStartPoint = projectedPoint;
        }
        if (this.segment >= segmentCount - 2) {
            replacedEndSegments = segmentCount - this.segment;
            endSegments.push(
                ...this.projectPointOnElement(
                    Math2D.add(movedSegment.start, moveVector),
                    this.segment == segmentCount - 2 ? this.path.segments.at(-1) : undefined,
                    false,
                    vertical ? SegmentLayout.HORIZONTAL_VERTICAL : SegmentLayout.VERTICAL_HORIZONTAL,
                    this.endLine
                )[0]
            );
        }
        let newLayout: RelationLayout;
        if (replacedStartSegments > 0 && replacedEndSegments > 0) {
            newLayout = this.layoutFromPath(newStartPoint!, [...startSegments, ...endSegments]);
        } else if (replacedStartSegments > 0) {
            newLayout = this.layoutFromPath(newStartPoint!, [
                ...startSegments,
                ...this.path.segments.slice(replacedStartSegments)
            ]);
        } else if (replacedEndSegments > 0) {
            const segmentToModify = this.path.segments.at(-replacedEndSegments - 1)!;
            const modifiedSegment = {
                x: segmentToModify.x ? segmentToModify.x + moveVector.x : undefined,
                y: segmentToModify.y ? segmentToModify.y + moveVector.y : undefined
            } as BaseSegment;
            newLayout = this.layoutFromPath(this.path.start, [
                ...this.path.segments.slice(0, segmentCount - replacedEndSegments - 1),
                modifiedSegment,
                ...endSegments
            ]);
        } else {
            const segmentToModifiy = this.path.segments[this.segment - 1];
            const modifiedSegment = {
                x: segmentToModifiy.x ? segmentToModifiy.x + moveVector.x : undefined,
                y: segmentToModifiy.y ? segmentToModifiy.y + moveVector.y : undefined
            } as BaseSegment;
            newLayout = this.layoutFromPath(this.path.start, [
                ...this.path.segments.slice(0, this.segment - 1),
                modifiedSegment,
                ...this.path.segments.slice(this.segment)
            ]);
        }
        const action: UpdateLayoutAction = {
            kind: UpdateLayoutAction.KIND,
            partialLayout: {
                [this.relation]: newLayout
            }
        };
        return action;
    }
}
