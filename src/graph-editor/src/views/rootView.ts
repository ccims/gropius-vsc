import { injectable } from "inversify";
import { IView, IViewArgs, RenderingContext, svg } from "sprotty";
import { SRoot } from "../smodel/sRoot.js";
import { VNode } from "snabbdom";

@injectable()
export class RootView implements IView {
    render(model: Readonly<SRoot>, context: RenderingContext, _args?: IViewArgs | undefined): VNode {
        const transform = `scale(${model.zoom}) translate(${-model.scroll.x},${-model.scroll.y})`;
        return svg(
            "svg",
            {
                ns: "http://www.w3.org/2000/svg",
                style: {
                    "--diagram-zoom": `${model.zoom}`,
                    "--diagram-zoom-normalized": `${
                        model.zoom / Math.pow(2, Math.round(Math.log2(model.zoom) / 1.8) * 1.8)
                    }`,
                    "--diagram-scroll-x": `${model.scroll.x}px`,
                    "--diagram-scroll-y": `${model.scroll.y}px`
                }
            },
            svg("style", null, model.generateStyle()),
            svg(
                "g",
                {
                    attrs: {
                        transform
                    },
                    class: {
                        "sprotty-root": true
                    }
                },
                ...context.renderChildren(model, undefined)
            )
        );
    }
}
