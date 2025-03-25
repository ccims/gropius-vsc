<template>
  <div id="app" class="issue-details">
    <div v-if="issue" class="issue-container">
      <!-- Title Section -->
      <div class="issue-header">
        <div class="icon-stack">
          <img class="base-icon" :src="getTypeIconPath()" alt="" />
          <img class="overlay-icon" :src="getRelationalIconPath()" alt="" />
        </div>
        <h2 class="issue-title">{{ issue.title }}</h2>
      </div>

      <!-- "Open in Browser" Button -->
      <button class="open-in-browser-button" @click="openInBrowser">
        Open in Browser
      </button>

      <!-- Main Content Sections -->
      <div class="issue-sections">

        <!-- Type and State Section -->
        <div class="info-section horizontal-section">
          <div class="section-group">
            <div class="section-header-row">
              <div class="section-header">Type:</div>
              <div class="section-content inline-content">
                <div class="badge type-badge" v-if="issue.type">
                  <img class="type-icon" :src="getTypeIconPath()" alt="" />
                  {{ issue.type.name }}
                </div>
              </div>
            </div>
          </div>
          <div class="section-group">
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

        <!-- Labels Section -->
        <div class="info-section" v-if="issue.labels && issue.labels.nodes.length > 0">
          <div class="section-header-row">
            <div class="section-header">Labels:</div>
            <div class="section-content inline-content">
              <div v-for="(label, index) in issue.labels.nodes" :key="index" class="badge label-badge" :style="{
                backgroundColor: label.color || 'rgba(0, 0, 0, 0.2)',
                color: '#ffffff'
              }" :title="label.description">
                {{ label.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Affected Entities Section -->
        <div class="info-section" v-if="issue.affects && issue.affects.nodes.length > 0">
          <div class="section-header" @click="toggleSection('affectedEntities')"
            style="cursor: pointer; display: flex; justify-content: space-between;">
            <span>Affected Entities</span>
            <span class="toggle-icon">{{ expandedSections.affectedEntities ? '▼' : '▶' }}</span>
          </div>
          <div class="section-content" v-if="expandedSections.affectedEntities">
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

        <!-- Description Section -->
        <div class="info-section" v-if="issue.body">
          <div class="section-header" @click="toggleSection('description')"
            style="cursor: pointer; display: flex; justify-content: space-between;">
            <span>Description</span>
            <div>
              <button v-if="expandedSections.description" class="edit-button" @click.stop="editDescription"
                title="Edit description">
                <span class="edit-icon">✎</span>
              </button>
              <span class="toggle-icon">{{ expandedSections.description ? '▼' : '▶' }}</span>
            </div>
          </div>
          <div class="section-content description-content" v-if="expandedSections.description">
            <div v-if="!isDescriptionTruncated || showFullDescription" class="description-text markdown-content"
              v-html="markdownToHtml(issue.body.body)"></div>
            <div v-else class="description-text markdown-content" v-html="markdownToHtml(truncatedDescription)"></div>
            <div v-if="isDescriptionTruncated" class="show-more-container">
              <button class="show-more-button" @click="toggleFullDescription">
                {{ showFullDescription ? 'Show less' : 'Show more' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Related Issues Section -->
        <div class="info-section" v-if="hasRelations">
          <div class="section-header" @click="toggleSection('relatedIssues')"
            style="cursor: pointer; display: flex; justify-content: space-between;">
            <span>Related Issues</span>
            <span class="toggle-icon">{{ expandedSections.relatedIssues ? '▼' : '▶' }}</span>
          </div>
          <div class="section-content" v-if="expandedSections.relatedIssues">
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

        <!-- Artifacts Section -->
        <div class="info-section">
          <div class="section-header" @click="toggleSection('artifacts')"
            style="cursor: pointer; display: flex; justify-content: space-between;">
            <span>Artifacts</span>
            <span class="toggle-icon">{{ expandedSections.artifacts ? '▼' : '▶' }}</span>
          </div>
          <div class="section-content" v-if="expandedSections.artifacts">
            <button class="create-artifact-button" @click="createArtifact"
              title="Create a new artifact from the active editor">
              <span class="button-icon">+</span> Create Artifact
            </button>

            <div v-if="issue.artifacts && issue.artifacts.length > 0" class="artifacts-list">
              <div v-for="artifact in issue.artifacts" :key="artifact.id" class="artifact-item"
                @click="openArtifactFile(artifact)">
                <div class="artifact-content">
                  <div class="artifact-file">
                    <strong>{{ getFileName(artifact.file) }}</strong>
                    <span class="line-numbers" v-if="artifact.from && artifact.to">
                      (Lines {{ artifact.from }}-{{ artifact.to }})
                    </span>
                  </div>
                  <div class="artifact-version" v-if="artifact.version">
                    Version: {{ artifact.version }}
                  </div>
                  <div class="artifact-fields" v-if="artifact.templatedFields && artifact.templatedFields.length > 0">
                    <div v-for="field in artifact.templatedFields" :key="field.name" class="artifact-field">
                      <span class="field-name">{{ field.name }}:</span> {{ field.value }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="no-artifacts">
              <p>No artifacts linked to this issue.</p>
              <p class="artifact-hint">Open a file in the editor, select code, and click "Create Artifact" to add one.
              </p>
            </div>
          </div>
        </div>

        <!-- Templated Fields Section -->
        <div v-if="issue.templatedFields && issue.templatedFields.length > 0">
          <div v-for="(field, index) in issue.templatedFields" :key="index" class="info-section">
            <div class="section-header-row" style="display: flex; align-items: center; gap: 6px;">
              <!-- Field name as a subsection title -->
              <div class="section-header" style="margin-bottom: 0;">
                {{ field.name }}:
              </div>
              <!-- Field value on the same line, in bold -->
              <div>
                {{ field.value }}
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
import { marked } from 'marked';
let vscode;

export default {
  name: "IssueDetails",
  data() {
    return {
      issue: null,
      error: null,
      originComponentId: null,  // holds the propagated origin component ID
      expandedSections: {
        affectedEntities: false,
        description: false,
        dates: false,
        relatedIssues: false,
        artifacts: false
      },
      showFullDescription: false,
      descriptionMaxLength: 120, // Characters to show before truncating
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
    },
    // Computed properties for description truncation
    isDescriptionTruncated() {
      return this.issue &&
        this.issue.body &&
        this.issue.body.body &&
        this.issue.body.body.length > this.descriptionMaxLength;
    },
    truncatedDescription() {
      if (!this.issue || !this.issue.body || !this.issue.body.body) {
        return '';
      }

      let text = this.issue.body.body;
      // Find a good breaking point (end of sentence or paragraph)
      const breakPoint = text.substring(0, this.descriptionMaxLength).lastIndexOf('.');

      // If we found a period within the range break there, otherwise use the max length
      const endIndex = breakPoint > 0 ? breakPoint + 1 : this.descriptionMaxLength;

      return text.substring(0, endIndex) + '...';
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
          return `${entity.component.name} (v${entity.version})`;
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

    getTypeIconPath() {
      const isOpen = this.issue.state && this.issue.state.isOpen;

      switch (this.issue.type.name) {
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

    getRelationalIconPath() {
      const hasIncoming = this.issue.incomingRelations && this.issue.incomingRelations.totalCount > 0;
      const hasOutgoing = this.issue.outgoingRelations && this.issue.outgoingRelations.totalCount > 0;

      if (hasIncoming && hasOutgoing) {
        return new URL("../../resources/icons/incoming-outgoing.png", import.meta.url).href;
      } else if (hasIncoming) {
        return new URL("../../resources/icons/incoming.png", import.meta.url).href;
      } else if (hasOutgoing) {
        return new URL("../../resources/icons/outgoing.png", import.meta.url).href;
      }
      return new URL("../../resources/icons/none.png", import.meta.url).href;
    },

    /**
     * Returns the ID of the first relevant component for this issue.
     * - If a node is a ComponentVersion, return node.component.id.
     * - If a node is a direct Component, return node.id.
     */
    getComponentId() {
      if (this.originComponentId) {
        return this.originComponentId;
      }
      return null;
    },

    /**
     * Constructs the URL and opens it in a new browser tab.
     */
    openInBrowser() {
      const compId = this.getComponentId();
      const issueId = this.issue?.id;
      if (!compId || !issueId) {
        console.warn("Cannot open in browser: missing compId or issueId");
        console.log("compId:" + compId);
        console.log("issueId:" + issueId);
        return;
      }
      const url = `http://localhost:4200/components/${compId}/issues/${issueId}`;

      if (vscode) {
        vscode.postMessage({
          command: 'openInExternalBrowser',
          url
        });
      } else {
        console.error("vscode API not found in webview");
      }
    },

    getPriorityIconPath() {
      return new URL("../../resources/icons/priority-icon-white.png", import.meta.url).href;
    },
    markdownToHtml(markdown) {
      if (!markdown) return 'No description provided.';
      try {
        return marked.parse(markdown, {
          gfm: true,  // GitHub Flavored Markdown
          breaks: true,
          headerIds: false,
          mangle: false
        });
      } catch (error) {
        console.error("Error rendering markdown:", error);
        return markdown || 'No description provided.';
      }
    },
    toggleSection(sectionName) {
      this.expandedSections[sectionName] = !this.expandedSections[sectionName];
    },


    getArtifactName(artifact) {
      if (!artifact) return 'Unknown';

      // Use the filename as the display name
      let fileName = this.getFileName(artifact.file);
      if (fileName && fileName !== 'Unknown file') {
        return fileName;
      }

      // Fallback to templated fields if available
      if (artifact.templatedFields && artifact.templatedFields.length) {
        const nameField = artifact.templatedFields.find(field => field.name === 'name');
        if (nameField) return nameField.value;
      }

      // Last resort fallback
      return `Artifact ${artifact.id.substring(0, 8)}`;
    },
    createArtifact() {
      if (!this.issue || !this.issue.id) {
        console.error("No issue selected");
        return;
      }

      console.log("[IssueDetails.vue] Creating artifact for issue:", this.issue.id);
      if (vscode) {
        vscode.postMessage({
          command: 'createArtifact',
          issueId: this.issue.id
        });
      }
    },

    getFileName(filePath) {
      if (!filePath) return 'Unknown file';

      try {
        // Try to handle file:// URLs correctly
        if (filePath.startsWith('file:///')) {
          const decodedPath = decodeURIComponent(filePath);
          // Get just the filename from the path
          const parts = decodedPath.split('/');
          return parts[parts.length - 1];
        }

        // Handle regular URLs
        const uri = new URL(filePath);
        const pathParts = uri.pathname.split('/');
        return pathParts[pathParts.length - 1];
      } catch (e) {
        // Fallback for non-URI paths
        const parts = filePath.split('/');
        return parts[parts.length - 1];
      }
    },

    openArtifactFile(artifact) {
      if (!artifact || !artifact.file) {
        console.error("Cannot open artifact: missing file path");
        return;
      }

      console.log("[IssueDetails.vue] Opening artifact file:", artifact.file);

      if (vscode) {
        vscode.postMessage({
          command: 'openArtifactFile',
          artifactData: {
            file: artifact.file,
            from: artifact.from,
            to: artifact.to,
            id: artifact.id
          }
        });
      }
    },
    toggleFullDescription() {
      this.showFullDescription = !this.showFullDescription;
    },

    editDescription() {
      if (!this.issue || !this.issue.body) {
        console.error("No issue body to edit");
        return;
      }

      // Ensure bodyId is present
      if (!this.issue.body.id) {
        console.error("Missing body ID - cannot edit description");
        vscode.postMessage({
          command: 'showError',
          message: 'Cannot edit description: Missing body ID'
        });
        return;
      }

      // Create a temporary file with the markdown content
      const markdown = this.issue.body.body || '';
      const issueId = this.issue.id;
      const bodyId = this.issue.body.id;
      const issueTitle = this.issue.title || '';

      if (vscode) {
        vscode.postMessage({
          command: 'editDescription',
          data: {
            markdown,
            issueId,
            bodyId,
            issueTitle
          }
        });
      }
    },

    // Update the description after editing
    updateDescription(bodyId, newBody) {
      if (!bodyId || !newBody) {
        console.error("Missing required data for updating description");
        return;
      }

      console.log("[IssueDetails.vue] Updating description for body:", bodyId);

      if (vscode) {
        vscode.postMessage({
          command: 'updateDescription',
          data: {
            id: bodyId,
            body: newBody
          }
        });
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
    console.log("[IssueDetails.vue] Mounted: retrieving state...");
    const state = vscode.getState();
    if (state) {
      if (state.originComponentId) {
        this.originComponentId = state.originComponentId;
        console.log("[IssueDetails.vue] Mounted: originComponentId restored:", this.originComponentId);
      }
      if (state.issue) {
        this.issue = state.issue;
        console.log("[IssueDetails.vue] Mounted: issue restored", this.issue);
      }
      if (state.error) {
        this.error = state.error;
        console.log("[IssueDetails.vue] Mounted: error restored", this.error);
      }
    } else {
      console.log("[IssueDetails.vue] Mounted: No state found.");
    }

    window.addEventListener("message", (event) => {
      console.log("[IssueDetails.vue] Received message event:", event);
      const message = event.data;
      console.log("[IssueDetails.vue] Message data:", message);

      if (message && message.command === "displayIssue") {
        console.log("[IssueDetails.vue] Processing displayIssue message");
        this.issue = message.issue;
        // Save the originComponentId from the provider
        if (message.originComponentId) {
          this.originComponentId = message.originComponentId;
        }
        this.error = message.error || null;
        this.showFullDescription = false; // Reset show more state when loading new issue

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
      } else if (message && message.command === "descriptionUpdated") {
        // Handle description update from the extension
        console.log("[IssueDetails.vue] Description updated message received");
        if (this.issue && this.issue.body) {
          this.issue.body.body = message.body;
          this.issue.body.lastModifiedAt = message.lastModifiedAt || new Date().toISOString();

          vscode.setState({
            issue: this.issue,
            error: this.error
          });
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
.edit-button {
  background: none;
  border: none;
  cursor: pointer;
  margin-right: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0.7;
  transition: opacity 0.2s, background-color 0.2s;
  color: aliceblue;
}

.edit-button:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}

.edit-icon {
  font-size: 14px;
}

.show-more-container {
  margin-top: 8px;
  text-align: right;
}

.show-more-button {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  font-size: 0.9em;
  padding: 3px 8px;
  transition: background-color 0.2s;
  border-radius: 3px;
}

.show-more-button:hover {
  background-color: rgba(0, 102, 204, 0.1);
  text-decoration: underline;
}
</style>