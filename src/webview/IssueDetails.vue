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
          <IssueIcon :issue="issue" class="issue-icon" />
          <img class="overlay-icon" .src="getRelationalIconPathFor(issue)" alt="" />
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
                    <IssueIcon :issue="issue" class="issue-icon2" />
                    {{ issue.type.name }}
                    <span class="dropdown-arrow">▼</span>
                  </div>

                  <div v-if="showTypeDropdown" class="field-dropdown">
                    <div v-if="issueOptions.types.length === 0" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="type in issueOptions.types" :key="type.id" @click.stop="changeIssueType(type.id)"
                        class="dropdown-option">
                        <IssueTypeIcon :path="getTypeIconForOption(type)" :fill="getStateForOption()"
                          class="type-icon-small" />
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
        <div class="info-section" v-if="issue">
          <div class="section-header-row" style="justify-content: space-between;">
            <div class="section-header">Labels:</div>
            <!-- Buttons for label editing and adding -->
            <div style="display: flex; gap: 4px;">
              <!-- Toggle label edit mode -->
              <button class="edit-button" @click="toggleEditLabels" title="Edit Labels">
                <span class="edit-icon">✎</span>
              </button>
              <!-- + button toggles the new label dropdown -->
              <button class="remove-relation-button" @click.stop="toggleNewLabelDropdown" title="Add Label">
                <span class="edit-icon">+</span>
              </button>
            </div>
          </div>
          <div class="section-content inline-content labels-row" style="margin-left: 20px;">
            <!-- Show delete button for each label if editing is enabled -->
            <template v-if="editingLabels">
              <div v-for="(label, index) in issue.labels.nodes" :key="index" class="badge label-badge"
                :style="{ backgroundColor: label.color || 'rgba(0, 0, 0, 0.2)', color: '#ffffff' }"
                :title="label.description">
                {{ label.name }}
                <button class="remove-relation-button" @click.stop="removeLabel(label)" title="Remove Label">X</button>
              </div>
            </template>
            <!-- Otherwise simply show the labels -->
            <template v-else>
              <div v-for="(label, index) in issue.labels.nodes" :key="index" class="badge label-badge"
                :style="{ backgroundColor: label.color || 'rgba(0, 0, 0, 0.2)', color: '#ffffff' }"
                :title="label.description">
                {{ label.name }}
              </div>
            </template>
          </div>
          <!-- New Label Dropdown with Search Field -->
          <div v-if="newLabelDropdownVisible" class="field-dropdown" style="position: relative;">
            <div v-if="showNewLabelModal" class="create-label-form">
              <div class="label-form-header">Create New Label</div>

              <label>Name:</label>
              <input type="text" v-model="newLabelName" class="label-input" placeholder="Label name" />

              <label>Description:</label>
              <input type="text" v-model="newLabelDescription" class="label-input" placeholder="Label description" />

              <label>Color:</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <!-- Color picker input -->
                <input type="color" v-model="newLabelColor" class="label-input"
                  style="padding: 0; width: 40px; height: 40px;" />
                <!-- Text input to show/paste the color value -->
                <input type="text" v-model="newLabelColor" class="label-input" placeholder="#ffffff"
                  style="max-width: 100px;" />
              </div>

              <div class="label-form-actions">
                <button @click="cancelCreateLabel">Cancel</button>
                <button @click="createLabel">Create Label</button>
              </div>
            </div>
            <div v-else>
              <!-- New "Create new" option -->
              <div class="dropdown-option" @click.stop="openCreateNewLabelModal"
                style="font-weight: bold; cursor: pointer;">
                Create new
              </div>
              <!-- Existing search field -->
              <input type="text" v-model="labelSearchQuery" placeholder="Search labels..."
                class="dropdown-search-input" />
              <!-- Existing dropdown options -->
              <div v-if="labelsLoading" class="dropdown-loading">Loading...</div>
              <div v-else-if="filteredLabels.length === 0" class="dropdown-loading">No labels found</div>
              <div v-else class="dropdown-options">
                <div v-for="label in filteredLabels" :key="label.id" class="dropdown-option"
                  @click.stop="selectNewLabel(label)" style="display: flex; align-items: center; gap: 4px;">
                  <div class="badge label-badge"
                    :style="{ backgroundColor: label.color || 'rgba(0,0,0,0.2)', color: '#ffffff' }">
                    {{ label.name }}
                  </div>
                  <span class="label-description" style="color: #ffffff;">
                    {{ label.description }}
                  </span>
                </div>
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
                <div class="relations-subheader"
                  style="display: flex; align-items: center; justify-content: space-between;">
                  <span>Outgoing Relations</span>
                  <div>
                    <!-- Edit toggle button -->
                    <button class="edit-button" @click="editingOutgoingRelations = !editingOutgoingRelations"
                      :title="editingOutgoingRelations ? 'Done editing relations' : 'Edit outgoing relations'">
                      <span class="edit-icon">✎</span>
                    </button>
                    <!-- New "Add Outgoing Relation" button -->
                    <button class="remove-relation-button" @click.stop="toggleNewRelationDropdown"
                      title="Add Outgoing Relation" style="margin-left: 4px;">
                      <span class="edit-icon">+</span>
                    </button>
                  </div>
                </div>

                <!-- Candidate Issues Dropdown: Shown when no new relation is selected -->
                <div v-if="newRelationDropdownVisible && !newOutgoingRelation" class="field-dropdown"
                  style="position: absolute; top: 100%; right: 0; z-index: 1000; background: var(--vscode-dropdown-background);">
                  <div v-if="newRelationIssues.length === 0" class="dropdown-loading">No issues found</div>
                  <div v-else class="dropdown-options">
                    <div v-for="issue in newRelationIssues" :key="issue.id" class="dropdown-option"
                      @click.stop="selectNewRelationIssue(issue)" style="display: flex; align-items: center; gap: 6px;">
                      <div class="icon-stack">
                        <img class="base-icon" :src="getTypeIconPathFor(issue)" alt="Type icon" />
                        <img class="overlay-icon" :src="getRelationalIconPathFor(issue)" alt="Relation icon" />
                      </div>
                      <span>{{ issue.title }} ({{ issue.state.isOpen ? 'Open' : 'Closed' }})</span>
                    </div>
                  </div>
                </div>

                <!-- New Relation Info and Relation Type Dropdown: Shown once a candidate issue is selected -->
                <div v-if="newOutgoingRelation" class="new-outgoing-relation-container"
                  style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                  <div class="new-outgoing-issue-info" style="display: flex; align-items: center; gap: 6px;">
                    <div class="icon-stack">
                      <img class="base-icon" :src="getTypeIconPathFor(newOutgoingRelation)" alt="Type icon" />
                      <img class="overlay-icon" :src="getRelationalIconPathFor(newOutgoingRelation)"
                        alt="Relation icon" />
                    </div>
                    <span>{{ newOutgoingRelation.title }} ({{ newOutgoingRelation.state.isOpen ? 'Open' : 'Closed'
                    }})</span>
                  </div>
                  <!-- Dropdown for relation types -->
                  <div v-if="newRelationTypeDropdownVisible" class="field-dropdown" style="position: relative;">
                    <div v-if="relationTypesLoading" class="dropdown-loading">Loading...</div>
                    <div v-else class="dropdown-options">
                      <div v-for="type in relationTypes" :key="type.id" class="dropdown-option"
                        @click.stop="selectNewRelationType(type)" style="cursor: pointer;">
                        {{ type.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Existing outgoing relations section remains unchanged -->
              <template v-if="!editingOutgoingRelations">
                <div v-for="(relations, relType) in groupedOutgoingRelations" :key="'out-' + relType"
                  style="margin-bottom: 10px;">
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
                      <button v-if="editingOutgoingRelations" class="remove-relation-button"
                        @click.stop="onRemoveRelation(relation.id)" title="Remove Relation">
                        X
                      </button>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="relations-list">
                  <div v-for="item in flatOutgoingRelations" :key="item.relation.id" class="relation-item">
                    <div class="relation-content" @click="openRelatedIssue(item.relation.relatedIssue.id)"
                      style="display: flex; align-items: center;">
                      <div class="icon-stack">
                        <img class="base-icon" :src="getTypeIconPathFor(item.relation.relatedIssue)" alt="" />
                        <img class="overlay-icon" :src="getRelationalIconPathFor(item.relation.relatedIssue)" alt="" />
                      </div>
                      <div style="display: flex; flex-direction: column; margin-left: 8px;">
                        <span>{{ item.relation.relatedIssue.title }}</span>
                        <span class="relation-type-inline" style="font-size: 0.85em; color: #ccc;">
                          {{ item.relType }}
                        </span>
                        <div v-if="currentlyEditingRelation === item.relation.id" class="field-dropdown"
                          style="margin-top: 4px;">
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
                    <button class="edit-button title-edit-button" @click.stop="triggerEditRelation(item.relation.id)"
                      title="Edit relation type">
                      <span class="edit-icon">✎</span>
                    </button>
                    <button class="remove-relation-button" @click.stop="onRemoveRelation(item.relation.id)"
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
              <div v-for="(issues, relType) in groupedIncomingRelations" :key="'in-' + relType"
                style="margin-bottom: 10px;">
                <!-- Show the relation type -->
                <div class="relation-type-header" style="font-weight: 600; margin-bottom: 4px;">
                  {{ relType }}
                </div>

                <div class="relations-list">
                  <div v-for="issueData in issues" :key="issueData.id" class="relation-item"
                    @click="openRelatedIssue(issueData.id)" style="display: flex; align-items: center; gap: 8px;">
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
            <div>
              <button v-if="expandedSections.artifacts" class="artifact-button create-button"
                @click.stop="createArtifact" title="Create new artifact from selected code">
                Create
              </button>
              <button v-if="expandedSections.artifacts" class="artifact-button add-button"
                @click.stop="toggleAddArtifactDropdown" title="Add existing artifact to this issue">
                Add
              </button>
              <span class="toggle-icon">{{ expandedSections.artifacts ? '▼' : '▶' }}</span>
            </div>
          </div>

          <div v-if="showAddArtifactDropdown && expandedSections.artifacts" class="add-artifact-dropdown">
            <div class="dropdown-header">
              <span>Select an artifact to add:</span>
              <button class="close-dropdown-button" @click.stop="closeAddArtifactDropdown">×</button>
            </div>

            <div v-if="availableArtifacts.length === 0 && !artifactsLoading" class="no-artifacts-message">
              <p>No standalone artifacts available to add to this issue.</p>
              <p class="artifact-hint">Standalone artifacts must first be created for related components or projects
                before they
                can be added here.</p>
            </div>

            <div v-else-if="artifactsLoading" class="loading-artifacts">
              <p>Loading available artifacts...</p>
            </div>

            <div v-else class="artifact-dropdown-options">
              <div v-for="artifact in availableArtifacts" :key="artifact.id" class="artifact-dropdown-option"
                @click="selectAndAddArtifact(artifact)">
                <div class="artifact-option-content">
                  <div class="artifact-file-name">
                    {{ getFileName(artifact.file) }}
                    <span class="line-numbers" v-if="artifact.from && artifact.to">
                      (Lines {{ artifact.from }}-{{ artifact.to }})
                    </span>
                  </div>
                  <div class="artifact-option-details">
                    <span v-if="artifact.trackable" class="artifact-trackable-label">
                      {{ artifact.trackable.name }}
                    </span>
                    <span v-if="artifact.version" class="artifact-version-label">
                      v{{ artifact.version }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-content" v-if="expandedSections.artifacts">
            <div v-if="issue.artifacts && issue.artifacts.length > 0" class="artifacts-list">
              <div v-for="artifact in issue.artifacts" :key="artifact.id" class="artifact-item">
                <!-- X button positioned absolutely in the top right corner -->
                <button class="remove-relation-button" @click.stop="confirmRemoveArtifact(artifact)"
                  title="Remove artifact from this issue">
                  X
                </button>

                <div class="artifact-content" @click="openArtifactFile(artifact)">
                  <!-- File name and line numbers on first line with X button -->
                  <div class="artifact-file">
                    <div class="artifact-file-line">
                      <strong>{{ getFileName(artifact.file) }}</strong>
                      <span class="line-numbers" v-if="artifact.from && artifact.to">
                        (Lines {{ artifact.from }}-{{ artifact.to }})
                      </span>
                    </div>
                  </div>

                  <!-- Version info on second line if needed -->
                  <div class="artifact-version" v-if="artifact.version">
                    Version: {{ artifact.version }}
                  </div>

                  <!-- Additional fields if available -->
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
import IssueIcon from '@/issueIcons/IssueIcon.vue';
import IssueTypeIcon from '@/issueIcons/IssueTypeIcon.vue';
let vscode;

export default {
  name: "IssueDetails",
  components: {
    IssueIcon,
    IssueTypeIcon
  },
  data() {
    return {
      showAddArtifactDropdown: false,
      availableArtifacts: [],
      artifactsLoading: false,
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
      relationTypesLoading: false,
      newLabelDropdownVisible: false,
      allLabels: [],
      labelsLoading: false,
      editingLabels: false,
      labelSearchQuery: "",
      showNewLabelModal: false,
      newLabelName: '',
      newLabelDescription: '',
      newLabelColor: '#0c94d8',
    };
  },
  computed: {
    filteredLabels() {
      // Ensure that availableLabels has been computed and that labelSearchQuery is available
      return this.availableLabels.filter(label => {
        return label.name.toLowerCase().includes(this.labelSearchQuery.toLowerCase());
      });
    },
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
    availableLabels() {
      // If no labels have been fetched, return an empty array.
      if (!this.allLabels || this.allLabels.length === 0) {
        return [];
      }
      // Build a set of identifiers already present on the issue.
      const existing = new Set();
      if (this.issue &&
        this.issue.labels &&
        this.issue.labels.nodes &&
        this.issue.labels.nodes.length > 0) {
        this.issue.labels.nodes.forEach(label => {
          if (label && label.id) {  // ensure label and label.id exist
            existing.add(label.id);
          } else if (label && label.name) {
            existing.add(label.name);
          }
        });
      }
      // Filter: only show labels that do not exist on the issue.
      const filtered = this.allLabels.filter(label => {
        return label.id && !existing.has(label.id);
      });
      console.log("[availableLabels] All fetched labels:", this.allLabels);
      console.log("[availableLabels] Labels already on issue:", Array.from(existing));
      console.log("[availableLabels] Filtered (to be shown):", filtered);
      return filtered;
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
    /**
 * Toggles the Add Artifact dropdown and loads available artifacts
 */
    toggleAddArtifactDropdown(event) {
      if (event) event.stopPropagation();

      if (this.showAddArtifactDropdown) {
        this.closeAddArtifactDropdown();
        return;
      }

      this.showAddArtifactDropdown = true;
      this.availableArtifacts = [];
      this.loadAvailableArtifacts();

      // Add click-outside handler to close the dropdown
      this.$nextTick(() => {
        document.addEventListener('click', this.handleClickOutsideArtifactDropdown);
      });
    },/**
 * Closes the Add Artifact dropdown
 */
    closeAddArtifactDropdown() {
      this.showAddArtifactDropdown = false;
      document.removeEventListener('click', this.handleClickOutsideArtifactDropdown);
    },

    /**
     * Handles clicks outside the artifact dropdown to close it
     */
    handleClickOutsideArtifactDropdown(event) {
      const dropdown = this.$el.querySelector('.add-artifact-dropdown');
      const button = this.$el.querySelector('.add-button');

      if (dropdown && button &&
        !dropdown.contains(event.target) &&
        !button.contains(event.target)) {
        this.closeAddArtifactDropdown();
      }
    },

    /**
     * Loads available artifacts that can be added to this issue
     */
    loadAvailableArtifacts() {
      if (!this.issue || !this.issue.id) {
        console.error("Cannot load artifacts: Missing issue ID");
        return;
      }

      // Get trackable IDs from the issue
      const trackableIds = this.getIssueTrackableIds();
      if (trackableIds.length === 0) {
        console.warn("No trackables found for this issue");
        return;
      }

      this.artifactsLoading = true;

      if (vscode) {
        console.log('[IssueDetails.vue] Requesting available artifacts for trackables:', trackableIds);
        vscode.postMessage({
          command: 'getAvailableArtifacts',
          trackableIds: trackableIds,
          issueId: this.issue.id
        });
      }
    },

    /**
     * Extracts trackable IDs from the issue
     */
    getIssueTrackableIds() {
      const trackableIds = [];

      // First check direct trackables field
      if (this.issue.trackables && this.issue.trackables.nodes) {
        for (const node of this.issue.trackables.nodes) {
          if (node && node.id) {
            trackableIds.push(node.id);
          }
        }
      }

      // Then check affects relation for components and projects
      if (this.issue.affects && this.issue.affects.nodes) {
        for (const node of this.issue.affects.nodes) {
          if (node.__typename === 'Component' || node.__typename === 'Project') {
            if (node.id && !trackableIds.includes(node.id)) {
              trackableIds.push(node.id);
            }
          } else if (node.__typename === 'ComponentVersion' && node.component) {
            if (node.component.id && !trackableIds.includes(node.component.id)) {
              trackableIds.push(node.component.id);
            }
          }
        }
      }

      return trackableIds;
    },

    /**
     * Selects and immediately adds an artifact to the issue
     */
    selectAndAddArtifact(artifact) {
      if (!artifact || !artifact.id || !this.issue || !this.issue.id) {
        console.error("Cannot add artifact: Missing artifact ID or issue ID");
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'addArtifactToIssue',
          input: {
            issue: this.issue.id,
            artefact: artifact.id
          }
        });
      }

      // Close the dropdown
      this.closeAddArtifactDropdown();
    },

    openCreateNewLabelModal() {
      this.showNewLabelModal = true;
      // Optionally close the dropdown search if desired:
      // this.newLabelDropdownVisible = false;
    },
    cancelCreateLabel() {
      this.showNewLabelModal = false;
      this.newLabelName = '';
      this.newLabelDescription = '';
      this.newLabelColor = '#0c94d8';
    },
    async createLabel() {
      if (!this.newLabelName || !this.newLabelDescription || !this.newLabelColor) {
        alert("Please fill in all fields.");
        return;
      }
      if (vscode) {
        vscode.postMessage({
          command: 'createNewLabel',
          data: {
            name: this.newLabelName,
            description: this.newLabelDescription,
            color: this.newLabelColor
          }
        });
      }
      // Close the creation form and reset fields
      this.cancelCreateLabel();
    },
    // Toggle whether the labels are in edit mode
    toggleEditLabels() {
      this.editingLabels = !this.editingLabels;
    },
    // Called when a delete button is clicked on a label in edit mode
    removeLabel(label) {
      if (!label || !label.id) {
        console.error("Cannot remove label – label or its id is missing.");
        return;
      }
      console.log("Removing label:", label);
      if (vscode) {
        vscode.postMessage({
          command: 'removeLabelFromIssue',
          input: {
            issue: this.issue.id,  // The ID of the issue in view
            label: label.id        // The ID of the label (must not be null)
          }
        });
      }
      // Optionally, update the client UI immediately:
      this.issue.labels.nodes = this.issue.labels.nodes.filter(l => l && l.id !== label.id);
    },
    // Toggle the label dropdown
    toggleNewLabelDropdown() {
      if (this.newLabelDropdownVisible) {
        // If already visible, close it.
        this.newLabelDropdownVisible = false;
      } else {
        this.labelsLoading = true;
        this.newLabelDropdownVisible = true;
        console.log("[toggleNewLabelDropdown] Requesting all labels from extension");
        // Request all labels from your extension including originComponentId.
        if (vscode) {
          vscode.postMessage({
            command: 'getAllLabels',
            originComponentId: this.originComponentId, // Pass the originComponentId here
            first: 20,
            query: "*",
            skip: 0
          });
        }
      }
    },
    // Called when a label is selected from the dropdown
    selectNewLabel(label) {
      console.log("Selected label:", label);
      if (vscode) {
        vscode.postMessage({
          command: 'addLabelToIssue',
          input: {
            issue: this.issue.id,  // Use the id of the issue displayed in the issue details
            label: label.id        // Use the id from the fetched labels
          }
        });
      }
      this.newLabelDropdownVisible = false;
      // Optionally trigger a refresh to update the labels shown in the issue details:
      if (vscode) {
        vscode.postMessage({ command: 'refreshCurrentIssue' });
      }
    },
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
      if (vscode) {
        vscode.postMessage({
          command: 'createIssueRelation',
          input: {
            issue: this.issue.id,                   // ID of the current issue
            issueRelationType: type.id,               // Selected relation type ID
            relatedIssue: this.newOutgoingRelation.id // ID of the candidate issue
          }
        });
      }
      // Collapse the relation type dropdown and clear the candidate selection
      this.newRelationTypeDropdownVisible = false;
      this.newOutgoingRelation = null;
      // Optionally, trigger a refresh of outgoing relations
      if (vscode) {
        vscode.postMessage({ command: 'refreshOutgoingRelations' });
      }
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
    },/**
 * Confirms with the user before removing an artifact from the issue
 */
    confirmRemoveArtifact(artifact) {
      if (!artifact || !artifact.id || !this.issue || !this.issue.id) {
        console.error("Cannot remove artifact: Missing artifact ID or issue ID");
        return;
      }

      this.removeArtifactFromIssue(artifact.id);
    },

    /**
     * Removes an artifact from the issue
     */
    removeArtifactFromIssue(artifactId) {
      if (!artifactId || !this.issue || !this.issue.id) {
        console.error("Cannot remove artifact: Missing artifact ID or issue ID");
        return;
      }

      if (vscode) {
        vscode.postMessage({
          command: 'removeArtifactFromIssue',
          input: {
            issue: this.issue.id,
            artefact: artifactId
          }
        });
      }
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
      console.log("[IssueDetails.vue] Attempting to open artifact:", artifact);

      // Comprehensive null/undefined checks
      if (!artifact) {
        console.error("Cannot open artifact: artifact is null or undefined");
        return;
      }

      // Ensure artifact has the necessary properties
      if (!artifact.file) {
        console.error("Cannot open artifact: missing file path", artifact);
        return;
      }

      if (vscode) {
        // Prepare artifact data with fallback values
        const artifactData = {
          file: artifact.file,
          from: artifact.from || 1,
          to: artifact.to || undefined,
          id: artifact.id || ''
        };

        console.log("[IssueDetails.vue] Sending artifact file data:", artifactData);

        vscode.postMessage({
          command: 'openArtifactFile',
          artifactData: artifactData,
          sourceIssueId: this.issue ? this.issue.id : null
        });
      } else {
        console.error("[IssueDetails.vue] vscode API not available");
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
          return "M 50 15.625 C 58.6294 15.625 65.625 22.6206 65.625 31.25 C 65.625 32.3199 65.5175 33.3648 65.3126 34.3742 C 65.7837 34.7252 66.2367 35.107 66.6666 35.513 L 77.6114 25.7893 L 81.7636 30.4607 L 70.2836 40.6668 C 71.1084 42.5697 71.5656 44.669 71.5656 46.875 C 71.5656 47.6383 71.5096 48.4002 71.3984 49.1547 L 84.934 51.6129 L 83.816 57.7621 L 70.191 55.2813 L 68.3254 64.6063 L 80.5257 79.2494 L 75.7243 83.2506 L 65.7441 71.2773 C 62.9055 75.4551 58.1234 78.125 52.8156 78.125 L 47.1844 78.125 C 41.8752 78.125 37.0921 75.4537 34.2537 71.2742 L 24.2757 83.2506 L 19.4743 79.2494 L 31.6722 64.6063 L 29.8066 55.2813 L 16.184 57.7621 L 15.066 51.6129 L 28.6015 49.1561 C 28.16 46.1813 28.594 43.2594 29.7194 40.6663 L 18.2364 30.4607 L 22.3886 25.7893 L 33.3272 35.5161 C 33.7582 35.1081 34.2134 34.7237 34.6913 34.3653 C 34.4821 33.3608 34.375 32.3179 34.375 31.25 C 34.375 22.6206 41.3706 15.625 50 15.625 Z M 64.5719 43.2094 L 64.3533 42.7331 C 64.3059 42.6369 64.2569 42.5417 64.2063 42.4474 L 64.3525 42.7314 C 64.273 42.5703 64.189 42.4119 64.1007 42.2562 L 64.2063 42.4474 C 64.1192 42.2852 64.0274 42.1258 63.9313 41.9695 L 64.1007 42.2562 C 64.0111 42.0981 63.9169 41.943 63.8185 41.7908 L 63.9313 41.9695 C 63.8472 41.8328 63.7597 41.6984 63.6689 41.5665 L 63.8185 41.7908 C 63.6999 41.6073 63.575 41.4282 63.4441 41.2538 L 63.6689 41.5665 C 63.5677 41.4195 63.4625 41.2756 63.3533 41.1348 L 63.4441 41.2538 C 63.3406 41.1159 63.2334 40.9809 63.1226 40.849 L 63.3533 41.1348 C 63.2472 40.9979 63.1373 40.8641 63.0239 40.7333 L 62.6891 40.3694 L 62.6891 40.3694 C 62.4039 40.0732 62.0993 39.7958 61.7775 39.5392 C 61.724 39.4957 61.6705 39.454 61.6166 39.4129 L 61.6167 39.4138 L 61.3041 39.1849 C 61.2357 39.1371 61.1667 39.0902 61.097 39.0442 L 60.7513 38.8268 C 60.6863 38.7878 60.6208 38.7497 60.5548 38.7123 L 60.7499 38.8263 C 60.5929 38.7322 60.4329 38.6426 60.2701 38.5577 L 60.5548 38.7123 C 60.3706 38.6079 60.1825 38.5096 59.9908 38.4176 L 60.2701 38.5577 C 60.0853 38.4612 59.8968 38.3708 59.705 38.2865 L 59.7036 38.2858 L 59.4443 38.1767 C 59.4277 38.17 59.4111 38.1633 59.3945 38.1568 L 59.1603 38.0675 L 59.1603 38.0675 L 58.8726 37.9676 C 58.8497 37.9601 58.8267 37.9526 58.8038 37.9453 C 58.6626 37.9001 58.522 37.8587 58.3802 37.8206 L 58.8038 37.9453 C 58.6003 37.8801 58.3939 37.8217 58.1847 37.7703 L 57.6142 37.649 C 57.5915 37.6449 57.5688 37.6409 57.5461 37.6369 L 57.6146 37.649 C 57.4203 37.614 57.2239 37.585 57.0256 37.5621 L 57.5461 37.6369 C 57.2006 37.5773 56.8487 37.5366 56.4914 37.5159 L 55.9406 37.5 L 44.0594 37.5 C 43.7266 37.5 43.3942 37.5177 43.0637 37.553 C 43.0644 37.5579 43.0653 37.5589 43.0662 37.5599 L 42.7041 37.5985 L 42.7041 37.5985 L 42.2208 37.6821 L 42.2208 37.6821 L 41.6173 37.8233 C 41.5677 37.8366 41.5184 37.8503 41.4692 37.8644 C 41.3176 37.9078 41.1667 37.9551 41.0177 38.006 L 41.4692 37.8644 C 41.0797 37.9759 40.7023 38.1111 40.3383 38.268 L 40.2982 38.2854 C 39.9383 38.4426 39.5917 38.6211 39.2595 38.819 C 39.2046 38.8517 39.1488 38.8857 39.0934 38.9203 L 39.2595 38.819 C 39.0964 38.9162 38.9367 39.0181 38.7807 39.1244 L 39.0934 38.9203 C 38.8677 39.0613 38.6489 39.2114 38.4374 39.37 L 38.4362 39.371 L 38.3298 39.452 C 38.2937 39.4799 38.2578 39.5081 38.2221 39.5365 L 38.0364 39.6884 L 38.0364 39.6884 L 37.8278 39.8689 C 37.7845 39.9075 37.7416 39.9464 37.6991 39.9857 L 37.6144 40.0651 L 37.6144 40.0651 L 37.4567 40.2181 C 37.4071 40.2674 37.358 40.3173 37.3095 40.3677 C 37.2567 40.4226 37.2048 40.4779 37.1536 40.5337 L 37.3095 40.3677 C 37.1804 40.5019 37.0553 40.6399 36.9345 40.7813 L 37.1536 40.5337 C 37.0168 40.6829 36.885 40.8364 36.7583 40.9938 L 36.9345 40.7813 C 36.8169 40.9189 36.7034 41.0599 36.5941 41.2039 L 36.7583 40.9938 C 36.4867 41.3313 36.2387 41.6872 36.0162 42.0586 C 35.9633 42.1468 35.9124 42.2349 35.863 42.3239 C 35.8119 42.4159 35.762 42.5092 35.7138 42.6033 L 35.863 42.3239 C 35.7853 42.4637 35.7111 42.6056 35.6405 42.7494 L 35.7138 42.6033 C 35.6292 42.7683 35.5494 42.9358 35.4746 43.1058 L 35.6405 42.7494 C 35.5502 42.9332 35.4659 43.1201 35.3877 43.3099 L 35.4746 43.1058 C 35.3924 43.2927 35.3161 43.4825 35.2461 43.6749 L 35.3877 43.3099 C 34.7718 44.8039 34.5355 46.4717 34.7741 48.1703 L 34.8665 48.7136 L 35.4472 51.6125 L 36.0597 54.6875 L 37.9915 64.3386 C 38.0442 64.6022 38.1077 64.8614 38.1814 65.1157 C 38.2209 65.252 38.2632 65.3863 38.3083 65.5191 L 38.1814 65.1157 C 38.2254 65.2674 38.273 65.4173 38.3241 65.5654 L 38.3083 65.5191 C 38.3642 65.6838 38.4244 65.8462 38.4889 66.0063 L 38.3241 65.5654 C 39.5533 69.1254 42.8239 71.6349 46.6292 71.8587 L 47.1844 71.875 L 52.8156 71.875 C 56.8837 71.875 60.4369 69.2611 61.7027 65.4866 C 61.7696 65.2871 61.8299 65.085 61.8837 64.8798 L 62.0085 64.3386 L 62.9993 59.375 L 63.0004 59.3719 L 65.1335 48.7136 C 65.2546 48.1082 65.3156 47.4924 65.3156 46.875 C 65.3156 45.7655 65.1228 44.701 64.769 43.7132 L 64.5719 43.2094 L 64.5719 43.2094 Z M 50 21.875 C 44.8223 21.875 40.625 26.0723 40.625 31.25 L 40.6377 31.6292 C 40.7562 31.6026 40.8754 31.5774 40.9951 31.5534 C 42.0041 31.3516 43.0305 31.25 44.0594 31.25 L 55.9406 31.25 C 57.1161 31.25 58.2613 31.3798 59.3626 31.6259 L 59.375 31.25 L 59.375 31.25 C 59.375 26.0723 55.1777 21.875 50 21.875 Z";
        case "Feature":
          return "m 40.625 81.25 h 18.75 v 6.25 h -18.75 z m 0 -9.375 h 18.75 v 6.25 H 40.625 Z M 50 12.5 c -15.496 0 -28.125 12.629 -28.125 28.125 c 0 15.496 12.629 28.125 28.125 28.125 c 15.496 0 28.125 -12.629 28.125 -28.125 c 0 -15.496 -12.629 -28.125 -28.125 -28.125 z m 0 6.25 c 12.1182 0 21.875 9.7568 21.875 21.875 c 0 12.1182 -9.7568 21.875 -21.875 21.875 c -12.1182 0 -21.875 -9.7568 -21.875 -21.875 c 0 -12.1182 9.7568 -21.875 21.875 -21.875 z";
        case "Misc":
        case "Task":
          return "m 46.875 62.5 h 6.25 v 6.25 h -6.25 z m 0 -31.25 h 6.25 v 25 H 46.875 Z M 50 15.625 C 31.0522 15.625 15.625 31.0522 15.625 50 C 15.625 68.9478 31.0522 84.375 50 84.375 C 68.9478 84.375 84.375 68.9478 84.375 50 C 84.375 31.0522 68.9478 15.625 50 15.625 Z m 0 6.25 c 15.57 0 28.125 12.555 28.125 28.125 c 0 15.57 -12.555 28.125 -28.125 28.125 c -15.57 0 -28.125 -12.555 -28.125 -28.125 c 0 -15.57 12.555 -28.125 28.125 -28.125 z";
        default:
          return new URL("../../resources/icons/bug-black.png", import.meta.url).href;
      }
    },

    getStateForOption() {
      const isOpen = this.issue.state && this.issue.state.isOpen;
      return Boolean(isOpen)
        ? "green"
        : "red";

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
        this.activeTypeDropdown = null; k
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
      } else if (message && message.command === 'assignmentTypesError') {
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
      } else if (message && message.command === "allLabelsLoaded") {
        console.log("[IssueDetails.vue] allLabelsLoaded received:", message.labels);
        this.labelsLoading = false;
        this.allLabels = message.labels;
      } else if (message && message.command === "allLabelsError") {
        console.error("Error loading labels:", message.error);
        this.allLabels = [];
      } else if (message.command === "addLabelToIssueError") {
        // Log the error and show a notification (if needed).
        // You might want to display a toast or simply log; VS Code has already shown a notification via the extension.
        console.error("Error adding label:", message.error);
        // Optionally, you could use an in-app notification package or even alert.
        alert("Error adding label: " + message.error);
      } else if (message.command === "labelAddedToIssue") {
        console.log("Label added successfully:", message.label);
        // Optionally update your local state or simply refresh the issue.
      } else if (message.command === "labelRemovedFromIssue") {
        // You may choose to update the labels in the current issue,
        // for example by filtering out the removed label:
        const removed = message.removedLabel;
        if (this.issue && this.issue.labels && this.issue.labels.nodes) {
          this.issue.labels.nodes = this.issue.labels.nodes.filter(label => label.id !== removed.id);
        }
        // Optionally, display a success message:
        console.log("Label removed successfully:", removed);
      } else if (message.command === "removeLabelFromIssueError") {
        console.error("Error removing label:", message.error);
        vscode.postMessage({ command: 'showErrorNotification', message: "Error: " + message.error });
      } else if (message && message.command === 'availableArtifactsLoaded') {
        console.log('[IssueDetails.vue] Received available artifacts:', message.artifacts);
        this.artifactsLoading = false;
        this.availableArtifacts = message.artifacts || [];
      }
      else if (message && message.command === 'artifactAddedToIssue') {
        console.log('[IssueDetails.vue] Artifact added successfully:', message.artifactId);
        vscode.window.showInformationMessage('Artifact added to issue successfully.');
        this.refreshCurrentIssue();
      }
      else if (message && message.command === 'addArtifactError') {
        console.error('[IssueDetails.vue] Error adding artifact:', message.error);
        vscode.window.showErrorMessage(`Error adding artifact: ${message.error}`);
      } else if (message && message.command === 'artifactRemovedFromIssue') {
        console.log('[IssueDetails.vue] Artifact removed successfully:', message.artifactId);
        vscode.window.showInformationMessage('Artifact removed from issue successfully.');

        this.refreshCurrentIssue();

        if (this.issue && this.issue.artifacts) {
          this.issue.artifacts = this.issue.artifacts.filter(
            artifact => artifact.id !== message.artifactId
          );
        }
      }
      else if (message && message.command === 'removeArtifactError') {
        console.error('[IssueDetails.vue] Error removing artifact:', message.error);
        vscode.window.showErrorMessage(`Error removing artifact: ${message.error}`);
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
  justify-content: space-between;
  /* space-between pushes them apart */
  gap: 8px;
  padding: 4px 0;
  /* optional spacing */
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
  flex: 1;
  /* push the button to the far right */
}

.remove-relation-button {
  display: inline-flex;
  /* So we can center the X */
  align-items: center;
  justify-content: center;
  width: 24px;
  /* Circle dimensions */
  height: 24px;
  border-radius: 50%;
  /* Makes the shape round */
  background: none;
  border: none;
  color: #d6bee4 !important;
  /* Your desired color for the X */
  cursor: pointer;
  font-size: 1em;
  margin: 0;
  padding: 0;
  transition: background-color 0.2s ease;
  margin-left: -4px;
  /* adjust this value as needed */
}

.remove-relation-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  /* Slightly gray/white background */
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
  position: relative;
}

.artifact-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.artifact-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 20px;
}

.artifact-item .remove-relation-button {
  position: absolute;
  top: 8px;
  right: 8px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-file-line {
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  padding-right: 4px;
}

.line-numbers {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 6px;
  white-space: nowrap;
  flex-shrink: 0;
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
  position: relative;
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

.graph-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

/* Labels Search Field */

.dropdown-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
  border: 1px solid var(--vscode-dropdown-border);
  background-color: #2d2d2d;
  color: white;
  border-bottom: none;
  outline: none;
}

.label-description {
  font-size: 0.85em;
  color: #cccccc;
}

/* Labels Create New */

.create-label-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.create-label-modal .modal-content {
  background: #2d2d2d;
  color: white;
  padding: 20px;
  border-radius: 6px;
  width: 300px;
}

.create-label-modal label {
  display: block;
  margin-top: 10px;
}

.create-label-modal input[type="text"],
.create-label-modal input[type="color"] {
  width: 100%;
  margin-top: 4px;
  padding: 4px;
}

.create-label-modal .modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.create-label-modal .modal-actions button {
  padding: 6px 12px;
  cursor: pointer;
}

/* Main container for the create-label form */
.create-label-form {
  /* Fill entire dropdown width */
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  color: #ffffff;
  background-color: var(--vscode-dropdown-background);
  /* Lighter grey, matching dropdown */
}

.label-form-header {
  font-weight: bold;
  margin-bottom: 8px;
}

/* Inputs remain dark (#2d2d2d) but with white borders & text */
.label-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 6px;
  padding: 6px;
  background-color: #2d2d2d;
  border: 1px solid #ffffff;
  color: #ffffff;
  transition: border-color 0.2s;
}

/* Keep border white on hover/focus */
.label-input:hover,
.label-input:focus {
  outline: none;
  border-color: #ffffff;
}

/* Button row */
.label-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.label-form-actions button {
  background: none;
  color: #ffffff;
  border: 1px solid transparent;
  padding: 4px 8px;
  font-size: 0.9em;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.2s, border-color 0.2s;
}

.label-form-actions button:hover {
  color: #0078d4;
  border-color: #0078d4;
}

.labels-row {
  margin-left: 16px;
  /* or whatever spacing you prefer */
}

/* Artifact Buttons */
.artifact-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 0.85em;
  cursor: pointer;
  margin-right: 4px;
}

