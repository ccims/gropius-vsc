import { ShapeStyle } from "../gropiusModel.js";
import { Selectable } from "./selectable.js";

export interface IssueAffected extends Selectable {
    style: ShapeStyle;
    x: number;
    y: number;
}
