import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { IView, IViewArgs, RenderingContext, svg } from "sprotty";
import { SInterface } from "../smodel/sInterface.js";
import { SLabel } from "../smodel/sLabel.js";
import { LineEngine } from "../line/engine/lineEngine.js";
import { wrapForeignElement } from "./util.js";
import { SComponent } from "../smodel/sComponent.js";
import { Bounds } from "sprotty-protocol";
import { Math2D } from "../line/math.js";
import { SChip } from "../smodel/sChip.js";

const MAX_CONTROL_POINT_DISTANCE = 75;

@injectable()
export class InterfaceView implements IView {
    render(model: Readonly<SInterface>, context: RenderingContext, args?: {} | undefined): VNode | undefined {
        let nameLabel: SLabel | undefined;
        const otherChildren: (VNode | undefined)[] = [];
        for (const child of model.children) {
            if (child instanceof SLabel) {
                nameLabel = child;
            } else if (child instanceof SChip) {
                otherChildren.push(model.renderVersionLabel(context, child));
            }
        }
        otherChildren.push(...model.renderIssueTypes(context));
        const parent = model.parent as SComponent;
        const connectionLine = this.renderConnectionLine(model, parent);
        const interfaceView = svg(
            "g",
            null,
            ...model.generateShape(),
            wrapForeignElement(context.renderElement(nameLabel!), {
                x: model.pos.x - nameLabel!.size.width / 2,
                y: model.pos.y + model.shape.bounds.height / 2 + 3
            })
        );
        return svg(
            "g",
            {
                class: {
                    interface: true,
                    "issue-affected": true
                }
            },
            connectionLine,
            interfaceView,
            ...otherChildren
        );
    }

    private renderConnectionLine(model: Readonly<SInterface>, parent: SComponent): VNode {
        const shape = model.shape;
        const parentShape = parent.shape;
        const center = Bounds.center(shape.bounds);
        const endPos = LineEngine.DEFAULT.projectPoint(center, parentShape.outline).pos;
        const endPoint = LineEngine.DEFAULT.getPoint(endPos, 0, parentShape.outline);
        const startPos = LineEngine.DEFAULT.projectPoint(endPoint, shape.outline).pos;
        const startPoint = LineEngine.DEFAULT.getPoint(startPos, 0, shape.outline);
        const startVector = LineEngine.DEFAULT.getNormal(startPos, shape.outline);
        const endVector = LineEngine.DEFAULT.getNormal(endPos, parentShape.outline);
        const distance = Math2D.distance(startPoint, endPoint);
        const controlPointDistance = Math.min(distance / 2, MAX_CONTROL_POINT_DISTANCE);
        const controlPoint1 = Math2D.add(startPoint, Math2D.scaleTo(startVector, controlPointDistance));
        const controlPoint2 = Math2D.add(endPoint, Math2D.scaleTo(endVector, controlPointDistance));
        return svg("path", {
            attrs: {
                d: `M ${startPoint.x} ${startPoint.y} C ${controlPoint1.x} ${controlPoint1.y} ${controlPoint2.x} ${controlPoint2.y} ${endPoint.x} ${endPoint.y}`,
                stroke: "var(--shape-stroke-color)",
                fill: "none",
                "stroke-width": 2
            }
        });
    }
}
