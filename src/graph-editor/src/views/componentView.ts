import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { IView, RenderingContext, svg } from "sprotty";
import { SComponent } from "../smodel/sComponent.js";
import { SLabel } from "../smodel/sLabel.js";
import { wrapForeignElement } from "./util.js";
import { SChip } from "../smodel/sChip.js";
import { SInterface } from "../smodel/sInterface.js";

@injectable()
export class ComponentView implements IView {
    render(model: Readonly<SComponent>, context: RenderingContext, args?: {} | undefined): VNode | undefined {
        let nameLabel: SLabel | undefined;
        const otherChildren: (VNode | undefined)[] = [];
        for (const child of model.children) {
            if (child instanceof SLabel) {
                nameLabel = child;
            } else if (child instanceof SChip) {
                otherChildren.push(model.renderVersionLabel(context, child));
            } else if (child instanceof SInterface) {
                otherChildren.push(context.renderElement(child));
            }
        }
        otherChildren.push(...model.renderIssueTypes(context));
        const component = svg(
            "g",
            null,
            ...model.generateShape(),
            wrapForeignElement(context.renderElement(nameLabel!), {
                x: model.x - nameLabel!.size.width / 2,
                y: model.y - nameLabel!.size.height / 2
            })
        );
        return svg(
            "g",
            {
                class: {
                    component: true,
                    "issue-affected": true
                }
            },
            component,
            ...otherChildren
        );
    }
}
