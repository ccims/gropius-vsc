import {
    configureModelElement,
    loadDefaultModules,
    overrideViewerOptions,
    selectFeature,
    updateModule as sprottyUpdateModule,
    moveModule as sprottyMoveModule,
    zorderModule as sprottyZOrderModule,
    moveFeature,
    decorationModule,
    undoRedoModule,
    boundsFeature,
    TYPES
} from "sprotty";
import { Container, ContainerModule } from "inversify";
import { Root } from "./model/root.js";
import { SRoot } from "./smodel/sRoot.js";
import { RootView } from "./views/rootView.js";
import { Component } from "./model/component.js";
import { SComponent } from "./smodel/sComponent.js";
import { ComponentView } from "./views/componentView.js";
import { Interface } from "./model/interface.js";
import { SInterface } from "./smodel/sInterface.js";
import { InterfaceView } from "./views/interfaceView.js";
import { Relation } from "./model/relation.js";
import { SRelation } from "./smodel/sRelation.js";
import { RelationView } from "./views/relationView.js";
import { Label } from "./model/label.js";
import { LabelView } from "./views/labelView.js";
import { zorderModule } from "./features/zorder/di.config.js";
import { updateModule } from "./features/update/di.config.js";
import { SLabel } from "./smodel/sLabel.js";
import { boundsModule } from "./features/bounds/di.config.js";
import { moveModule } from "./features/move/di.config.js";
import { CommandStack } from "./base/commandStack.js";
import { Chip } from "./model/chip.js";
import { SChip } from "./smodel/sChip.js";
import { ChipView } from "./views/chipView.js";
import { IssueType } from "./model/issueType.js";
import { SIssueType } from "./smodel/sIssueType.js";
import { IssueTypeView } from "./views/issueTypeView.js";
import { IssueRelation } from "./model/issueRelation.js";
import { SIssueRelation } from "./smodel/sIssueRelation.js";
import { IssueRelationView } from "./views/issueRelationView.js";
import { hoverHighlightModule } from "./features/issueRelationHighlight/di.config.js";
import { ContextMenu } from "./model/contextMenu.js";
import { SContextMenu } from "./smodel/sContextMenu.js";
import { ContextMenuView } from "./views/contextMenuView.js";
import { connectModule } from "./features/connect/di.config.js";
import { connectFeature } from "./features/connect/connectFeature.js";
import { issueHighlightableFeature } from "./features/issueRelationHighlight/issueHighlightableFeature.js";
import { navigationModule } from "./features/navigation/di.config.js";

const diagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = {
        bind: bind as any,
        isBound: isBound as any,
        rebind: rebind as any,
        unbind: unbind as any,
    };

    rebind(TYPES.ICommandStack).to(CommandStack).inSingletonScope();

    configureModelElement(context, Root.TYPE, SRoot, RootView);
    configureModelElement(context, Component.TYPE, SComponent, ComponentView, {
        enable: [selectFeature, moveFeature, connectFeature]
    });
    configureModelElement(context, Interface.TYPE, SInterface, InterfaceView, {
        enable: [selectFeature, moveFeature, connectFeature]
    });
    configureModelElement(context, IssueType.TYPE, SIssueType, IssueTypeView, {
        enable: [issueHighlightableFeature, selectFeature]
    });
    configureModelElement(context, Relation.TYPE, SRelation, RelationView, {
        enable: [selectFeature, moveFeature]
    });
    configureModelElement(context, IssueRelation.TYPE, SIssueRelation, IssueRelationView, {
        enable: [issueHighlightableFeature]
    });
    configureModelElement(context, Label.TYPE, SLabel, LabelView, {
        enable: [boundsFeature]
    });
    configureModelElement(context, Chip.TYPE, SChip, ChipView, {
        enable: [boundsFeature]
    });
    configureModelElement(context, ContextMenu.TYPE, SContextMenu, ContextMenuView);
});

/**
 * Creates the module for the diagram ui
 *
 * @param widgetId the id of the div to use
 * @returns the container
 */
export function createContainer(widgetId: string): Container {
    const container = new Container() as any;
    loadDefaultModules(container, {
        exclude: [sprottyUpdateModule, sprottyMoveModule, sprottyZOrderModule, decorationModule, undoRedoModule]
    });

    container.load(
        zorderModule,
        updateModule,
        boundsModule,
        moveModule,
        hoverHighlightModule,
        connectModule,
        navigationModule
    );

    container.load(diagramModule);

    overrideViewerOptions(container, {
        needsClientLayout: true,
        needsServerLayout: false,
        baseDiv: widgetId
    });
    return container;
}
