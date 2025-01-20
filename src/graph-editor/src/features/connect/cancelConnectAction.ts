import { Action } from "sprotty-protocol";

export interface CancelConnectAction extends Action {
    kind: typeof CancelConnectAction.KIND;
    relation: string;
}

export namespace CancelConnectAction {
    export const KIND = "cancelConnect";
}
