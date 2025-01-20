import { BoundsAware } from "sprotty-protocol";
import { Label } from "../model/label.js";
import { SHtmlElement } from "./sHtmlElement.js";

export class SLabel extends SHtmlElement implements Label, BoundsAware {
    declare type: typeof Label.TYPE;
    text!: string;
    withBackground!: boolean;
}