.artifact-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

.artifact-button.create-button {
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, white);
}

.artifact-button.create-button:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

.artifact-button.add-button {
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
}

.artifact-button.add-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

/* Add Artifact Dropdown */
.add-artifact-dropdown {
  position: relative;
  width: calc(100% - 20px);
  margin: 0 10px 8px 10px;
  background-color: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--vscode-dropdown-border);
  font-weight: 500;
}

.close-dropdown-button {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--vscode-foreground);
  opacity: 0.7;
  padding: 0 4px;
}

.close-dropdown-button:hover {
  opacity: 1;
}

.artifact-dropdown-options {
  overflow-y: auto;
  max-height: 250px;
}

.artifact-dropdown-option {
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1));
}

.artifact-dropdown-option:last-child {
  border-bottom: none;
}

.artifact-dropdown-option:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.artifact-option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifact-file-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artifact-option-details {
  display: flex;
  gap: 8px;
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}

.line-numbers {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 6px;
}

.artifact-trackable-label {
  color: var(--vscode-foreground);
  opacity: 0.8;
}

.artifact-version-label {
  color: var(--vscode-foreground);
  opacity: 0.7;
}

.no-artifacts-message {
  padding: 10px;
  font-style: italic;
  color: var(--vscode-descriptionForeground);
  text-align: center;
}

.loading-artifacts {
  padding: 10px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}

.issue-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.issue-icon2 {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
</style>