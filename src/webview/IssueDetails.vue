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
            <div class="section-header">Type:</div>
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

        <!-- Labels Section -->
        <div class="info-section" v-if="issue.labels && issue.labels.nodes.length > 0">
          <div class="section-header-row">
            <div class="section-header">Labels:</div>
            <div class="section-content inline-content">
              <div v-for="(label, index) in issue.labels.nodes" :key="index" class="badge label-badge">
                {{ label.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Affects Section -->
        <div class="info-section" v-if="issue.affects && issue.affects.nodes.length > 0">
          <div class="section-header">Affected Entities</div>
          <div class="section-content">
            <!-- Group items by type with inline layout -->
            <div v-for="(group, groupType) in groupedAffectedEntities" :key="groupType" class="affected-group">
              <div class="affected-group-inline">
                <div class="affected-group-header">{{ groupType }}:</div>
                <div class="affected-items-inline">
                  <div v-for="(entity, index) in group" :key="index" class="badge entity-badge"
                    :class="getEntityClass(entity)">
                    {{ getEntityName(entity) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Priority Section -->
        <div class="info-section" v-if="issue.priority">
          <div class="section-header-row">
            <div class="section-header">Priority:</div>
            <div class="section-content inline-content">
              <div class="badge priority-badge">
                <img class="priority-icon" :src="getPriorityIconPath()" alt="" />
                {{ issue.priority.name }}
              </div>
            </div>
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
    },
    groupedAffectedEntities() {
      if (!this.issue || !this.issue.affects || !this.issue.affects.nodes) {
        return {};
      }

      // Group affected entities by their type
      const grouped = {
        'Components': [],
        'Component Versions': [],
        'Interfaces': [],
        'Interface Parts': [],
        'Projects': []
      };

      for (const entity of this.issue.affects.nodes) {
        if (entity.__typename === 'Component') {
          grouped['Components'].push(entity);
        } else if (entity.__typename === 'ComponentVersion') {
          grouped['Component Versions'].push(entity);
        } else if (entity.__typename === 'Interface') {
          grouped['Interfaces'].push(entity);
        } else if (entity.__typename === 'InterfacePart') {
          grouped['Interface Parts'].push(entity);
        } else if (entity.__typename === 'Project') {
          grouped['Projects'].push(entity);
        }
      }

      // Remove empty groups
      return Object.fromEntries(
        Object.entries(grouped).filter(([_, items]) => items.length > 0)
      );
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
      switch (entity.__typename) {
        case 'Component':
          return 'component-badge';
        case 'ComponentVersion':
          return 'component-version-badge';
        case 'Project':
          return 'project-badge';
        case 'Interface':
          return 'interface-badge';
        case 'InterfacePart':
          return 'interface-part-badge';
        default:
          return 'generic-entity-badge';
      }
    },

    getEntityName(entity) {
      switch (entity.__typename) {
        case 'Component':
          return entity.name;
        case 'ComponentVersion':
          return `${entity.component.name}: version ${entity.version}`;
        case 'Project':
          return entity.name;
        case 'Interface':
          return `Interface ${entity.id.substring(0, 8)}`;
        case 'InterfacePart':
          return entity.name;
        default:
          return `${entity.__typename || 'Unknown'}: ${entity.id}`;
      }
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
    },
    getPriorityIconPath() {
      return new URL("../../resources/icons/priority-icon-white.png", import.meta.url).href;
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
