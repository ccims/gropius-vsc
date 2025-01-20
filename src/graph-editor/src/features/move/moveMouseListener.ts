import {
    MouseListener,
    SModelElementImpl,
    SModelRootImpl,
    findParentByFeature,
    isSelectable,
    isViewport,
    moveFeature
} from "sprotty";
import { Action, Point } from "sprotty-protocol";
import { MoveHandler } from "./moveHandler.js";
import { Component } from "../../model/component.js";
import { Interface } from "../../model/interface.js";
import { SComponent } from "../../smodel/sComponent.js";
import { SInterface } from "../../smodel/sInterface.js";
import { ElementMoveHandler } from "./elementMoveHandler.js";
import { SRoot } from "../../smodel/sRoot.js";
import { SContextMenu } from "../../smodel/sContextMenu.js";
import { roundToPrecision } from "../../base/roundToPrecision.js";
import { SRelation } from "../../smodel/sRelation.js";
import { RelationMoveHandler } from "./relationMoveHandler.js";
import { SIssueAffected } from "../../smodel/sIssueAffected.js";
import { Relation } from "../../model/relation.js";

export class MoveMouseListener extends MouseListener {
    private startPosition?: Point;
    private moveHandler?: MoveHandler;
    private targetElement?: HTMLElement;
    private changeRevision = -1;

    override mouseDown(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (event.button === 0) {
            const moveableTarget = findParentByFeature(target, isMovable);
            if (moveableTarget != undefined && !(target instanceof SContextMenu)) {
                this.startPosition = { x: event.pageX, y: event.pageY };
                this.targetElement = event.target as HTMLElement | undefined;
            } else {
                this.startPosition = undefined;
                this.targetElement = undefined;
            }
        }
        return [];
    }

    override mouseMove(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (this.startPosition) {
            if (this.moveHandler === undefined) {
                this.moveHandler = this.createHandler(target, this.targetElement);
            }
            const root = target.root as SRoot;
            if (this.moveHandler != undefined && root.changeRevision != this.changeRevision) {
                const translation = this.calculateTranslation(target, event);
                const result = this.moveHandler.generateAction(translation.x, translation.y, false, event);
                this.changeRevision = root.changeRevision;
                return [result];
            }
        }
        return [];
    }

    override mouseUp(target: SModelElementImpl, event: MouseEvent): Action[] {
        return this.commitMove(target, event);
    }

    override mouseEnter(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (event.buttons === 0) {
            return this.commitMove(target, event);
        } else {
            return [];
        }
    }

    private commitMove(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (this.moveHandler === undefined || this.moveHandler === null) {
            this.startPosition = undefined;
            this.moveHandler = undefined;
            return [];
        }
        const translation = this.calculateTranslation(target, event);
        const result = this.moveHandler.generateAction(translation.x, translation.y, true, event);
        this.moveHandler = undefined;
        this.startPosition = undefined;
        return [result];
    }

    private createHandler(target: SModelElementImpl, targetElement?: HTMLElement): MoveHandler | undefined {
        if (target instanceof SRelation) {
            const index = targetElement?.dataset?.index;
            const path = target.path;
            const elementIndex = target.root.index;
            if (index != undefined && path != undefined && typeof target.end === "string") {
                return new RelationMoveHandler(
                    target.id,
                    path,
                    parseInt(index),
                    (elementIndex.getById(target.start) as SIssueAffected).shape.outline,
                    (elementIndex.getById(target.end) as SIssueAffected).shape.outline
                );
            } else {
                return undefined;
            }
        }
        return this.createMoveHandler(target);
    }

    private createMoveHandler(target: SModelElementImpl): ElementMoveHandler | undefined {
        const selected = this.getSelectedElements(target.root).filter((element) => {
            return element.type === Component.TYPE || element.type === Interface.TYPE;
        }) as (SComponent | SInterface)[];
        if (selected.length === 0) {
            return undefined;
        }
        const selectedIds = new Set(selected.map((element) => element.id));
        const toMove = selected.filter((element) => {
            if (element.type === Interface.TYPE) {
                return !selectedIds.has(element.parent.id);
            } else {
                return true;
            }
        });
        const allMovedIds = new Set(
            toMove.flatMap((element) => {
                if (element instanceof SComponent) {
                    return [
                        element.id,
                        ...element.children.filter((child) => child instanceof SInterface).map((child) => child.id)
                    ];
                } else {
                    return [element.id];
                }
            })
        );
        const fullyMovedRelations = [
            ...target.root.index.all().filter((element) => {
                return (
                    element instanceof SRelation &&
                    allMovedIds.has(element.start) &&
                    typeof element.end == "string" &&
                    allMovedIds.has(element.end)
                );
            })
        ] as SRelation[];
        const startMovedRelations = Object.fromEntries(
            target.root.index
                .all()
                .filter((element) => {
                    return (
                        element instanceof SRelation &&
                        allMovedIds.has(element.start) &&
                        typeof element.end == "string" &&
                        !allMovedIds.has(element.end)
                    );
                })
                .map((element) => {
                    const relation = element as SRelation;
                    return [
                        element.id,
                        {
                            elementLine: (target.root.index.getById(relation.start) as SIssueAffected).shape.outline,
                            path: relation.path!
                        }
                    ];
                })
        );
        const endMovedRelations = Object.fromEntries(
            target.root.index
                .all()
                .filter((element) => {
                    return (
                        element instanceof SRelation &&
                        !allMovedIds.has(element.start) &&
                        typeof element.end == "string" &&
                        allMovedIds.has(element.end)
                    );
                })
                .map((element) => {
                    const relation = element as SRelation;
                    return [
                        element.id,
                        {
                            elementLine: (target.root.index.getById(relation.end as string) as SIssueAffected).shape
                                .outline,
                            path: relation.path!
                        }
                    ];
                })
        );
        return new ElementMoveHandler(toMove, fullyMovedRelations, startMovedRelations, endMovedRelations);
    }

    private calculateTranslation(target: SModelElementImpl, event: MouseEvent): Point {
        if (this.startPosition == undefined) {
            throw new Error("Cannot calculate translation without a start position");
        }
        const zoom = findViewportZoom(target);
        return {
            x: roundToPrecision((event.pageX - this.startPosition.x) / zoom),
            y: roundToPrecision((event.pageY - this.startPosition.y) / zoom)
        };
    }

    private getSelectedElements(root: SModelRootImpl): SModelElementImpl[] {
        return [...root.index.all().filter((child) => isSelectable(child) && child.selected)];
    }
}

function findViewportZoom(element: Readonly<SModelElementImpl>): number {
    const viewport = findParentByFeature(element, isViewport);
    return viewport ? viewport.zoom : 1;
}

function isMovable(element: SModelElementImpl): element is SModelElementImpl {
    return element.hasFeature(moveFeature);
}
