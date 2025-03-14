<template>
  <div id="app" class="issue-details">
    <div v-if="issue" class="issue-container">
      <!-- Title Section -->
      <div class="issue-header">
        <h2 class="issue-title">{{ issue.title }}</h2>
        <div class="issue-id">ID: {{ issue.id }}</div>
      </div>

      <!-- Main Content Sections -->
      <div class="issue-sections">

        <!-- Type Section -->
        <div class="info-section">
          <div class="section-header-row">
            <div class="section-header">Type</div>
            <div class="section-content inline-content">
              <div class="badge type-badge" v-if="issue.type" :class="'type-' + issue.type.name.toLowerCase()">
                <img class="type-icon" :src="getTypeIconPath(issue.type.name)" alt="" />
                {{ issue.type.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- State Section -->
        <div class="info-section">
          <div class="section-header-row">
            <div class="section-header">State:</div>
            <div class="section-content inline-content">
              <div class="badge state-badge"
                :class="{ 'state-open': issue.state && issue.state.isOpen, 'state-completed': issue.state && !issue.state.isOpen && issue.state.name === 'Completed', 'state-not-planned': issue.state && !issue.state.isOpen && issue.state.name === 'Not Planned' }">
                {{ issue.state ? issue.state.name : 'Unknown' }}
              </div>
            </div>
          </div>
        </div>
        <!-- Affects Section -->
        <div class="info-section" v-if="issue.affects && issue.affects.nodes.length > 0">
          <div class="section-header">Components & Projects</div>
          <div class="section-content">
            <div v-for="(entity, index) in issue.affects.nodes" :key="index" class="badge entity-badge"
              :class="getEntityClass(entity)">
              {{ getEntityName(entity) }}
            </div>
          </div>
        </div>

        <!-- Priority Section -->
        <div class="info-section" v-if="issue.priority">
          <div class="section-header">Priority</div>
          <div class="section-content">
            <div class="badge priority-badge">{{ issue.priority.name }}</div>
          </div>
        </div>

        <!-- Creation/Update Info -->
        <div class="info-section dates-section">
          <div class="section-header">Dates</div>
          <div class="section-content">
            <div class="date-row">
              <div class="date-label">Created:</div>
              <div class="date-value">{{ formatDate(issue.createdAt) }}</div>
            </div>
            <div class="date-row" v-if="issue.lastUpdatedAt">
              <div class="date-label">Updated:</div>
              <div class="date-value">{{ formatDate(issue.lastUpdatedAt) }}</div>
            </div>
            <div class="date-row" v-if="issue.body && issue.body.lastModifiedAt">
              <div class="date-label">Description modified:</div>
              <div class="date-value">{{ formatDate(issue.body.lastModifiedAt) }}</div>
            </div>
          </div>
        </div>

        <!-- Description Section -->
        <div class="info-section" v-if="issue.body">
          <div class="section-header">Description</div>
          <div class="section-content description-content">
            <div class="description-text">{{ issue.body.body || 'No description provided.' }}</div>
          </div>
        </div>

        <!-- Related Issues Section -->
        <div class="info-section" v-if="hasRelations">
          <div class="section-header">Related Issues</div>
          <div class="section-content">
            <!-- Incoming Relations -->
            <div v-if="hasIncomingRelations" class="relations-group">
              <div class="relations-subheader">Issues that affect this issue:</div>
              <div class="relations-list">
                <div v-for="(relation, index) in issue.incomingRelations.nodes" :key="'in-' + index"
                  class="relation-item" @click="openRelatedIssue(relation.issue.id)">
                  {{ relation.issue.title }}
                </div>
              </div>
            </div>

            <!-- Outgoing Relations -->
            <div v-if="hasOutgoingRelations" class="relations-group">
              <div class="relations-subheader">Issues affected by this issue:</div>
              <div class="relations-list">
                <div v-for="(relation, index) in issue.outgoingRelations.nodes" :key="'out-' + index"
                  class="relation-item" @click="openRelatedIssue(relation.issue.id)">
                  {{ relation.issue.title }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional Metadata Section -->
        <div class="info-section" v-if="issue.estimatedTime !== undefined || issue.hasPermission !== undefined">
          <div class="section-header">Additional Info</div>
          <div class="section-content">
            <div class="meta-row" v-if="issue.estimatedTime !== undefined">
              <div class="meta-label">Estimated Time:</div>
              <div class="meta-value">{{ issue.estimatedTime || 'Not estimated' }}</div>
            </div>
            <div class="meta-row" v-if="issue.hasPermission !== undefined">
              <div class="meta-label">Has READ Permission:</div>
              <div class="meta-value permission-value" :class="{ 'has-permission': issue.hasPermission }">
                {{ issue.hasPermission ? 'Yes' : 'No' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ error }}</p>
    </div>
    <div v-else class="empty-state">
      <p>No issue selected. Please select an issue to view its details.</p>
    </div>
  </div>
</template>

<script>
let vscode;

export default {
  name: "IssueDetails",
  data() {
    return {
      issue: null,
      error: null
    };
  },
  computed: {
    hasIncomingRelations() {
      return this.issue &&
        this.issue.incomingRelations &&
        this.issue.incomingRelations.nodes &&
        this.issue.incomingRelations.nodes.length > 0;
    },
    hasOutgoingRelations() {
      return this.issue &&
        this.issue.outgoingRelations &&
        this.issue.outgoingRelations.nodes &&
        this.issue.outgoingRelations.nodes.length > 0;
    },
    hasRelations() {
      return this.hasIncomingRelations || this.hasOutgoingRelations;
    }
  },
  methods: {
    formatDate(dateString) {
      if (!dateString) return 'Unknown';

      try {
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        console.error("Error formatting date:", e);
        return dateString;
      }
    },
    openRelatedIssue(issueId) {
      if (vscode) {
        vscode.postMessage({
          command: 'openRelatedIssue',
          issueId: issueId
        });
      }
    },
    getEntityClass(entity) {
      if (entity.__typename === 'Component') {
        return 'component-badge';
      } else if (entity.__typename === 'ComponentVersion') {
        return 'component-version-badge';
      } else if (entity.__typename === 'Project') {
        return 'project-badge';
      } else if (entity.__typename === 'Interface') {
        return 'interface-badge';
      } else if (entity.__typename === 'InterfacePart') {
        return 'interface-part-badge';
      }
      return '';
    },
    getEntityName(entity) {
      if (entity.__typename === 'Component') {
        return entity.name;
      } else if (entity.__typename === 'ComponentVersion') {
        return `${entity.component.name} ${entity.version}`;
      } else if (entity.__typename === 'Project') {
        return entity.name;
      } else if (entity.__typename === 'Interface') {
        return `Interface ${entity.id.substring(0, 8)}`;
      } else if (entity.__typename === 'InterfacePart') {
        return entity.name;
      }
      return `${entity.__typename || 'Unknown'}: ${entity.id}`;
    },

    getTypeIconPath(typeName) {
      const isOpen = this.issue.state && this.issue.state.isOpen;

      switch (typeName) {
        case "Bug":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/bug-green.png", import.meta.url).href
            : new URL("../../resources/icons/bug-red.png", import.meta.url).href;
        case "Feature":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href
            : new URL("../../resources/icons/lightbulb-feature-red.png", import.meta.url).href;
        case "Misc":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        case "Task":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        default:
          return new URL("../../resources/icons/bug-black.png", import.meta.url).href;
      }
    }
  },
  mounted() {
    console.log("[IssueDetails.vue] Mounted");
    if (typeof acquireVsCodeApi !== "undefined") {
      vscode = acquireVsCodeApi();
      console.log("[IssueDetails.vue] vscode API acquired");
    } else {
      console.error("[IssueDetails.vue] acquireVsCodeApi is undefined");
    }

    // Restore persisted state if available
    const state = vscode.getState();
    if (state) {
      if (state.issue) {
        this.issue = state.issue;
        console.log("[IssueDetails.vue] Restored persisted issue:", this.issue);
      }
      if (state.error) {
        this.error = state.error;
      }
    }

    window.addEventListener("message", (event) => {
      console.log("[IssueDetails.vue] Received message event:", event);
      const message = event.data;
      console.log("[IssueDetails.vue] Message data:", message);

      if (message && message.command === "displayIssue") {
        console.log("[IssueDetails.vue] Processing displayIssue message");
        this.issue = message.issue;
        this.error = message.error || null;

        vscode.setState({
          issue: this.issue,
          error: this.error
        });

        if (this.issue) {
          console.log("[IssueDetails.vue] Issue updated:", this.issue);
        } else if (this.error) {
          console.warn("[IssueDetails.vue] Received error:", this.error);
        } else {
          console.warn("[IssueDetails.vue] Received null issue with no error");
        }
      }
    });

    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
      console.log("[IssueDetails.vue] Posted vueAppReady message");
    }
  }
};

</script>

<style>
.issue-details {
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: 1.5;
  padding: 0;
  margin: 0;
  height: 100%;
}

.issue-container {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 8px;
}

/* Header */
.issue-header {
  padding-bottom: 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.issue-title {
  margin: 0 0 8px 0;
  font-size: 1.3em;
  font-weight: 600;
}

.issue-id {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.85em;
  opacity: 0.8;
  color: var(--vscode-descriptionForeground);
}

/* Sections */
.issue-sections {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-section {
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-editor-lineHighlightBorder, rgba(255, 255, 255, 0.1));
  padding: 12px 0;
}

.section-header {
  font-weight: 600;
  font-size: 0.95em;
  color: var(--vscode-foreground);
  margin-bottom: 8px;
}

.section-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Badge styling */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.9em;
  background-color: rgba(0, 0, 0, 0.2);
  color: #2ea043;
  gap: 6px;
  color: white;
}

.type-icon {
  width: 16px;
  height: 16px;
  opacity: 0.9;
}

.state-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: normal;
  background-color: rgba(0, 0, 0, 0.2);
  /* Slightly transparent dark background */
}

.state-open {
  color: #2ea043;
  /* Green text for open */
}

.state-completed,
.state-not-planned {
  color: #f85149;
  /* Red text for completed/not planned */
}

.component-badge,
.component-version-badge {
  background-color: var(--vscode-debugTokenExpression-value, #4e94ce);
  color: var(--vscode-foreground);
}

.project-badge {
  background-color: var(--vscode-debugTokenExpression-name, #c586c0);
  color: var(--vscode-foreground);
}

.priority-badge {
  background-color: var(--vscode-debugTokenExpression-string, #ce9178);
  color: var(--vscode-foreground);
}

.interface-badge,
.interface-part-badge {
  background-color: var(--vscode-debugTokenExpression-boolean, #4e94ce);
  color: var(--vscode-foreground);
}

.entity-badge {
  display: inline-flex;
}

/* Date section */
.dates-section .section-content {
  flex-direction: column;
  gap: 4px;
}

.date-row {
  display: flex;
  font-size: 0.9em;
}

.date-label {
  min-width: 120px;
  font-weight: 500;
}

/* Description */
.description-content {
  display: block;
}

.description-text {
  white-space: pre-wrap;
  padding: 4px 0;
}

/* Relations */
.relations-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 8px;
}

.relations-group:first-child {
  margin-top: 0;
}

.relations-subheader {
  font-size: 0.9em;
  font-weight: 500;
  margin-bottom: 8px;
}

.relations-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.relation-item {
  padding: 8px 10px;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.relation-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

/* Meta information */
.meta-row {
  display: flex;
  font-size: 0.9em;
}

.meta-label {
  min-width: 150px;
  font-weight: 500;
}

.permission-value.has-permission {
  color: var(--vscode-debugIcon-startForeground, #89d185);
}

/* Empty and error states */
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}

.error-icon {
  font-size: 2em;
  margin-bottom: 16px;
}

.error-message {
  max-width: 300px;
}

.section-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-header {
  font-weight: bold;
  color: white;
}

.inline-content {
  margin-bottom: 0;
}
</style>