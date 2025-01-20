import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { IView, RenderingContext, svg } from "sprotty";
import { SIssueType } from "../smodel/sIssueType.js";
import { wrapForeignElement } from "./util.js";
import { SChip } from "../smodel/sChip.js";

const issueTypeFolderPath =
    "M 37 5 H 21 L 17 1 H 5 C 2.78 1 1 2.78 1 5 V 29 A 4 4 90 0 0 5 33 H 37 A 4 4 90 0 0 41 29 V 9 C 41 6.78 39.2 5 37 5 Z M 21 5 H 1 H 9";

@injectable()
export class IssueTypeView implements IView {
    render(model: Readonly<SIssueType>, context: RenderingContext, args?: {} | undefined): VNode | undefined {
        const count = model.children.find((child) => child.type === "chip") as SChip;
        const countChip = wrapForeignElement(context.renderElement(count), {
            x: 41 - count.size.width / 3,
            y: 33 - count.size.height / 2
        });
        const icon = svg("path", {
            class: {
                "issue-type-icon": true,
                open: model.isOpen,
                closed: !model.isOpen,
                selectable: true
            },
            attrs: {
                d: model.iconPath
            }
        });
        const folder = svg("path", {
            class: {
                "issue-type-folder": true,
                highlighted: model.highlighted,
                selected: model.selected
            },
            attrs: {
                d: issueTypeFolderPath
            }
        });
        return svg(
            "g",
            {
                class: {
                    "issue-type": true
                }
            },
            folder,
            svg(
                "g",
                {
                    attrs: {
                        transform: `translate(6, 4) scale(0.3)`
                    }
                },
                icon
            ),
            countChip
        );
    }
}
