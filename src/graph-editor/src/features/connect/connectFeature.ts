import { SModelElementImpl } from "sprotty";

export const connectFeature = Symbol("connectFeature");

export function isConnectable(element: SModelElementImpl): element is SModelElementImpl {
    return element.hasFeature(connectFeature);
}
