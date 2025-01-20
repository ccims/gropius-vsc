export enum SegmentLayout {
    VERTICAL_HORIZONTAL = "VERTICAL_HORIZONTAL",
    HORIZONTAL_VERTICAL = "HORIZONTAL_VERTICAL"
}

export namespace SegmentLayout {
    export function invert(layout: SegmentLayout): SegmentLayout {
        switch (layout) {
            case SegmentLayout.VERTICAL_HORIZONTAL:
                return SegmentLayout.HORIZONTAL_VERTICAL;
            case SegmentLayout.HORIZONTAL_VERTICAL:
                return SegmentLayout.VERTICAL_HORIZONTAL;
        }
    }
}
