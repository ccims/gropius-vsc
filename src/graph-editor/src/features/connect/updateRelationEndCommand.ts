import { injectable, inject } from "inversify";
import { CommandExecutionContext, CommandReturn, SChildElementImpl, SystemCommand, TYPES } from "sprotty";
import { UpdateRelationEndAction } from "./updateRelationEndAction.js";
import { SRelation } from "../../smodel/sRelation.js";
import { SRoot } from "../../smodel/sRoot.js";

@injectable()
export class UpdateRelationEndCommand extends SystemCommand {
    static readonly KIND = UpdateRelationEndAction.KIND;

    constructor(@inject(TYPES.Action) protected readonly action: UpdateRelationEndAction) {
        super();
    }

    override execute(context: CommandExecutionContext): CommandReturn {
        const root = context.root as SRoot;
        const relation = root.index.getById(this.action.relation);
        if (relation !== undefined) {
            (relation as SRelation).end = this.action.end;
        }
        root.changeRevision++;
        return root;
    }

    override undo(context: CommandExecutionContext): CommandReturn {
        return context.root;
    }

    override redo(context: CommandExecutionContext): CommandReturn {
        return context.root;
    }
}
