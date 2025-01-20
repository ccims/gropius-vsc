import { ViewportRootElementImpl } from "sprotty";
import { Root } from "../model/root.js";
import { Bounds } from "sprotty-protocol";
import { Math2D } from "../line/math.js";
import { SIssueRelation } from "./sIssueRelation.js";
import { SIssueType } from "./sIssueType.js";

export class SRoot extends ViewportRootElementImpl {
    override type: typeof Root.TYPE = Root.TYPE;
    animated?: boolean;
    targetBounds?: Bounds;
    changeRevision = 0;
    private _issueRelationHighlightRelation!: Map<string, Set<string>>;

    private get issueRelationHighlightRelation(): Map<string, Set<string>> {
        if (!this._issueRelationHighlightRelation) {
            this._issueRelationHighlightRelation = new Map<string, Set<string>>();
            for (const child of this.children) {
                if (child instanceof SIssueRelation) {
                    this.insertIssueRelationHighlightRelation(
                        [child.startType, child.endType, child.id],
                        this._issueRelationHighlightRelation
                    );
                }
            }
        }
        return this._issueRelationHighlightRelation;
    }

    private insertIssueRelationHighlightRelation(relevant: string[], mapping: Map<string, Set<string>>): void {
        for (const cause of relevant) {
            if (!mapping.has(cause)) {
                mapping.set(cause, new Set<string>());
            }
            const set = mapping.get(cause)!;
            for (const id of relevant) {
                set.add(id);
            }
        }
    }

    getRelatedHighlightable(cause: string | undefined): string[] {
        if (cause === undefined) {
            return [];
        }
        return Array.from(this.issueRelationHighlightRelation.get(cause) ?? [cause]);
    }

    updateToTargetBounds(): void {
        if (this.targetBounds) {
            const targetZoomX = this.canvasBounds.width / this.targetBounds.width;
            const targetZoomY = this.canvasBounds.height / this.targetBounds.height;
            this.zoom = Math.min(targetZoomX, targetZoomY);
            const targetCenter = Bounds.center(this.targetBounds);
            const currentCenter = Math2D.scale(
                {
                    x: this.canvasBounds.width / 2,
                    y: this.canvasBounds.height / 2
                },
                1 / this.zoom
            );
            this.scroll = Math2D.sub(targetCenter, currentCenter);
        }
    }

    generateStyle(): string {
        return `
            .sprotty .label {
                display: inline-block;
                min-width: 50px;
                max-width: 200px;
                word-wrap: break-word;
                text-align: center;
                user-select: none;
                font-size: 1.2em;
            }

            .sprotty .label.with-background {
                background: var(--background-overlay-color);
                line-height: normal;
                border-radius: 0.3em;
            }

            .sprotty svg {
                background:
                  radial-gradient(circle, var(--diagram-grid) 1.2px, transparent 1.2px)
                    calc(var(--diagram-scroll-x) * -1 * var(--diagram-zoom))
                    calc(var(--diagram-scroll-y) * -1 * var(--diagram-zoom)) /
                    calc(50px * var(--diagram-zoom-normalized)) calc(50px * var(--diagram-zoom-normalized));
            }

            .sprotty foreignObject {
                pointer-events: none;
            }

            .sprotty .chip {
                user-select: none;
                pointer-events: all;
                border-radius: 9999px;
                display: table;
                min-height: 0;
                line-height: 1;
            }

            .sprotty .issue-affected .chip {
                font-size: 0.75em;
                padding: 5px 0.5em;
                background: var(--version-chip-background);
                color: var(--version-chip-color);
                cursor: pointer;
            }

            .sprotty .issue-affected .issue-type .chip {
                font-size: 0.6em;
                padding: 3px 0.5em;
            }

            .sprotty .selected-shape {
                fill: var(--selected-shape-fill-color);
            }

            .sprotty .selected-path {
                stroke: var(--selected-shape-stroke-color);
                stroke-width: calc(3px / var(--diagram-zoom));
                stroke-dasharray: calc(6px / var(--diagram-zoom));
                cursor: pointer;
            }

            .sprotty .selectable {
                cursor: pointer;
            }

            .sprotty .issue-type-folder {
                stroke: var(--shape-stroke-color);
                stroke-width: 2px;
                fill: var(--background-overlay-color);
                cursor: pointer;
            }

            .sprotty .issue-type-folder.selected,
            .sprotty .issue-type-folder.highlighted {
                stroke: var(--highlight-stroke-color);
                fill: var(--highlight-fill-color);
            }

            .sprotty .issue-relation {
                fill: none;
                stroke: var(--issue-relation-stroke-color);
                stroke-width: 3.5;
                stroke-dasharray: 10, 5;
            }

            .sprotty .issue-relation.highlighted {
                stroke: var(--highlight-stroke-color);
            }

            .sprotty .issue-relation-arrow {
                fill: var(--issue-relation-stroke-color);
                stroke: none;
            }

            .sprotty .issue-relation-arrow.highlighted {
                fill: var(--highlight-stroke-color);
            }

            .sprotty .issue-type-icon.closed {
                fill: var(--issue-closed-color);
            }

            .sprotty .issue-type-icon.open {
                fill: var(--issue-open-color);
            }

            .sprotty .context-menu {
                width: fit-content;
                height: fit-content;
            }

            .sprotty .hidden-path {
                fill: none;
                stroke: transparent;
                stroke-width: calc(52px / var(--diagram-zoom));
                pointer-events: visibleStroke;
            }

            .sprotty .path-resize-x {
                cursor: ns-resize;
            }
            
            .sprotty .path-resize-y {
                cursor: ew-resize;
            }
        `;
    }
}
