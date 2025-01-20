import { Action } from "sprotty-protocol";

export interface ConnectAction extends Action {
    kind: typeof ConnectAction.KIND;
    relation: string;
    start: string;
}

export namespace ConnectAction {
    export const KIND = "connect";

    export function is(action: Action): action is ConnectAction {
        return action.kind === KIND;
    }
}
