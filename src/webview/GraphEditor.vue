<template>
  <div class="h-100 position-relative">
      <div :id="editorId" class="sprotty" />
      <Teleport
          v-if="selected?.contextMenu != undefined"
          :key="selected.id"
          :to="`#${selected.contextMenu.containerId}>.context-menu`"
      >
          <div class="context-menu ml-2" @mousedown.stop.prevent>
              <template
                  v-if="
                      selected.contextMenu.data.type == 'component' || selected.contextMenu.data.type == 'interface'
                  "
              >
                  <SmallFAB
                      class="d-block"
                      icon
                      color="primary-container"
                      :disabled="!selected.contextMenu.data.createRelation"
                      @mousedown="() => modelSource!.startRelation(selected!.id)"
                  >
                      <v-icon icon="mdi-arrow-top-right" />
                      <v-tooltip activator="parent">Create relation</v-tooltip>
                  </SmallFAB>
              </template>
              <template v-if="selected.contextMenu.data.type == 'component'">
                  <SmallFAB
                      class="d-block mt-2"
                      icon
                      color="primary-container"
                      @mouseup="$emit('addInterface', selected.id)"
                  >
                      <v-icon icon="$interface" />
                      <v-tooltip activator="parent">Add interface</v-tooltip>
                  </SmallFAB>
                  <SmallFAB
                      class="d-block mt-2"
                      icon
                      color="primary-container"
                      :disabled="!selected.contextMenu.data.remove"
                      @mouseup="$emit('removeComponent', selected!.id)"
                  >
                      <v-icon icon="mdi-close" />
                      <v-tooltip activator="parent">Remove component version from project</v-tooltip>
                  </SmallFAB>
              </template>
              <template v-if="selected.contextMenu.data.type == 'relation'">
                  <SmallFAB
                      class="d-block"
                      icon
                      color="primary-container"
                      :disabled="!selected.contextMenu.data.delete"
                      @mouseup="$emit('deleteRelation', selected!.id)"
                  >
                      <v-icon icon="mdi-close" />
                      <v-tooltip activator="parent">Delete relation</v-tooltip>
                  </SmallFAB>
              </template>
          </div>
      </Teleport>
      <div class="position-absolute top-0 right-0 h-100 w-100 pa-3 pointer-events-none">
          <slot />
      </div>
  </div>
</template>
<script setup lang="ts">
import "reflect-metadata";
import {
  Graph,
  GraphLayout,
  GraphModelSource,
  SelectedElement,
  createContainer,
  CreateRelationContext
} from "@gropius/graph-editor";
import { TYPES } from "sprotty";
import { PropType, onMounted, shallowRef, watch, ref, computed } from "vue";
import { v4 as uuidv4 } from "uuid";

export type ContextMenuData =
  | {
        type: "component";
        remove: boolean;
        createRelation: boolean;
    }
  | {
        type: "interface";
        createRelation: boolean;
    }
  | {
        type: "relation";
        delete: boolean;
    };

const props = defineProps({
  graph: {
      type: Object as PropType<Graph>,
      required: true
  },
  layout: {
      type: Object as PropType<GraphLayout>,
      required: true
  }
});

const localLayout = ref<GraphLayout>(props.layout);

const emit = defineEmits<{
  (event: "update:layout", value: GraphLayout): void;
  (event: "update:selected", value: SelectedElement<ContextMenuData> | undefined): void;
  (event: "removeComponent", value: string): void;
  (event: "createRelation", value: CreateRelationContext): void;
  (event: "deleteRelation", value: string): void;
  (event: "addInterface", value: string): void;
  (event: "navigateTo", value: string): void;
}>();

class ModelSource extends GraphModelSource {
  protected override handleCreateRelation(context: CreateRelationContext): void {
      emit("createRelation", context);
  }

  protected override layoutUpdated(partialUpdate: GraphLayout, resultingLayout: GraphLayout): void {
      localLayout.value = resultingLayout;
      emit("update:layout", resultingLayout);
  }

  protected override handleSelectionChanged(selectedElements: SelectedElement<any>[]): void {
      selecteds.value = selectedElements;
  }

  protected override navigateToElement(element: string): void {
      emit("navigateTo", element);
  }
}

const editorId = ref(`graph-editor-${uuidv4()}`);
const modelSource = shallowRef<ModelSource | undefined>();
const selecteds = ref<SelectedElement<ContextMenuData>[]>([]);
const selected = computed(() => {
  if (selecteds.value.length == 1) {
      return selecteds.value[0];
  } else {
      return undefined;
  }
});

watch(selected, () => {
  emit("update:selected", selected.value);
});

onMounted(async () => {
  const container = createContainer(editorId.value);
  container.bind(ModelSource).toSelf().inSingletonScope();
  container.bind(TYPES.ModelSource).toService(ModelSource);
  modelSource.value = container.get(ModelSource);
  modelSource.value!.updateGraph({ graph: props.graph, layout: props.layout, fitToBounds: false });
  modelSource.value!.updateGraph({ graph: props.graph, layout: props.layout, fitToBounds: true });
});

watch(
  () => props.graph,
  () => {
      modelSource.value!.updateGraph({ graph: props.graph, fitToBounds: false });
  }
);
watch(
  () => props.layout,
  () => {
      if (props.layout != localLayout.value) {
          modelSource.value!.updateGraph({ layout: props.layout, fitToBounds: true });
      }
  }
);
</script>
<style scoped>
.context-menu {
  pointer-events: all;
}

.pointer-events-none {
  pointer-events: none;
}

/* Sprotty */
:deep(.sprotty) {
  display: flex;
  height: 100%;
}

:deep(.sprotty-hidden) {
  height: 0px !important;
}

:deep(.sprotty svg) {
  width: 100%;
  flex: 1;
  border-style: none;
  border-width: 0px;
  outline: none;
  --diagram-grid: rgba(var(--v-theme-on-surface), 0.35);
  --background-overlay-color: rgba(var(--v-theme-surface), 0.6);
  --shape-stroke-color: rgb(var(--v-theme-on-surface));
  --version-chip-background: rgb(var(--v-theme-primary-container));
  --version-chip-color: rgb(var(--v-theme-on-primary-container));
  --selected-shape-stroke-color: rgb(var(--v-theme-primary));
  --selected-shape-fill-color: rgba(var(--v-theme-primary), 0.4);
  --issue-closed-color: rgb(var(--v-theme-issue-closed));
  --issue-open-color: rgb(var(--v-theme-issue-open));
  --issue-relation-stroke-color: rgba(var(--v-theme-on-surface), 0.4);
  --highlight-stroke-color: rgb(var(--v-theme-primary));
  --highlight-fill-color: rgba(var(--v-theme-primary), 0.4);
}
</style>