import { injectable } from "inversify";
import {
    Animation,
    CommandExecutionContext,
    CommandReturn,
    CompoundAnimation,
    forEachMatch,
    isSelectable,
    MatchResult,
    SModelElementImpl,
    SModelRootImpl,
    UpdateModelCommand as BaseUpdateModelCommand,
    ViewportRootElementImpl
} from "sprotty";
import {
    ElmentLinearInterpolationAnimation,
    LinearInterpolationAnimation
} from "../animation/linearInterpolationAnimation.js";
import { computeCommonAnimatableFields, isLinearAnimatable } from "../animation/model.js";
import { SRoot } from "../../smodel/sRoot.js";

/**
 * Custom UpdateModelCommand which handles linear interpolation animations
 */
@injectable()
export class UpdateModelCommand extends BaseUpdateModelCommand {
    protected override computeAnimation(
        newRoot: SRoot,
        matchResult: MatchResult,
        context: CommandExecutionContext
    ): SModelRootImpl | Animation {
        const remainingMatchResult: MatchResult = {};
        const elementAnimations: ElmentLinearInterpolationAnimation[] = [];
        forEachMatch(matchResult, (id, match) => {
            if (match.left !== undefined && match.right !== undefined) {
                const animation = this._updateElement(
                    match.left as SModelElementImpl,
                    match.right as SModelElementImpl
                );
                if (animation !== undefined) {
                    elementAnimations.push(animation);
                }
            } else {
                remainingMatchResult[id] = match;
            }
        });
        const animations: Animation[] = [];
        if (elementAnimations.length > 0 && (newRoot.animated ?? true)) {
            animations.push(new LinearInterpolationAnimation(newRoot, elementAnimations, context));
        }
        const fadeAnimation = super.computeAnimation(newRoot, remainingMatchResult, context);
        if (fadeAnimation instanceof Animation) {
            animations.push(fadeAnimation);
        }
        if (animations.length > 1) {
            return new CompoundAnimation(newRoot, context, animations);
        } else if (animations.length === 1) {
            return animations[0];
        } else {
            return newRoot;
        }
    }

    /**
     * Updates an element, computes linear interpolation animations if possible
     *
     * @param left the old element
     * @param right the new element
     * @returns an ElementLinearInterpolationAnimation or undefined
     */
    private _updateElement(
        left: SModelElementImpl,
        right: SModelElementImpl
    ): ElmentLinearInterpolationAnimation | undefined {
        if (isSelectable(left) && isSelectable(right)) {
            right.selected = left.selected;
        }
        if (left instanceof SRoot && right instanceof SRoot) {
            right.canvasBounds = left.canvasBounds;
            right.scroll = left.scroll;
            right.zoom = left.zoom;
            right.updateToTargetBounds();
        }
        if (isLinearAnimatable(left) && isLinearAnimatable(right)) {
            const commonFields = computeCommonAnimatableFields(left, right);
            if (commonFields.length > 0) {
                const interpolations = new Map<string, [number, number]>();
                for (const field of commonFields) {
                    const leftValue = (left as any)[field] as number;
                    const rightValue = (right as any)[field] as number;
                    if (leftValue != rightValue) {
                        interpolations.set(field, [leftValue, rightValue]);
                    }
                }
                return {
                    element: right,
                    interpolations
                };
            }
        }
        return undefined;
    }

    protected override updateElement(left: SModelElementImpl, right: SModelElementImpl, animationData: any): void {
        super.updateElement(left, right, animationData);
    }

    protected override performUpdate(
        oldRoot: SModelRootImpl,
        newRoot: SModelRootImpl,
        context: CommandExecutionContext
    ): CommandReturn {
        (newRoot as SRoot).changeRevision = (oldRoot as SRoot).changeRevision + 1;
        return super.performUpdate(oldRoot, newRoot, context);
    }
}
