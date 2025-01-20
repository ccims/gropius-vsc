import { inject, injectable } from "inversify";
import { Command, CommandExecutionContext, CommandReturn, SystemCommand, TYPES } from "sprotty";
import { HoverHighlightAction } from "./hoverHighlightAction.js";
import { IssueRelationHighlightable } from "./IssueRelationHighlightable.js";

@injectable()
export class HoverHighlightCommand extends SystemCommand {
    static readonly KIND = HoverHighlightAction.KIND;

    constructor(@inject(TYPES.Action) protected readonly action: HoverHighlightAction) {
        super();
    }

    override execute(context: CommandExecutionContext): CommandReturn {
        const root = context.root;
        const index = root.index;
        for (const unaffected of this.action.unaffected) {
            const element = index.getById(unaffected) as unknown as IssueRelationHighlightable | undefined;
            if (element !== undefined) {
                element.highlighted = false;
            }
        }
        for (const affected of this.action.affected) {
            const element = index.getById(affected) as unknown as IssueRelationHighlightable | undefined;
            if (element !== undefined) {
                element.highlighted = true;
            }
        }
        return root;
    }

    override undo(context: CommandExecutionContext): CommandReturn {
        return context.root;
    }

    override redo(context: CommandExecutionContext): CommandReturn {
        return context.root;
    }
}
