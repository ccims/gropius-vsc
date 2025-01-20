import { Action } from "sprotty-protocol";

/**
 * Action to navigate to an element
 */
export interface NavigationAction extends Action {
    kind: typeof NavigationAction.KIND;
    /**
     * The id of the element to navigate to
     */
    element: string;
}

export namespace NavigationAction {
    /**
     * Kind of NavigationActions
     */
    export const KIND = "navigationAction";

    /**
     * Checks if the action is a NavigationAction
     *
     * @param action the action to check
     * @returns true if it is a NavigationAction
     */
    export function is(action: Action): action is NavigationAction {
        return action.kind === KIND;
    }
}
