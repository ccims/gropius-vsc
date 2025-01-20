import { ContainerModule } from "inversify";
import { ConnectMouseListener } from "./connectMouseListener.js";
import { TYPES, configureActionHandler, configureCommand } from "sprotty";
import { ConnectAction } from "./connectAction.js";
import { UpdateRelationEndCommand } from "./updateRelationEndCommand.js";

export const connectModule = new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(ConnectMouseListener).toSelf().inSingletonScope();
    bind(TYPES.MouseListener).toService(ConnectMouseListener);
    configureActionHandler({ bind, isBound }, ConnectAction.KIND, ConnectMouseListener);
    configureCommand({ bind, isBound }, UpdateRelationEndCommand);
});
