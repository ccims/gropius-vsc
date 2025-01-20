import { Chip } from "../model/chip.js";
import { SHtmlElement } from "./sHtmlElement.js";

export class SChip extends SHtmlElement implements Chip {
    declare type: typeof Chip.TYPE;
    text!: string;
}
