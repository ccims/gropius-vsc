import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { IView, RenderingContext, svg } from "sprotty";
import { SRelation } from "../smodel/sRelation.js";
import { Math2D } from "../line/math.js";
import { StrokeStyle } from "../gropiusModel.js";
import { MarkerGenerator } from "../marker/markerGenerator.js";
import { SLabel } from "../smodel/sLabel.js";

@injectable()
export class RelationView implements IView {
    render(model: Readonly<SRelation>, context: RenderingContext, args?: {} | undefined): VNode | undefined {
        const relationPath = model.path;
        if (relationPath == null) {
            return undefined;
        }
        const { start, end, segments } = relationPath;
        const lastSegment = segments.at(-1)!;
        let endVector = Math2D.sub(lastSegment.start, {
            x: lastSegment.x ?? lastSegment.start.x,
            y: lastSegment.y ?? lastSegment.start.y
        });
        if (Math2D.length(endVector) == 0) {
            endVector = { x: 1, y: 0 };
        }
        const markerAngle = Math2D.angle(endVector) + Math.PI;
        const strokeWidth = StrokeStyle.strokeWidth(model.style);
        const pathStyle = {
            "stroke-width": strokeWidth,
            stroke: model.style.stroke?.color ?? "var(--shape-stroke-color)"
        };
        const markerInfo = MarkerGenerator.DEFAULT.getMarkerInfo(model.style);
        const markerStartPoint = Math2D.add(end, Math2D.scaleTo(endVector, markerInfo.startOffset));
        const children: (VNode | undefined)[] = [];
        const endMarker = svg("path", {
            attrs: {
                d: markerInfo.path,
                ...pathStyle,
                transform: `translate(${markerStartPoint.x}, ${markerStartPoint.y}) rotate(${
                    (markerAngle * 180) / Math.PI
                })`,
                fill: markerInfo.filled ? pathStyle.stroke : "none"
            }
        });
        children.push(endMarker);

        const resizeChildren: (VNode | undefined)[] = [];
        const endOffset = markerInfo.startOffset - markerInfo.lineOffset;
        const pathParts = [`M ${start.x} ${start.y}`];
        const currentPoint = { x: start.x, y: start.y };
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            let offset = 0;
            if (i == segments.length - 1) {
                offset = endOffset;
            }
            if (segment.x != undefined) {
                const x = segment.x + Math.sign(endVector.x) * offset;
                pathParts.push(`H ${x}`);
                resizeChildren.push(
                    svg("line", {
                        x1: currentPoint.x,
                        y1: currentPoint.y,
                        x2: x,
                        y2: currentPoint.y,
                        class: {
                            "hidden-path": true,
                            "path-resize-x": true
                        },
                        attrs: {
                            "data-index": i
                        }
                    })
                );
                currentPoint.x = x;
            } else {
                const y = segment.y + Math.sign(endVector.y) * offset;
                pathParts.push(`V ${y}`);
                resizeChildren.push(
                    svg("line", {
                        x1: currentPoint.x,
                        y1: currentPoint.y,
                        x2: currentPoint.x,
                        y2: y,
                        class: {
                            "hidden-path": true,
                            "path-resize-y": true
                        },
                        attrs: {
                            "data-index": i
                        }
                    })
                );
                currentPoint.y = y;
            }
        }

        const pathPath = pathParts.join(" ");
        const pathAttributes: Record<string, string | number> = {
            d: pathPath,
            ...pathStyle,
            fill: "none"
        };
        if (model.style.stroke?.dash != undefined) {
            pathAttributes["stroke-dasharray"] = model.style.stroke.dash.join(" ");
        }
        const path = svg("path", {
            attrs: pathAttributes
        });
        children.push(path);
        const hiddenPath = svg("path", {
            attrs: {
                d: pathPath
            },
            class: {
                "hidden-path": true
            }
        });
        children.push(hiddenPath);
        if (model.selected) {
            const selectedPath = svg("path", {
                attrs: {
                    d: pathPath,
                    fill: "none"
                },
                class: {
                    "selected-path": true
                }
            });
            children.push(selectedPath);
        }

        for (const child of model.children) {
            if (child instanceof SLabel) {
                // TODO
            }
        }
        return svg(
            "g",
            {
                class: {
                    selectable: true
                }
            },
            ...children,
            ...resizeChildren
        );
    }
}
