<template>
  <div id="app" class="issue-details">
    <!-- Show issue graph -->
    <div class="showGraph">
      <button class="graph-button" @click="openIssueGraph">
        Graph
      </button>
    </div>
    <div v-if="issue" class="issue-container">

      <!-- Title Section with Edit Button -->
      <div class="issue-header">
        <div class="icon-stack">
          <img class="base-icon" :src="getTypeIconPathFor(issue)" alt="" />
          <img class="overlay-icon" :src="getRelationalIconPathFor(issue)" alt="" />
        </div>

        <div class="title-container">
          <!-- Non-editing mode -->
          <div v-if="!isEditingTitle" class="title-display">
            <h2 class="issue-title">{{ issue.title }}</h2>
            <button class="edit-button title-edit-button" @click="startTitleEdit" title="Edit title">
              <span class="edit-icon">✎</span>
            </button>

            <!-- Spacer to push the browser button to the right -->
            <div class="flex-spacer"></div>

            <!-- Open in Browser Button - always on the right -->
            <button class="open-in-browser-button compact-button" @click="openInBrowser">
              Open in Browser
            </button>
          </div>

          <!-- Editing mode - stays in the same place -->
          <div v-else class="title-edit-container">
            <input type="text" v-model="editedTitle" class="title-edit-input" ref="titleInput" @keyup.enter="saveTitle"
              @keyup.esc="cancelTitleEdit" />
            <button class="edit-button cancel-button" @click="cancelTitleEdit">Cancel</button>
            <button class="edit-button save-button" @click="saveTitle">Save</button>
          </div>
        </div>
      </div>

      <!-- Main Content Sections -->
      <div class="issue-sections">

        <!-- Type, State, AND Priority all in one horizontal info-section -->
        <div class="info-section horizontal-section">
          <!-- Type -->
          <div class="section-group" v-if="issue.type">
            <div class="section-header-row">
              <div class="section-header">Type:</div>
              <div class="section-content inline-content">
                <div class="select-container" @click.stop="showTypeDropdown = !showTypeDropdown">
                  <div class="badge type-badge">
                    <img class="type-icon" :src="getTypeIconPathFor(issue)" alt="" />
                    {{ issue.type.name }}
                    <span class="dropdown-arrow">▼</span>
                  </div>

                  <div v-if="showTypeDropdown" class="field-dropdown">
                    <div v-if="issueOptions.types.length === 0" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="type in issueOptions.types" :key="type.id" @click.stop="changeIssueType(type.id)"
                        class="dropdown-option">
                        <img class="type-icon-small" :src="getTypeIconForOption(type)" alt="" />
                        {{ type.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- State -->
          <div class="section-group" v-if="issue.state">
            <div class="section-header-row">
              <div class="section-header">State:</div>
              <div class="section-content inline-content">
                <div class="select-container" @click.stop="showStateDropdown = !showStateDropdown">
                  <div class="badge state-badge" :class="{
                    'state-open': issue.state.isOpen,
                    'state-completed': !issue.state.isOpen && issue.state.name === 'Completed',
                    'state-not-planned': !issue.state.isOpen && issue.state.name === 'Not Planned'
                  }">
                    {{ issue.state.name || 'Unknown' }}
                    <span class="dropdown-arrow">▼</span>
                  </div>

                  <div v-if="showStateDropdown" class="field-dropdown">
                    <div v-if="issueOptions.states.length === 0" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="state in issueOptions.states" :key="state.id" @click.stop="changeIssueState(state.id)"
                        class="dropdown-option" :class="{
                          'state-option-open': state.isOpen,
                          'state-option-closed': !state.isOpen
                        }">
                        {{ state.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Priority -->
          <div class="section-group" v-if="issue.priority">
            <div class="section-header-row">
              <div class="section-header">Priority:</div>
              <div class="section-content inline-content">
                <div class="select-container" @click.stop="showPriorityDropdown = !showPriorityDropdown">
                  <div class="badge priority-badge">
                    <img class="priority-icon" :src="getPriorityIconPath()" alt="" />
                    {{ issue.priority.name }}
                    <span class="dropdown-arrow">▼</span>
                  </div>

                  <div v-if="showPriorityDropdown" class="field-dropdown">
                    <div v-if="issueOptions.priorities.length === 0" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="priority in issueOptions.priorities" :key="priority.id"
                        @click.stop="changeIssuePriority(priority.id)" class="dropdown-option">
                        {{ priority.name }}
                      </div>
                    </div>
                  </div>
                </div>
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
            <!-- Outgoing Relations FIRST -->
            <div v-if="hasOutgoingRelations" class="relations-group">
              <!-- Wrap header and candidate dropdown in a relative container -->
              <div style="position: relative;">
                <!-- Header with label and buttons -->
                <div class="relations-subheader" style="display: flex; align-items: center; justify-content: space-between;">
                  <span>Outgoing Relations</span>
                  <div>
                    <!-- Edit toggle button -->
                    <button class="edit-button"
                            @click="editingOutgoingRelations = !editingOutgoingRelations"
                            :title="editingOutgoingRelations ? 'Done editing relations' : 'Edit outgoing relations'">
                      <span class="edit-icon">✎</span>
                    </button>
                    <!-- New "Add Outgoing Relation" button placed next to the edit button -->
                    <button class="remove-relation-button"
                            @click.stop="toggleNewRelationDropdown"
                            title="Add Outgoing Relation"
                            style="margin-left: 4px;">
                      <span class="edit-icon">+</span>
                    </button>
                  </div>
                </div>

                <!-- Candidate Issues Dropdown -->
                <div v-if="newRelationDropdownVisible && !newOutgoingRelation" class="field-dropdown"
                    style="position: absolute; top: 100%; right: 0; z-index: 1000; background: var(--vscode-dropdown-background);">
                  <div v-if="newRelationIssues.length === 0" class="dropdown-loading">No issues found</div>
                  <div v-else class="dropdown-options">
                    <div v-for="issue in newRelationIssues" :key="issue.id" class="dropdown-option"
                        @click.stop="selectNewRelationIssue(issue)"
                        style="display: flex; align-items: center; gap: 6px;">
                      <div class="icon-stack">
                        <img class="base-icon" :src="getTypeIconPathFor(issue)" alt="Type icon" />
                        <img class="overlay-icon" :src="getRelationalIconPathFor(issue)" alt="Relation icon" />
                      </div>
                      <!-- If you previously used state.name, update it to derive text from isOpen -->
                      <span>{{ issue.title }} ({{ issue.state.isOpen ? 'Open' : 'Closed' }})</span>
                    </div>
                  </div>
                </div>

                <!-- New Relation Info and Relation Types Dropdown -->
                <div v-if="newOutgoingRelation" class="new-outgoing-relation-container"
                    style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                  <div class="new-outgoing-issue-info" style="display: flex; align-items: center; gap: 6px;">
                    <div class="icon-stack">
                      <img class="base-icon" :src="getTypeIconPathFor(newOutgoingRelation)" alt="Type icon" />
                      <img class="overlay-icon" :src="getRelationalIconPathFor(newOutgoingRelation)" alt="Relation icon" />
                    </div>
                    <span>{{ newOutgoingRelation.title }} ({{ newOutgoingRelation.state.isOpen ? 'Open' : 'Closed' }})</span>
                  </div>
                  <!-- Dropdown for relation types -->
                  <div v-if="newRelationTypeDropdownVisible" class="field-dropdown" style="position: relative;">
                    <div v-if="relationTypesLoading" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="type in relationTypes" :key="type.id" class="dropdown-option"
                          @click.stop="selectNewRelationType(type)"
                          style="cursor: pointer;">
                        {{ type.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Existing outgoing relations section -->
              <template v-if="!editingOutgoingRelations">
                <div v-for="(relations, relType) in groupedOutgoingRelations" :key="'out-' + relType" style="margin-bottom: 10px;">
                  <div class="relation-type-header" style="font-weight: 600; margin-bottom: 4px;">
                    {{ relType }}
                  </div>
                  <div class="relations-list">
                    <div v-for="relation in relations" :key="relation.id" class="relation-item">
                      <div class="relation-content" @click="openRelatedIssue(relation.relatedIssue.id)">
                        <div class="icon-stack">
                          <img class="base-icon" :src="getTypeIconPathFor(relation.relatedIssue)" alt="" />
                          <img class="overlay-icon" :src="getRelationalIconPathFor(relation.relatedIssue)" alt="" />
                        </div>
                        <span>{{ relation.relatedIssue.title }}</span>
                      </div>
                      <button v-if="editingOutgoingRelations"
                              class="remove-relation-button"
                              @click.stop="onRemoveRelation(relation.id)"
                              title="Remove Relation">
                        X
                      </button>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="relations-list">
                  <div v-for="item in flatOutgoingRelations" :key="item.relation.id" class="relation-item">
                    <div class="relation-content" @click="openRelatedIssue(item.relation.relatedIssue.id)" style="display: flex; align-items: center;">
                      <div class="icon-stack">
                        <img class="base-icon" :src="getTypeIconPathFor(item.relation.relatedIssue)" alt="" />
                        <img class="overlay-icon" :src="getRelationalIconPathFor(item.relation.relatedIssue)" alt="" />
                      </div>
                      <div style="display: flex; flex-direction: column; margin-left: 8px;">
                        <span>{{ item.relation.relatedIssue.title }}</span>
                        <span class="relation-type-inline" style="font-size: 0.85em; color: #ccc;">
                          {{ item.relType }}
                        </span>
                        <div v-if="currentlyEditingRelation === item.relation.id" class="field-dropdown" style="margin-top: 4px;">
                          <div v-if="relationTypesLoading" class="dropdown-loading">Loading...</div>
                          <div v-else class="dropdown-options">
                            <div v-for="type in relationTypes" :key="type.id" class="dropdown-option"
                                @click.stop="selectRelationType(item.relation.id, type.id)">
                              {{ type.name }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button class="edit-button title-edit-button"
                            @click.stop="triggerEditRelation(item.relation.id)"
                            title="Edit relation type">
                      <span class="edit-icon">✎</span>
                    </button>
                    <button class="remove-relation-button"
                            @click.stop="onRemoveRelation(item.relation.id)"
                            title="Remove Relation">
                      X
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <!-- Incoming Relations SECOND -->
            <div v-if="hasIncomingRelations" class="relations-group">
              <div class="relations-subheader">Incoming Relations</div>

              <!-- Iterate over each relation type group -->
              <div v-for="(issues, relType) in groupedIncomingRelations" :key="'in-' + relType" style="margin-bottom: 10px;">
                <!-- Show the relation type -->
                <div class="relation-type-header" style="font-weight: 600; margin-bottom: 4px;">
                  {{ relType }}
                </div>

                <div class="relations-list">
                  <div 
                    v-for="issueData in issues" 
                    :key="issueData.id" 
                    class="relation-item"
                    @click="openRelatedIssue(issueData.id)"
                    style="display: flex; align-items: center; gap: 8px;">
                    <div class="icon-stack">
                      <img class="base-icon" :src="getTypeIconPathFor(issueData)" alt="" />
                      <img class="overlay-icon" :src="getRelationalIconPathFor(issueData)" alt="" />
                    </div>
                    <!-- This span simply displays the title aligned left -->
                    <span>{{ issueData.title }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Assignments Section -->
        <div class="info-section">
          <div class="section-header" @click="toggleSection('assignments')"
            style="cursor: pointer; display: flex; justify-content: space-between;">
            <span>Assignments</span>
            <div>
              <button v-if="expandedSections.assignments" class="remove-button" @click.stop="showAddAssignment"
                title="Add assignment">
                <span>+</span>
              </button>
              <span class="toggle-icon">{{ expandedSections.assignments ? '▼' : '▶' }}</span>
            </div>
          </div>
          <div class="section-content" v-if="expandedSections.assignments">
            <div v-if="showingAddAssignment" class="add-assignment-form">
              <div class="search-container">
                <input type="text" v-model="userSearchQuery" placeholder="Assign user" class="search-input"
                  @input="searchUsers" ref="userSearchInput" />
                <div v-if="userSearchResults.length > 0" class="search-results">
                  <div v-for="user in userSearchResults" :key="user.id" class="search-result-item"
                    @click="selectUserAndCreateAssignment(user)">
                    {{ user.displayName || user.username }}
                  </div>
                </div>
              </div>


            </div>
            <div v-if="issue.assignments && issue.assignments.nodes && issue.assignments.nodes.length > 0"
              class="assignments-list">
              <div v-for="assignment in issue.assignments.nodes" :key="assignment.id" class="assignment-item">
                <div class="assignment-content">
                  <div class="assignment-user">
                    <div class="user-avatar">{{ getUserInitials(assignment.user) }}</div>
                    <span class="user-name">{{ assignment.user.displayName || assignment.user.username }}</span>
                    <div class="assignment-actions">
                      <div class="select-container" v-if="issue.template">
                        <span class="assignment-type-badge" @click.stop="toggleTypeDropdown(assignment.id)">
                          {{ assignment.type ? assignment.type.name : 'No type' }}
                          <span class="dropdown-arrow">▼</span>
                        </span>
                        <div v-if="activeTypeDropdown === assignment.id" class="type-dropdown">
                          <div v-if="assignmentTypes.length === 0" class="dropdown-loading">No type</div>
                          <div v-else class="dropdown-options">
                            <div v-for="type in assignmentTypes" :key="type.id" class="type-option"
                              @click.stop="updateAssignmentType(assignment.id, type.id)">
                              {{ type.name }}
                            </div>
                            <div class="type-option no-type-option"
                              @click.stop="updateAssignmentType(assignment.id, null)">
                              No type
                            </div>
                          </div>
                        </div>
                      </div>
                      <button class="remove-button" @click="(event) => {
                        event.stopPropagation();
                        console.log('Remove button clicked for assignment:', assignment.id);
                        confirmRemoveAssignment(assignment);
                      }" title="Remove assignment">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="no-assignments">
              <p>No user assignments for this issue.</p>
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
            <button v-if="expandedSections.assignments" class="remove-button" @click.stop="showAddAssignment"
              title="Add assignment">
              <span style="font-size: 14px; font-weight: bold;">+</span>
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
      showTypeDropdown: false,
      showStateDropdown: false,
      showPriorityDropdown: false,
      assignments: false,
      issueOptionsMap: {},
      issueOptions: {
        types: [],
        states: [],
        priorities: []
      },
      isEditingTitle: false,
      editedTitle: '',
      showingAddAssignment: false,
      showingChangeType: false,
      userSearchQuery: '',
      userSearchResults: [],
      selectedUser: null,
      assignmentTypes: [],
      selectedTypeId: '',
      currentAssignment: null,
      activeTypeDropdown: null,
      assignmentTypes: [],
      assignmentTypesMap: {},
      editingOutgoingRelations: false,
      currentlyEditingRelation: null,
      relationTypes: [],
      relationTypesLoading: false,
      newRelationDropdownVisible: false,
      newRelationIssues: [],
      newOutgoingRelation: null,
      newRelationTypeDropdownVisible: false,
      relationTypes: [],
      relationTypesLoading: false
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
    // NEW: Combine edges + nodes for OUTGOING
    groupedOutgoingRelations() {
      if (!this.issue || !this.issue.outgoingRelations) {
        return {};
      }
      const nodes = this.issue.outgoingRelations.nodes || [];
      const edges = this.issue.outgoingRelations.edges || [];

      const grouped = {};
      // Ensure we iterate over the minimum length (assuming both arrays are aligned)
      const length = Math.min(nodes.length, edges.length);
      for (let i = 0; i < length; i++) {
        const node = nodes[i];
        const edge = edges[i];
        const relType = edge.node.type?.name || "Unknown";
        if (!grouped[relType]) {
          grouped[relType] = [];
        }
        grouped[relType].push(node);
      }
      return grouped;
    },

    flatOutgoingRelations() {
      if (!this.issue || !this.issue.outgoingRelations) return [];
      const nodes = this.issue.outgoingRelations.nodes || [];
      const edges = this.issue.outgoingRelations.edges || [];
      const length = Math.min(nodes.length, edges.length);
      const flat = [];
      for (let i = 0; i < length; i++) {
        flat.push({
          relation: nodes[i],
          relType: edges[i].node.type?.name || "Unknown"
        });
      }
      return flat;
    },

    // NEW: Combine edges + nodes for INCOMING
    groupedIncomingRelations() {
      if (!this.issue || !this.issue.incomingRelations) {
        return {};
      }
      const edges = this.issue.incomingRelations.edges || [];
      const nodes = this.issue.incomingRelations.nodes || [];

      // 1) Create a map from issue.id => the fully populated issue from "nodes"
      const issueMap = new Map();
      for (const nodeItem of nodes) {
        // nodeItem looks like: { issue: { id, title, state, type, ... } }
        issueMap.set(nodeItem.issue.id, nodeItem.issue);
      }

      // 2) Group by relation type
      const grouped = {};
      for (const edgeItem of edges) {
        // edgeItem.node => { type: { name }, issue: { id, title } }
        const relType = edgeItem.node.type?.name || "Unknown";
        const minimalIssue = edgeItem.node.issue;

        // match minimalIssue.id to the fully populated issue from issueMap
        const fullIssue = issueMap.get(minimalIssue.id) || minimalIssue;

        if (!grouped[relType]) {
          grouped[relType] = [];
        }
        grouped[relType].push(fullIssue);
      }
      return grouped;
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
  watch: {
    issue(newIssue) {
      if (newIssue && newIssue.template && newIssue.template.id) {
        console.log('[IssueDetails.vue] Issue changed, loading options for template:', newIssue.template.id);
        this.loadIssueOptions();
      }
    }
  },
  methods: {
    // Toggle the candidate issues dropdown
    toggleNewRelationDropdown() {
      this.newOutgoingRelation = null;
      this.newRelationTypeDropdownVisible = false;
      this.newRelationDropdownVisible = !this.newRelationDropdownVisible;
      if (this.newRelationDropdownVisible && vscode) {
        vscode.postMessage({ command: 'createOutgoingRelation' });
      }
    },
    // When a candidate issue is selected:
    selectNewRelationIssue(issue) {
      this.newOutgoingRelation = issue;
      this.newRelationDropdownVisible = false;
      this.newRelationTypeDropdownVisible = true;
      this.relationTypesLoading = true;
      if (vscode) {
        // Pass no relationId (or a constant like "new") because we’re creating a new relation
        vscode.postMessage({ command: 'getNewRelationTypes' });
      }
    },
    // When a relation type is selected:
    selectNewRelationType(type) {
      console.log("Selected new relation type:", type);
      this.newRelationTypeDropdownVisible = false;
      // Additional logic to process the selection (e.g., calling a mutation) can be added here.
    },
    // When the edit button is clicked for an outgoing relation
    triggerEditRelation(relationId) {
      if (this.currentlyEditingRelation === relationId) {
        // Toggle off if already editing
        this.currentlyEditingRelation = null;
        return;
      }
      this.currentlyEditingRelation = relationId;
      this.relationTypesLoading = true;
      // Request available relation types from the extension host
      if (vscode) {
        vscode.postMessage({
          command: 'getRelationTypes',
          relationId: relationId
        });
      }
    },
    // When a user selects a new relation type from the dropdown
    selectRelationType(relationId, typeId) {
      if (vscode) {
        vscode.postMessage({
          command: 'changeRelationType',
          relationId: relationId,
          typeId: typeId
        });
      }
      // Close the dropdown after selection
      this.currentlyEditingRelation = null;
    },
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
    onRemoveRelation(relationId) {
      if (vscode) {
        vscode.postMessage({
          command: 'removeIssueRelation',
          relationId: relationId
        });
      } else {
        console.error("vscode API not available");
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

    getTypeIconPathFor(someIssue) {
      if (!someIssue) {
        // Fallback icon
        return new URL("../../resources/icons/bug-black.png", import.meta.url).href;
      }
      const isOpen = someIssue.state && someIssue.state.isOpen;
      const typeName = someIssue.type && someIssue.type.name;

      switch (typeName) {
        case "Bug":
          return isOpen
            ? new URL("../../resources/icons/bug-green.png", import.meta.url).href
            : new URL("../../resources/icons/bug-red.png", import.meta.url).href;
        case "Feature":
          return isOpen
            ? new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href
            : new URL("../../resources/icons/lightbulb-feature-red.png", import.meta.url).href;
        case "Misc":
        case "Task":
          return isOpen
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        default:
          return new URL("../../resources/icons/bug-black.png", import.meta.url).href;
      }
    },

    getRelationalIconPathFor(someIssue) {
      if (!someIssue) {
        return new URL("../../resources/icons/none.png", import.meta.url).href;
      }
      const hasIncoming = someIssue.incomingRelations && someIssue.incomingRelations.totalCount > 0;
      const hasOutgoing = someIssue.outgoingRelations && someIssue.outgoingRelations.totalCount > 0;

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

      // Add logging for assignments section
      if (sectionName === 'assignments') {
        console.log(`[IssueDetails.vue] Assignments section toggled to ${this.expandedSections.assignments}`);
        if (this.issue && this.issue.assignments) {
          console.log('[IssueDetails.vue] Assignments data:', JSON.stringify(this.issue.assignments));
        }
      }
    },

    getAssignmentType(assignment) {
      if (assignment && assignment.type && assignment.type.name) {
        return assignment.type.name;
      }
      return "No type";
    },

    positionTypeDropdown() {
      this.$nextTick(() => {
        const dropdown = this.$el.querySelector('.type-dropdown');
        if (!dropdown) return;

        // Get the viewport height
        const viewportHeight = window.innerHeight;

        // Get the dropdown's position and dimensions
        const rect = dropdown.getBoundingClientRect();

        // Check if dropdown extends below viewport
        if (rect.bottom > viewportHeight) {
          // Position above instead of below
          dropdown.style.bottom = '100%';
          dropdown.style.top = 'auto';
        } else {
          // Default positioning (below)
          dropdown.style.top = '100%';
          dropdown.style.bottom = 'auto';
        }
      });
    },

    // Helper for displaying user initials in the avatar
    getUserInitials(user) {
      if (!user) return '';
      const name = user.displayName || user.username || '';
      return name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    },

    async loadAssignmentTypes() {
      if (!this.issue || !this.issue.template || !this.issue.template.id) {
        console.warn('[IssueDetails.vue] Cannot load assignment types: No template ID');
        return;
      }

      const templateId = this.issue.template.id;

      // Check if we already have types for this template
      if (this.assignmentTypesMap[templateId] && this.assignmentTypesMap[templateId].length > 0) {
        console.log(`[IssueDetails.vue] Using cached assignment types for template ${templateId}`);
        this.assignmentTypes = this.assignmentTypesMap[templateId];
        return;
      }

      console.log(`[IssueDetails.vue] Requesting assignment types for template: ${templateId}`);

      // Clear current assignment types while loading
      this.assignmentTypes = [];

      if (vscode) {
        vscode.postMessage({
          command: 'getAssignmentTypes',
          templateId: templateId
        });
      }
    },
    async confirmRemoveAssignment(assignment) {
      console.log(`[IssueDetails] Attempting to remove assignment:`, assignment);
      alert(`Removing assignment: ${assignment.id}`); // Add this line

      if (!assignment || !assignment.id) {
        console.error('[IssueDetails] Cannot remove assignment: Missing assignment ID');
        return;
      }

      console.log(`[IssueDetails] Removing assignment with ID: ${assignment.id}`);

      if (vscode) {
        vscode.postMessage({
          command: 'removeAssignment',
          assignmentId: assignment.id
        });
      } else {
        console.error('[IssueDetails] vscode API not available');
      }
    },
    // Update an assignment's type
    async updateAssignmentType(assignmentId, typeId) {
      if (!assignmentId) {
        console.error('[IssueDetails.vue] Cannot update assignment type: Missing assignment ID');
        return;
      }

      console.log(`[IssueDetails.vue] Updating assignment ${assignmentId} to type ${typeId || 'null'}`);

      if (vscode) {
        vscode.postMessage({
          command: 'changeAssignmentType',
          assignmentId: assignmentId,
          typeId: typeId
        });
      }

      // Close the dropdown
      this.activeTypeDropdown = null;
    },

    // Show the add assignment form
    showAddAssignment(event) {
      event.stopPropagation();
      this.showingAddAssignment = true;
      this.userSearchQuery = '';
      this.userSearchResults = [];

      // Focus the input field
      this.$nextTick(() => {
        if (this.$refs.userSearchInput) {
          this.$refs.userSearchInput.focus();
        }
      });

      // Add click-outside handler to close the form
      document.addEventListener('click', this.handleClickOutsideAddForm);
    },

    // Close the add assignment form when clicking outside
    handleClickOutsideAddForm(event) {
      const form = this.$el.querySelector('.add-assignment-form');
      const button = this.$el.querySelector('.remove-button');

      if (form && button &&
        !form.contains(event.target) &&
        !button.contains(event.target)) {
        this.showingAddAssignment = false;
        document.removeEventListener('click', this.handleClickOutsideAddForm);
      }
    },

    // Search for users as the user types
    async searchUsers() {
      if (!this.userSearchQuery || this.userSearchQuery.length < 1) {
        this.userSearchResults = [];
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'searchUsers',
          query: this.userSearchQuery
        });
      }
    },

    closeAddAssignmentDialog() {
      this.showingAddAssignment = false;
    },

    // Search for users as the user types
    async searchUsers() {
      if (!this.userSearchQuery || this.userSearchQuery.length < 1) {
        this.userSearchResults = [];
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'searchUsers',
          query: this.userSearchQuery
        });
      }
    },
    // Select a user and create the assignment
    selectUserAndCreateAssignment(user) {
      if (!user || !user.id || !this.issue || !this.issue.id) {
        console.error('[IssueDetails] Cannot create assignment: Missing user or issue ID');
        return;
      }

      console.log(`[IssueDetails] Creating assignment for user: ${user.displayName || user.username}`);

      if (vscode) {
        vscode.postMessage({
          command: 'createAssignment',
          issueId: this.issue.id,
          userId: user.id
        });
      }

      // Close the form
      this.showingAddAssignment = false;
      document.removeEventListener('click', this.handleClickOutsideAddForm);
    },

    selectUser(user) {
      this.selectedUser = user;
      this.userSearchResults = [];
    },

    // Remove Assignment
    async confirmRemoveAssignment(assignment) {
      console.log('[IssueDetails.vue] Confirming removal of assignment:', assignment.id);

      if (!assignment || !assignment.id) {
        console.error('[IssueDetails.vue] Cannot remove assignment: Missing assignment ID');
        return;
      }

      // Send the removal request directly to the extension host
      if (vscode) {
        vscode.postMessage({
          command: 'removeAssignment',
          assignmentId: assignment.id
        });
      } else {
        console.error('[IssueDetails.vue] vscode API not available');
      }
    },

    async removeAssignment(assignmentId) {
      try {
        await globalApiClient.authenticate();

        const result = await globalApiClient.executeQuery(
          REMOVE_ASSIGNMENT_MUTATION,
          { input: { assignment: assignmentId } }
        );

        if (result.data?.removeAssignment?.removedAssignmentEvent) {
          vscode.window.showInformationMessage('Assignment removed successfully.');

          // Refresh issue details to update assignments
          if (this.issue && this.issue.id) {
            this.refreshCurrentIssue();
          }
        } else {
          console.error('[IssueDetails] Failed to remove assignment:', result);
          vscode.window.showErrorMessage('Failed to remove assignment.');
        }
      } catch (error) {
        console.error('[IssueDetails] Error removing assignment:', error);
        vscode.window.showErrorMessage(`Error removing assignment: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async changeAssignmentType() {
      if (!this.currentAssignment || !this.currentAssignment.id) {
        console.error('[IssueDetails] Cannot change type: Missing assignment ID');
        return;
      }

      try {
        await globalApiClient.authenticate();

        const input = {
          assignment: this.currentAssignment.id
        };

        // Add type if selected
        if (this.selectedTypeId) {
          input.type = this.selectedTypeId;
        }

        const result = await globalApiClient.executeQuery(
          CHANGE_ASSIGNMENT_TYPE_MUTATION,
          { input }
        );

        if (result.data?.changeAssignmentType?.assignmentTypeChangedEvent) {
          vscode.window.showInformationMessage('Assignment type changed successfully.');
          this.closeChangeTypeDialog();

          // Refresh issue details to show the updated assignment
          if (this.issue && this.issue.id) {
            this.refreshCurrentIssue();
          }
        } else {
          console.error('[IssueDetails] Failed to change assignment type:', result);
          vscode.window.showErrorMessage('Failed to change assignment type.');
        }
      } catch (error) {
        console.error('[IssueDetails] Error changing assignment type:', error);
        vscode.window.showErrorMessage(`Error changing assignment type: ${error instanceof Error ? error.message : String(error)}`);
      }
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
    },
    loadIssueOptions() {
      if (!this.issue || !this.issue.template || !this.issue.template.id) {
        console.error("Cannot load issue options: Missing template ID");
        return;
      }

      const templateId = this.issue.template.id;
      console.log(`[IssueDetails.vue] Loading options for template: ${templateId}`);

      // Check if we already have cached options for this template
      if (this.issueOptionsMap[templateId]) {
        console.log(`[IssueDetails.vue] Using cached options for template ${templateId}`);
        this.issueOptions = this.issueOptionsMap[templateId];
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'getIssueOptions',
          templateId: templateId
        });
      }
    },

    // Change issue type
    changeIssueType(typeId) {
      if (!this.issue || !this.issue.id) {
        console.error("Cannot change type: Missing issue ID");
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'changeIssueType',
          issueId: this.issue.id,
          typeId: typeId
        });
      }

      // Hide dropdown after selection
      this.showTypeDropdown = false;
    },

    // Change issue state
    changeIssueState(stateId) {
      if (!this.issue || !this.issue.id) {
        console.error("Cannot change state: Missing issue ID");
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'changeIssueState',
          issueId: this.issue.id,
          stateId: stateId
        });
      }

      // Hide dropdown after selection
      this.showStateDropdown = false;
    },

    // Change issue priority
    changeIssuePriority(priorityId) {
      if (!this.issue || !this.issue.id) {
        console.error("Cannot change priority: Missing issue ID");
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'changeIssuePriority',
          issueId: this.issue.id,
          priorityId: priorityId
        });
      }

      // Hide dropdown after selection
      this.showPriorityDropdown = false;
    },

    startTitleEdit() {
      this.editedTitle = this.issue.title;
      this.isEditingTitle = true;
      // Focus the input field after the DOM updates
      this.$nextTick(() => {
        if (this.$refs.titleInput) {
          this.$refs.titleInput.focus();
        }
      });
    },

    cancelTitleEdit() {
      this.isEditingTitle = false;
      this.editedTitle = '';
    },

    saveTitle() {
      if (!this.editedTitle.trim()) {
        // Don't allow empty titles
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'changeIssueTitle',
          issueId: this.issue.id,
          title: this.editedTitle.trim()
        });
      }

      this.isEditingTitle = false;
    },

    getTypeIconForOption(type) {
      // Icons for different types in the dropdown
      const isOpen = this.issue.state && this.issue.state.isOpen;

      switch (type.name) {
        case "Bug":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/bug-green.png", import.meta.url).href
            : new URL("../../resources/icons/bug-red.png", import.meta.url).href;
        case "Feature":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href
            : new URL("../../resources/icons/lightbulb-feature-red.png", import.meta.url).href;
        case "Misc":
        case "Task":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        default:
          return new URL("../../resources/icons/bug-black.png", import.meta.url).href;
      }
    },

    // Close dropdowns when clicking outside
    handleClickOutside(event) {
      let isOnDropdown = false;

      const dropdowns = document.querySelectorAll('.select-container, .field-dropdown');
      dropdowns.forEach(el => {
        if (el.contains(event.target)) {
          isOnDropdown = true;
        }
      });

      // Only close dropdowns if clicking outside
      if (!isOnDropdown) {
        this.showTypeDropdown = false;
        this.showStateDropdown = false;
        this.showPriorityDropdown = false;
      }

      // Close all dropdowns when clicking outside of them
      if (this.showTypeDropdown || this.showStateDropdown || this.showPriorityDropdown) {
        this.showTypeDropdown = false;
        this.showStateDropdown = false;
        this.showPriorityDropdown = false;
      }
    },

    refreshCurrentIssue() {
      if (vscode) {
        vscode.postMessage({
          command: 'refreshCurrentIssue'
        });
      }
    },
    toggleTypeDropdown(assignmentId) {
      console.log(`[IssueDetails.vue] Toggle type dropdown for assignment ${assignmentId}`);

      // If this dropdown is already active, close it
      if (this.activeTypeDropdown === assignmentId) {
        this.activeTypeDropdown = null;
      } else {
        this.activeTypeDropdown = assignmentId;

        if (this.issue?.template?.id) {
          const templateId = this.issue.template.id;

          if (this.assignmentTypesMap[templateId]) {
            this.assignmentTypes = this.assignmentTypesMap[templateId];
            console.log(`[IssueDetails.vue] Using cached assignment types for template ${templateId}:`, this.assignmentTypes);
          } else {
            console.log(`[IssueDetails.vue] Loading assignment types for template ${templateId}`);
            this.loadAssignmentTypes();
          }
        }
        if (this.activeTypeDropdown) {
          // Position the dropdown after it's rendered
          this.positionTypeDropdown();
        }
      }
      this.$nextTick(() => {
        document.addEventListener('click', this.closeTypeDropdown);
      });
    }, closeTypeDropdown(event) {
      // Only close if clicking outside the dropdown
      const dropdown = this.$el.querySelector('.type-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        this.activeTypeDropdown = null;k
        document.removeEventListener('click', this.closeTypeDropdown);
      }
    },
    // Graph  
    openIssueGraph() {
      console.log("Start issue graph");
      if (vscode) {
        vscode.postMessage({ command: "showIssueGraph" });
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

    document.addEventListener('click', this.handleClickOutside);

    window.addEventListener("message", async (event) => {
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
          // Load options right after receiving the issue
          if (this.issue.template && this.issue.template.id) {
            console.log("[IssueDetails.vue] Issue has template ID, loading options:", this.issue.template.id);
            this.loadIssueOptions();
          } else {
            console.warn("[IssueDetails.vue] Issue missing template ID, can't load options");
          }
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
      } else if (message && message.command === 'issueOptionsLoaded') {
        const templateId = this.issue?.template?.id;
        if (templateId) {
          console.log(`[IssueDetails.vue] Options loaded for template ${templateId}:`, message.options);

          // Cache the options for this template
          this.issueOptionsMap[templateId] = message.options;
          // Update current options
          this.issueOptions = message.options;
        } else {
          console.warn("[IssueDetails.vue] Received options but no template ID available");
        }
      } else if (message && message.command === 'issueOptionsError') {
        console.error("[IssueDetails.vue] Error loading options:", message.error);
      } else if (message && message.command === 'issueStateUpdated') {
        if (this.issue && this.issue.state) {
          console.log("[IssueDetails.vue] State updated:", message.state);
          this.issue.state = message.state;
        }
      } else if (message && message.command === 'issueTypeUpdated') {
        if (this.issue && this.issue.type) {
          console.log("[IssueDetails.vue] Type updated:", message.type);
          this.issue.type = message.type;
        }
      } else if (message && message.command === 'issuePriorityUpdated') {
        if (this.issue && this.issue.priority) {
          console.log("[IssueDetails.vue] Priority updated:", message.priority);
          this.issue.priority = message.priority;
        }
      } else if (message && message.command === 'issueTitleUpdated') {
        if (this.issue) {
          console.log("[IssueDetails.vue] Title updated:", message.title);
          this.issue.title = message.title;
        }
      } else if (message && message.command === 'assignmentTypesLoaded') {
        const templateId = this.issue?.template?.id;
        if (templateId) {
          console.log(`[IssueDetails.vue] Assignment types loaded for template ${templateId}:`, message.types);

          // Store in the map and update current array
          this.assignmentTypesMap[templateId] = message.types || [];
          this.assignmentTypes = message.types || [];

          // If a dropdown is open, force a refresh
          if (this.activeTypeDropdown) {
            this.$forceUpdate();
          }
        }
      }
      else if (message && message.command === 'assignmentTypesError') {
        console.error('[IssueDetails.vue] Error loading assignment types:', message.error);
        this.assignmentTypes = [];
      } else if (message && message.command === 'assignmentRemoved') {
        console.log('[IssueDetails.vue] Assignment removed:', message.assignmentId);

        // The issue will be refreshed, so no need to update local state
        vscode.window.showInformationMessage('Assignment removed successfully.');
      }
      else if (message && message.command === 'assignmentError') {
        console.error('[IssueDetails.vue] Error with assignment:', message.error);
        vscode.window.showErrorMessage(`Error: ${message.error}`);
      } else if (message.command === 'removeAssignment') {
        console.log(`[IssueDetailsProvider] Received removeAssignment request for ID: ${message.assignmentId}`);
        try {
          await this.removeAssignment(message.assignmentId);
          console.log(`[IssueDetailsProvider] Successfully removed assignment ID: ${message.assignmentId}`);
          this._view?.webview.postMessage({
            command: 'assignmentRemoved',
            assignmentId: message.assignmentId
          });

          // Refresh issue details to update the UI
          this.refreshCurrentIssue();
        } catch (error) {
          console.error('[IssueDetailsProvider] Error removing assignment:', error);
          this._view?.webview.postMessage({
            command: 'assignmentError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message && message.command === 'userSearchResults') {
        console.log('[IssueDetails.vue] User search results:', message.users);
        this.userSearchResults = message.users || [];
      } else if (message && message.command === 'assignmentCreated') {
        console.log('[IssueDetails.vue] Assignment created successfully');
        vscode.window.showInformationMessage('Assignment created successfully.');
        // The issue will be refreshed with the new assignment
      } else if (message && message.command === 'relationTypesLoaded') {
        if (this.currentlyEditingRelation === message.relationId) {
          this.relationTypes = message.types;
          this.relationTypesLoading = false;
        }
      } else if (message && message.command === 'relationTypesError') {
        console.error('Error loading relation types:', message.error);
        this.relationTypes = [];
        this.relationTypesLoading = false;
      } else if (message.command === 'relationTypeChanged') {
        // You can now use message.newType (with id and name) to update your UI.
        // Optionally, refresh the issue details or update the specific outgoing relation locally.
        // For instance:
        console.log('Outgoing relation updated, new type:', message.newType);
        // Optionally: this.refreshCurrentIssue();
      } else if (message && message.command === "newOutgoingRelationList") {
        if (this.issue && this.issue.id) {
          this.newRelationIssues = message.issues.filter(issue => issue.id !== this.issue.id);
        } else {
          this.newRelationIssues = message.issues;
        }
      } else if (message && message.command === "newRelationTypesLoaded") {
        this.relationTypes = message.types;
        this.relationTypesLoading = false;
      } else if (message && message.command === "newRelationTypesError") {
        console.error("Error loading new relation types:", message.error);
        this.relationTypes = [];
        this.relationTypesLoading = false;
      }

      if (typeof acquireVsCodeApi !== "undefined") {
        const existingMessageHandler = window.onmessage;
        window.addEventListener("message", (event) => {
          const message = event.data;

          // Forward to existing handler first
          if (existingMessageHandler) {
            existingMessageHandler(event);
          }

          if (message && message.command === "refreshCurrentIssue") {
            if (this.issue && this.issue.id) {
              this._view?.webview.postMessage({
                command: 'showIssueDetails',
                issueId: this.issue.id
              });
            }
          }
        });
      }
    });

    // When an issue is loaded, also load the issue options
    if (this.issue && this.issue.template && this.issue.template.id) {
      this.loadIssueOptions();
    }

    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
      console.log("[IssueDetails.vue] Posted vueAppReady message");
    }
  },
  beforeDestroy() {
    // Remove event listener when component is destroyed
    document.removeEventListener('click', this.closeTypeDropdown);
    document.removeEventListener('click', this.handleClickOutsideAddForm);
  }
};
</script>

<style>
/* =================== Existing IssueDetails.vue styles =================== */
.edit-button {
  background: none;
  border: none;
  cursor: pointer;
  margin-right: 0px;
  padding: 2px 5px;
  border-radius: 3px;
  opacity: 0.7;
  transition: opacity 0.2s, background-color 0.2s;
  color: aliceblue;
}

.edit-button:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}

.edit-button.cancel-button,
.edit-button.save-button {
  padding: 2px 6px;
  height: 24px;
  font-size: 0.85em;
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

/* =================== "Open in Browser" button from IssueDetails.vue =================== */
.open-in-browser-button {
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, white);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.9em;
  cursor: pointer;
  margin-bottom: 4px;
  align-self: flex-start;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.open-in-browser-button:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

.open-in-browser-button.compact-button {
  padding: 2px 6px;
  font-size: 0.8em;
  margin-left: 4px;
}

/* =================== Templated Fields (optional extra styling) =================== */
.templated-field-value {
  color: white;
  font-size: 1em;
  font-weight: bold;
}


/* =================== Merged global.css =================== */

/* Common container styling to match VS Code Explorer */
#app {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground, #cccccc);
  margin: 0;
  padding: 0 0 0 14px;
  /* Left indent to match Explorer */
  box-sizing: border-box;
  max-width: 100%;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Component Item styling */
.component-item {
  padding: 0;
}

.component-item:last-child {
  border-bottom: none;
}

/* Clickable row styling in Explorer */
.component-title-line {
  cursor: pointer;
  display: flex;
  padding: 4px 0 4px 8px;
  width: 100%;
  box-sizing: border-box;
}

.component-title-line:hover {
  background-color: var(--vscode-list-hoverBackground, #2a2d2e);
}

.component-name {
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.component-versions {
  margin-left: 8px;
  font-style: italic;
  color: var(--vscode-foreground, #cccccc);
}

.component-description {
  color: #999999;
  margin-left: 8px;
  margin-top: 2px;
  font-size: 0.9rem;
}

/* Duplicate .component-title-line already defined above */
.component-title-line {
  display: flex;
  align-items: center;
}

/* Issue Icon (legacy styling, not used with icon stacking) */
.issue-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

/* =================== Issue Details Styling =================== */
.issue-details {
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: 1.5;
  padding: 0 !important;
  margin: 0 !important;
  height: 100%;
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

.issue-container {
  display: flex;
  flex-direction: column;
  padding: 5px 5px 5px 0px;
  gap: 5px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

/* -------- Issue Header (used in IssueDetails.vue) -------- */
.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  width: 100%;
}

.issue-title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.issue-id {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.85em;
  opacity: 0.8;
  color: var(--vscode-descriptionForeground);
}

/* =================== Sections =================== */
.issue-sections {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.info-section {
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-editor-lineHighlightBorder, rgba(255, 255, 255, 0.1));
  padding: 6px 0;
}

.info-section[v-if="issue.body"] {
  padding-top: 4px;
  padding-bottom: 4px;
}

.info-section[v-if="issue.body"] .section-header {
  margin-bottom: 4px;
}

.section-header {
  font-weight: 600;
  font-size: 0.95em;
  color: var(--vscode-foreground);
  margin-bottom: 8px;
  margin-left: 10px;
  padding-right: 10px;
  white-space: nowrap;
  min-width: auto;
}

.section-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 10px;
  padding-right: 10px;
}

/* =================== Badge Styling =================== */
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
  color: white;
  gap: 3px;
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
  white-space: nowrap;
  gap: 3px;
  min-width: fit-content;
}

.state-open {
  color: #2ea043;
}

.state-completed,
.state-not-planned {
  color: #f85149;
}

.priority-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: normal;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
}

.priority-icon {
  width: 16px;
  height: 16px;
  opacity: 0.9;
  margin-right: 6px;
}

.label-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.9em;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
  white-space: nowrap;
}

/* =================== Entity Badges =================== */
.entity-badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.9em;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
  white-space: nowrap;
}

.component-badge {
  color: #f664e0;
}

.component-version-badge {
  color: #4fc3f7;
}

.project-badge {
  color: #81c784;
}

.interface-badge {
  color: #ffb74d;
}

.interface-part-badge {
  color: #ff8a65;
}

.generic-entity-badge {
  color: #bdbdbd;
}

/* =================== Date Section =================== */
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

/* =================== Description =================== */
.description-content {
  display: block;
  padding-right: 10px;
}

.description-text {
  white-space: pre-wrap;
  padding: 0;
  margin-bottom: 0;
}

.description-text p {
  margin-top: 4px;
  margin-bottom: 4px;
}

.description-text>*:last-child {
  margin-bottom: 0;
}

/* =================== Relations =================== */
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
  display: flex;
  align-items: center;
  justify-content: space-between; /* space-between pushes them apart */
  gap: 8px;
  padding: 4px 0; /* optional spacing */
}

.relation-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.relations-group .relation-item {
  justify-content: flex-start !important;
}

.relation-content {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1; /* push the button to the far right */
}

.remove-relation-button {
  display: inline-flex;            /* So we can center the X */
  align-items: center;
  justify-content: center;
  width: 24px;                     /* Circle dimensions */
  height: 24px;
  border-radius: 50%;             /* Makes the shape round */
  background: none;
  border: none;
  color: #d6bee4 !important;      /* Your desired color for the X */
  cursor: pointer;
  font-size: 1em;
  margin: 0;
  padding: 0;
  transition: background-color 0.2s ease;
  margin-left: -4px; /* adjust this value as needed */
}

.remove-relation-button:hover {
  background-color: rgba(255, 255, 255, 0.1); /* Slightly gray/white background */
}

/* =================== Empty and Error States =================== */
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
  gap: 5px;
  padding-right: 10px;
}

.section-header {
  font-weight: bold;
  color: white;
}

.inline-content {
  margin-bottom: 0;
}

.section-content.inline-content {
  margin-left: 0;
  padding-left: 0;
  flex: 1;
  min-width: 80px;
}

/* =================== Affected Entities =================== */
.affected-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 8px;
}

.affected-group-inline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.affected-group-header {
  font-size: 0.85em;
  font-weight: 500;
  white-space: nowrap;
  color: var(--vscode-descriptionForeground);
}

.affected-items-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.affected-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* =================== Markdown Styling =================== */
.markdown-content {
  color: var(--vscode-foreground);
  line-height: 1.5;
}

.markdown-content ul,
.markdown-content ol {
  padding-left: 0.5em;
  margin: 0.5em 0;
}

.markdown-content ul li {
  list-style-type: disc;
  margin-left: 0;
  padding-left: 0;
}

.markdown-content ol li {
  list-style-type: decimal;
  margin-left: 0;
  padding-left: 0;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: bold;
}

.markdown-content code {
  font-family: var(--vscode-editor-font-family, monospace);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.markdown-content pre {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 1em;
  border-radius: 4px;
  overflow: auto;
  margin: 0.5em 0;
}

.markdown-content pre code {
  background-color: transparent;
  padding: 0;
}

.markdown-content p {
  margin: 0.5em 0;
}

.markdown-content a {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.markdown-content blockquote {
  padding-left: 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--vscode-editor-lineHighlightBorder);
  color: var(--vscode-descriptionForeground);
}

.description-text {
  white-space: normal;
  padding: 4px 0;
}

.description-text h1,
.description-text h2,
.description-text h3 {
  margin-top: 16px;
  margin-bottom: 8px;
}

.description-text ul,
.description-text ol {
  margin-left: 20px;
  margin-bottom: 16px;
}

.description-text code {
  font-family: var(--vscode-editor-font-family);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 4px;
  border-radius: 3px;
}

.description-text pre {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

/* =================== Horizontal Section =================== */
.horizontal-section {
  flex-direction: row !important;
  justify-content: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.section-group {
  flex: 0 0 auto;
}

.section-group:nth-child(2) {
  min-width: 100px;
  /* Ensure enough width for "Completed" */
}

.section-group:first-child {
  flex: 0 0 auto;
  max-width: 40%;
}

/* =================== Artifacts Section =================== */
.artifacts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
}

.artifact-item {
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  cursor: pointer;
  transition: background-color 0.2s;
}

.artifact-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.artifact-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifact-file {
  font-size: 0.95em;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.artifact-file strong {
  color: var(--vscode-foreground);
}

.line-numbers {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
}

.artifact-version {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}

.artifact-fields {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.artifact-field {
  font-size: 0.85em;
  color: var(--vscode-foreground);
  opacity: 0.9;
  padding: 2px 0;
}

.field-name {
  font-weight: bold;
  color: var(--vscode-descriptionForeground);
  margin-right: 4px;
}

.no-artifacts {
  font-style: italic;
  color: var(--vscode-descriptionForeground);
  margin-top: 10px;
  text-align: center;
  padding: 12px;
  background-color: rgba(30, 30, 30, 0.2);
  border-radius: 4px;
}

.artifact-hint {
  font-size: 0.85em;
  margin-top: 6px;
  opacity: 0.8;
}

.create-artifact-button {
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, white);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.9em;
  cursor: pointer;
  margin-bottom: 4px;
  align-self: flex-start;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.create-artifact-button:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

.button-icon {
  font-size: 14px;
  font-weight: bold;
}

/* =================== IssueDetails.vue Icon Stack Styling =================== */
/* Used to overlay the relation icons on top of the type icon */
.icon-stack {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.base-icon,
.overlay-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  object-fit: contain;
}

.overlay-icon {
  position: absolute;
  top: 0;
  left: 0;
}

/* Dropdown styling */
.select-container {
  position: relative;
  cursor: pointer;
}

.dropdown-arrow {
  margin-left: 6px;
  font-size: 10px;
  opacity: 0.7;
}

.dropdown-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.select-container:hover .dropdown-arrow {
  opacity: 1;
}

.field-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background-color: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  margin-top: 4px;
}

.dropdown-loading {
  padding: 8px 12px;
  font-style: italic;
  color: var(--vscode-descriptionForeground);
}

.dropdown-options {
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-option {
  padding: 6px 12px;
  display: flex;
  align-items: center;
  transition: background-color 0.2s;
}

.dropdown-option:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.type-icon-small {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.state-option-open {
  color: #2ea043;
}

.state-option-closed {
  color: #f85149;
}

.title-container {
  flex: 1;
  min-width: 0;
  display: flex;
}

.title-display {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  /* Allow flex shrinking */
  gap: 2px;
  width: 100%;
}

.title-edit-container {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.title-edit-input {
  flex: 1;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-focusBorder, #0078d4);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 1.15em;
  height: 24px;
}

/* Compact Open in Browser Button */
.compact-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 0.85em;
  height: 24px;
  cursor: pointer;
  white-space: nowrap;
}

.compact-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

.title-edit-button {
  margin-left: 4px;
  flex-shrink: 0;
}

.flex-spacer {
  min-width: 4px;
  flex-grow: 0.2;
}

/* =================== Assignments Styling =================== */
.assignments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.assignment-item {
  display: flex;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
}

.assignment-content {
  width: 100%;
}

.assignment-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.user-name {
  flex-grow: 1;
  font-weight: 500;
  margin-right: 8px;
}

.assignment-type-badge {
  background-color: rgba(0, 0, 0, 0.2);
  color: var(--vscode-foreground);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 0.7em;
  margin-left: auto;
  cursor: pointer;
}

.no-assignments {
  font-style: italic;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  padding: 4px 12px;
  background-color: rgba(30, 30, 30, 0.2);
  border-radius: 4px;
  margin: 0;
}

.no-assignments p {
  margin: 4px 0;
}

.assignment-type-header {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vscode-descriptionForeground);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #0066aa;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  margin-right: 8px;
}

.assignment-user {
  display: flex;
  align-items: center;
  width: 100%;
}

.assignment-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  gap: 8px;
}

.remove-button {
  background: none;
  border: none;
  cursor: pointer;
  margin-right: 0px;
  padding: 2px 5px;
  border-radius: 3px;
  opacity: 0.7;
  transition: opacity 0.2s, background-color 0.2s;
  color: aliceblue;
  font-size: 12px;
}

.remove-button:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}

.search-container {
  position: relative;
  margin-bottom: 10px;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-input-border);
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 3px;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 150px;
  overflow-y: auto;
  background-color: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 0 0 3px 3px;
  z-index: 10;
}

.search-result-item {
  padding: 6px 8px;
  cursor: pointer;
}

.search-result-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.type-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 150px;
  background-color: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  margin-top: 4px;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
}

.type-option {
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.type-option:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.no-type-option {
  border-top: 1px solid var(--vscode-panel-border);
  font-style: italic;
  color: var(--vscode-descriptionForeground);
}

.assignments-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
  position: relative;
}

.search-container {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-input-border);
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 3px;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 150px;
  overflow-y: auto;
  background-color: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 0 0 3px 3px;
  z-index: 100;
}

.search-result-item {
  padding: 6px 8px;
  cursor: pointer;
}

.search-result-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

/* Issue graph */

.showGraph {
  position:relative;
}
.graph-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
}
.graph-button:hover{
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}
</style>