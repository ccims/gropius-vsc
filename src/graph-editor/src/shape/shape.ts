import { Bounds } from "sprotty-protocol";
import { Line } from "../line/model/line.js";
import { Shape as GropiusShape } from "../gropiusModel.js";

export interface Shape {
    bounds: Bounds;
    shape: GropiusShape;
    outline: Line;
}
