<template>
    <IssueTypeIcon :path="issue.type.iconPath" :fill="iconFill">
    </IssueTypeIcon>
</template>
<script setup lang="ts">
import { computed, PropType } from "vue";
import IssueTypeIcon from "./IssueTypeIcon.vue";

console.log("Start issueIcon!");
type DefaultIssueIconInfoFragment = {
    __typename?: "Issue";
    state: { __typename?: "IssueState"; isOpen: boolean };
    type: { __typename?: "IssueType"; iconPath: string };
};
const props = defineProps({
    issue: {
        type: Object as PropType<DefaultIssueIconInfoFragment>,
        required: true
    }
});

const commonColors = {
    "issue-open": "#00BA39",
    "issue-closed": "#FF0036",
}

const iconFill = computed(() => {
    if (props.issue.state.isOpen) {
        return commonColors["issue-open"];
    } else {
        return commonColors["issue-closed"];
    }
});

console.log(" Issue Objekt:  " + JSON.stringify(props.issue));
</script>