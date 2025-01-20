import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { IView, RenderingContext, html } from "sprotty";
import { SLabel } from "../smodel/sLabel.js";

@injectable()
export class LabelView implements IView {
    render(model: Readonly<SLabel>, context: RenderingContext, args?: {} | undefined): VNode | undefined {
        return html(
            "span",
            {
                class: {
                    label: true,
                    "with-background": model.withBackground
                }
            },
            model.text
        );
    }
}
