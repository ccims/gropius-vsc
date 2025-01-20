import { RenderingContext, svg } from "sprotty";
import { VNode } from "snabbdom";
import { ShapeStyle, StrokeStyle } from "../gropiusModel.js";
import { IssueAffected } from "../model/issueAffected.js";
import { SSelectable } from "./sSelectable.js";
import { Locateable, Point, Selectable } from "sprotty-protocol";
import { Shape } from "../shape/shape.js";
import { wrapForeignElement } from "../views/util.js";
import { LineEngine } from "../line/engine/lineEngine.js";
import { SChip } from "./sChip.js";
import { Math2D } from "../line/math.js";
import { IssueType } from "../model/issueType.js";
import { SIssueType } from "./sIssueType.js";

export abstract class SIssueAffected extends SSelectable implements IssueAffected, Selectable, Locateable {
    style!: ShapeStyle;
    x!: number;
    y!: number;
    selected = false;
    abstract shape: Shape;
    abstract issueTypesCenterTopPos: Point;
    issueTypes!: SIssueType[];
    position!: Point;

    get contextMenuPos(): Point {
        const shape = this.shape;
        return {
            x: shape.bounds.x + shape.bounds.width,
            y: shape.bounds.y
        };
    }

    constructor() {
        super();
        this.cachedProperty<SIssueType[]>("issueTypes", () => {
            return this.children.filter((child) => child.type === IssueType.TYPE) as SIssueType[];
        });
        this.cachedProperty<Point>("position", () => {
            return {
                x: this.x,
                y: this.y
            };
        });
    }

    generateShapeAttrs(): Record<string, number | string> {
        const res: Record<string, number | string> = {};
        if (this.style.fill != undefined) {
            const fill = this.style.fill;
            res.fill = fill.color;
        } else {
            res.fill = "transparent";
        }
        if (this.style.stroke != undefined) {
            const stroke = this.style.stroke;
            if (stroke.dash != undefined) {
                res["stroke-dasharray"] = stroke.dash.join(" ");
            }
            const strokeWidth = StrokeStyle.strokeWidth(this.style);
            res["stroke-width"] = strokeWidth;
            res.stroke = stroke.color ?? "var(--shape-stroke-color)";
        }
        return res;
    }

    generateShape(): VNode[] {
        const result: VNode[] = [];
        const pathString = LineEngine.DEFAULT.toPathString(this.shape.outline);
        result.push(
            svg("path", {
                attrs: {
                    d: pathString,
                    ...this.generateShapeAttrs()
                },
                class: {
                    shape: true,
                    selectable: true
                }
            })
        );
        if (this.selected) {
            result.push(
                svg("path", {
                    attrs: {
                        d: pathString
                    },
                    class: {
                        "selected-shape": true,
                        "selected-path": true
                    }
                })
            );
        }
        return result;
    }

    renderVersionLabel(context: RenderingContext, chip: SChip): VNode | undefined {
        const shape = this.shape;
        const shapeBounds = shape.bounds;
        const topLeft = {
            x: shapeBounds.x,
            y: shapeBounds.y
        };
        const topLeftProjected = LineEngine.DEFAULT.projectPoint(topLeft, shape.outline).pos;
        const labelPos = LineEngine.DEFAULT.getPoint(topLeftProjected, 0, shape.outline);
        return wrapForeignElement(
            context.renderElement(chip),
            Math2D.add(labelPos, {
                x: (-chip.size.width / 3) * 2,
                y: -chip.size.height / 2
            })
        );
    }

    issueTypePos(index: number): Point {
        const centerTop = this.issueTypesCenterTopPos;
        const count = this.issueTypes.length;
        const width = 42;
        const margin = 8;
        const offsetX = -(count * width + (count - 1) * margin) / 2 + index * (width + margin);
        return {
            x: centerTop.x + offsetX,
            y: centerTop.y
        };
    }

    renderIssueTypes(context: RenderingContext): VNode[] {
        const result: VNode[] = [];
        const count = this.issueTypes.length;
        for (let i = count - 1; i >= 0; i--) {
            const issueType = this.issueTypes[i];
            const pos = this.issueTypePos(i);
            result.push(
                svg(
                    "g",
                    {
                        attrs: {
                            transform: `translate(${pos.x}, ${pos.y})`
                        }
                    },
                    context.renderElement(issueType)
                )
            );
        }
        return result;
    }
}

export namespace SIssueAffected {
    export const defaultAnimatedFields = ["x", "y"];
}
