<template>
  <div id="app">
    <!-- Filter Controls -->
    <div class="filter-container">
      <!-- Search Box -->
      <div class="search-box">
        <input type="text" v-model="searchQuery" placeholder="Search issues..." class="search-input" />
        <span v-if="searchQuery" class="clear-search" @click="clearSearch">×</span>
      </div>

      <!-- Sort Button -->
      <div class="sort-dropdown" ref="sortDropdown">
        <button @click="toggleSortOrder" class="sort-button">
          <span class="sort-icon">≡</span>
        </button>
      </div>

      <!-- Status Toggle -->
      <div class="status-toggle">
        <button class="status-button" :class="{ 'active': statusFilter === 'open' }" @click="setStatusFilter('open')">
          <span class="status-indicator open"></span>

        </button>
        <button class="status-button" :class="{ 'active': statusFilter === 'closed' }"
          @click="setStatusFilter('closed')">
          <span class="status-indicator closed"></span>

        </button>
      </div>

      <!-- Type Toggle -->
      <div class="type-filter">
        <button class="type-button" :class="{ 'active': typeFilter === 'Bug' }" @click="setTypeFilter('Bug')">
          <img :src="getTypeIconPath('Bug', typeFilter === 'Bug')" class="type-icon" alt="Bug" />
        </button>
        <button class="type-button" :class="{ 'active': typeFilter === 'Feature' }" @click="setTypeFilter('Feature')">
          <img :src="getTypeIconPath('Feature', typeFilter === 'Feature')" class="type-icon" alt="Feature" />
        </button>
        <button class="type-button" :class="{ 'active': typeFilter === 'Misc/Task' }"
          @click="setTypeFilter('Misc/Task')">
          <img :src="getTypeIconPath('Misc', typeFilter === 'Misc/Task')" class="type-icon" alt="Misc/Task" />
        </button>
      </div>

      <!-- Component Version Filter Button -->
      <div class="version-filter">
        <button class="version-filter-button" :class="{ 'active': componentVersionFilter }" @click="toggleVersionFilter"
          title="Filter issues to show only those affecting the selected version">
          <span class="filter-icon">V</span>
        </button>
      </div>

      <div class="create-issue-container">
        <button class="create-issue-button" @click="showCreateIssue" title="Create new issue"
          :class="{ 'disabled': !hasComponentSelected }" :disabled="!hasComponentSelected">
          <span class="create-icon">+</span>
        </button>
      </div>

    </div>

    <!-- Issues List -->
    <ul v-if="filteredIssues.length" class="issues-list">
      <li v-for="issue in filteredIssues" :key="issue.id" class="issue-item" @click="openIssueDetails(issue.id)">
        <div class="issue-title-line">
          <img :src="getIconPath(issue.type.name, issue.state.isOpen)" class="issue-icon" alt="Issue Icon" />
          <span class="issue-name">{{ issue.title }}</span>
          <span v-if="issueSourceMap[issue.id]?.versionOnly" class="version-badge"
            title="This issue affects only this version">V</span>
        </div>
      </li>
    </ul>

    <!-- No Results States -->
    <div v-else-if="searchQuery" class="no-results">
      <p>No issues matching "{{ searchQuery }}".</p>
      <button @click="clearSearch" class="clear-button">Clear search</button>
    </div>
    <div v-else-if="issues.length === 0" class="no-results">
      <p v-if="hasComponentSelected">No issues available for this component.</p>
      <p v-else>Please select a component to view or create issues.</p>
    </div>
    <div v-else class="no-results">
      <p>No {{ statusFilter }} issues found.</p>
      <button @click="setStatusFilter('all')" class="clear-button">Show all issues</button>
    </div>
  </div>

  <!-- Create Issue Modal -->
  <div v-if="showCreateIssueModal" class="modal-overlay" @click.self="closeCreateIssue">
    <div class="create-issue-modal">
      <div class="modal-header">
        <h2>Create issue</h2>
        <button class="close-button" @click="closeCreateIssue">×</button>
      </div>

      <div class="modal-tabs">
        <div class="tab" :class="{ 'active': currentTab === 'general' }">
          <span class="tab-number">1</span> General
        </div>
        <div class="tab" :class="{ 'active': currentTab === 'description' }">
          <span class="tab-number">2</span> Description
        </div>
        <div class="tab" :class="{ 'active': currentTab === 'templated' }">
          <span class="tab-number">3</span> Templated fields
        </div>
      </div>

      <div class="modal-content">
        <!-- General Tab -->
        <div v-if="currentTab === 'general'" class="tab-content">
          <div class="form-group">
            <input type="text" v-model="newIssue.title" placeholder="Title" class="form-input" />
            <div v-if="validationErrors.title" class="validation-error">
              Title is a required field
            </div>
          </div>

          <div class="form-group">
            <div class="select-container" @click.stop="showTemplateDropdown = !showTemplateDropdown">
              <div class="dropdown-display">
                {{ newIssue.templateName || 'Template' }}
                <span class="dropdown-arrow">▼</span>
              </div>

              <div v-if="showTemplateDropdown" class="field-dropdown">
                <div v-if="issueTemplates.length === 0" class="dropdown-loading">Loading...</div>
                <div v-else class="dropdown-options">
                  <div v-for="template in issueTemplates" :key="template.id" @click.stop="selectTemplate(template)"
                    class="dropdown-option">
                    {{ template.name }}
                  </div>
                </div>
              </div>
            </div>
            <div v-if="validationErrors.template" class="validation-error">
              Template is a required field
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <div class="select-container"
                @click.stop="!newIssue.templateId ? null : showTypeDropdown = !showTypeDropdown">
                <div class="dropdown-display" :class="{ 'disabled': !newIssue.templateId }">
                  {{ newIssue.typeName || 'Type' }}
                  <span class="dropdown-arrow">▼</span>
                </div>

                <div v-if="showTypeDropdown && newIssue.templateId" class="field-dropdown">
                  <div v-if="issueTypes.length === 0" class="dropdown-loading">Loading...</div>
                  <div v-else class="dropdown-options">
                    <div v-for="type in issueTypes" :key="type.id" @click.stop="selectType(type)"
                      class="dropdown-option">
                      <img class="type-icon-small" :src="getTypeIconForOption(type)" alt="" />
                      {{ type.name }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="validationErrors.type" class="validation-error">
                Type is a required field
              </div>
            </div>

            <div class="form-group">
              <div class="select-container"
                @click.stop="!newIssue.templateId ? null : showStateDropdown = !showStateDropdown">
                <div class="dropdown-display" :class="{ 'disabled': !newIssue.templateId }">
                  {{ newIssue.stateName || 'State' }}
                  <span class="dropdown-arrow">▼</span>
                </div>

                <div v-if="showStateDropdown && newIssue.templateId" class="field-dropdown">
                  <div v-if="issueStates.length === 0" class="dropdown-loading">Loading...</div>
                  <div v-else class="dropdown-options">
                    <div v-for="state in issueStates" :key="state.id" @click.stop="selectState(state)"
                      class="dropdown-option"
                      :class="{ 'state-option-open': state.isOpen, 'state-option-closed': !state.isOpen }">
                      {{ state.name }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="validationErrors.state" class="validation-error">
                State is a required field
              </div>
            </div>
          </div>

          <div v-if="!newIssue.templateId" class="info-message">
            Please select a template first to enable Type and State selection
          </div>
        </div>

        <!-- Description Tab -->
        <div v-else-if="currentTab === 'description'" class="tab-content">
          <div class="github-editor">
            <!-- Editor Tabs -->
            <div class="editor-tabs">
              <button class="editor-tab" :class="{ 'active': !previewMode }" @click="previewMode = false">
                Write
              </button>
              <button class="editor-tab" :class="{ 'active': previewMode }" @click="previewMode = true">
                Preview
              </button>
            </div>

            <!-- Toolbar (only visible in write mode) -->
            <div class="editor-toolbar" v-if="!previewMode">
              <button class="toolbar-button" @click="applyFormatting('h')" title="Add header text">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('b')" title="Bold">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('i')" title="Italic">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M5 2.75a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-3.5v9h3.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h3.5v-9h-3.5a.75.75 0 0 1-.75-.75Z">
                  </path>
                </svg>
              </button>
              <div class="toolbar-divider"></div>
              <button class="toolbar-button" @click="applyFormatting('link')" title="Add a link">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('quote')" title="Add a quote">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('code')" title="Add code">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z">
                  </path>
                </svg>
              </button>
              <div class="toolbar-divider"></div>
              <button class="toolbar-button" @click="applyFormatting('ul')" title="Add a bulleted list">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('ol')" title="Add a numbered list">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M2.003 2.5a.5.5 0 0 0-.723-.447l-1.003.5a.5.5 0 0 0 .446.895l.28-.14V6H.5a.5.5 0 0 0 0 1h2.006a.5.5 0 1 0 0-1h-.503V2.5ZM5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1 .153-.68L1.62 9.25a.5.5 0 1 1 .52.851l-.151.092v.834H2.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.038-.969l.224-.11V10.32Zm.128 4.238a.5.5 0 0 1 .669.225l.16.37c.161.218.091.412.024.131-.15-.5.151 0 0 0-.01.07.07-.032.024-.13l-.159-.368a.5.5 0 0 1 .225-.669l.683-.297a.5.5 0 0 1 .117.943l-.225.98a.5.5 0 0 1-.111.99H.5a.5.5 0 0 1 0-1h1.057l.224-.976a.5.5 0 0 1 .116-.943l.683.297Z">
                  </path>
                </svg>
              </button>
              <button class="toolbar-button" @click="applyFormatting('task')" title="Add a task list">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path
                    d="M2.5 3.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-1ZM2 7.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-1ZM2.5 11.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-1Z">
                  </path>
                </svg>
              </button>
            </div>

            <!-- Write mode: Textarea -->
            <div v-if="!previewMode" class="editor-content">
              <textarea class="github-textarea" v-model="newIssue.description"
                placeholder="Leave a description (optional)" ref="descriptionTextarea" rows="6">
              </textarea>
            </div>

            <!-- Preview mode: Rendered markdown -->
            <div v-else class="editor-preview markdown-content">
              <div v-if="newIssue.description" v-html="markdownToHtml(newIssue.description)"></div>
              <div v-else class="preview-placeholder">Nothing to preview</div>
            </div>

            <div class="editor-footer">
              <div class="markdown-info">
                <a href="https://docs.github.com/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
                  target="_blank" class="markdown-link">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="markdown-icon">
                    <path
                      d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z">
                    </path>
                  </svg>
                  Markdown is supported
                </a>
              </div>
              <div class="textarea-controls">
                <span class="textarea-tip">You can attach files by dragging & dropping or selecting them.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Templated Fields Tab -->
        <div v-else class="tab-content">
          <div v-if="newIssue.templateId" class="templated-fields">
            <div v-if="templatedFields.length === 0" class="no-fields-message">
              No templated fields available for this template.
            </div>
            <div v-for="(field, index) in templatedFields" :key="index" class="form-group">
              <label>
                {{ field.name }}
              </label>

              <!-- Different input types based on field type -->
              <template v-if="field.type === 'select' && field.options.length > 0">
                <select v-model="field.value" class="form-input">
                  <option value="">-- Select a value --</option>
                  <option v-for="option in field.options" :key="option" :value="option">
                    {{ option }}
                  </option>
                </select>
              </template>

              <template v-else-if="field.type === 'boolean'">
                <div class="checkbox-container">
                  <input type="checkbox" :id="`field-${index}`" v-model="field.value">
                </div>
              </template>

              <template v-else>
                <!-- Default to text input -->
                <input type="text" v-model="field.value" class="form-input" placeholder="Enter value" />
              </template>

              <!-- Show required message if field is required -->
              <div v-if="field.required" class="field-required-message">
                This field is required
              </div>
            </div>
          </div>
          <div v-else class="no-template-message">
            Please select a template first
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="currentTab === 'description'" class="button secondary" @click="currentTab = 'general'">
            Previous
          </button>
          <button v-else-if="currentTab === 'templated'" class="button secondary" @click="currentTab = 'description'">
            Previous
          </button>

          <button v-if="currentTab === 'general'" class="button primary" @click="validateAndProceed">
            Next
          </button>
          <button v-else-if="currentTab === 'description'" class="button primary" @click="goToTemplatedFields">
            Next
          </button>
          <button v-else class="button primary" @click="createIssue">
            Create
          </button>

          <button class="button secondary" @click="closeCreateIssue">
            Cancel
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
let vscode;
export default {
  name: "ComponentIssues",
  data() {
    return {
      previewMode: false,
      issues: [],
      searchQuery: '',
      statusFilter: null, // null, 'open', or 'closed'
      sortOrder: 'asc', // 'asc' or 'desc'
      showFilterMenu: false,
      typeFilter: null,
      componentVersionFilter: false,
      issueSourceMap: {},
      selectedVersionId: null,
      affectedIssueIds: new Set(), showCreateIssueModal: false,
      currentTab: 'general',
      newIssue: {
        title: '',
        templateId: '',
        templateName: '',
        typeId: '',
        typeName: '',
        stateId: '',
        stateName: '',
        description: ''
      },
      issueTemplates: [],
      issueTypes: [],
      issueStates: [],
      templatedFields: [],
      showTemplateDropdown: false,
      showTypeDropdown: false,
      showStateDropdown: false,
      validationErrors: {
        title: false,
        template: false,
        type: false,
        state: false
      },
      componentId: null,
    };
  },
  computed: {
    currentSortLabel() {
      const option = this.sortOptions.find(opt => opt.value === this.sortBy);
      return option ? option.label : 'Alphabetical';
    }, hasComponentSelected() {
      // Return true if either componentId or selectedVersionId is set
      return Boolean(this.componentId);
    },
    filteredIssues() {
      let result = [...this.issues];

      // When filter is ON, show only issues affected by the selected version
      if (this.componentVersionFilter && this.selectedVersionId) {
        result = result.filter(issue => this.affectedIssueIds.has(issue.id));
      }

      // Apply status filter
      if (this.statusFilter === 'open') {
        result = result.filter(issue => issue.state.isOpen === true);
      } else if (this.statusFilter === 'closed') {
        result = result.filter(issue => issue.state.isOpen === false);
      }

      // Apply type filter
      if (this.typeFilter === 'Bug') {
        result = result.filter(issue => issue.type.name === 'Bug');
      } else if (this.typeFilter === 'Feature') {
        result = result.filter(issue => issue.type.name === 'Feature');
      } else if (this.typeFilter === 'Misc/Task') {
        result = result.filter(issue =>
          issue.type.name === 'Misc' || issue.type.name === 'Task'
        );
      }

      // Apply search filter
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(issue => {
          return issue.title.toLowerCase().includes(query) ||
            (issue.type && issue.type.name.toLowerCase().includes(query));
        });
      }

      // Apply sorting
      result.sort((a, b) => {
        const comparison = a.title.localeCompare(b.title);
        return this.sortOrder === 'asc' ? comparison : -comparison;
      });

      return result;
    },
  },
  mounted() {
    if (typeof acquireVsCodeApi !== "undefined") {
      vscode = acquireVsCodeApi();
    }
    // Restore persisted state if available
    const state = vscode.getState();

    if (state) {
      this.issues = state.issues || [];
      this.searchQuery = state.searchQuery || '';
      this.statusFilter = state.statusFilter || null;
      this.sortOrder = state.sortOrder || 'asc';
      this.typeFilter = state.typeFilter || null;
    }
    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
    }
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message && message.command === "updateComponentIssues") {
        this.issues = message.data;

        // Reset the issue source map
        this.issueSourceMap = {};

        // Track the component ID when issues are loaded
        if (message.metadata) {
          if (message.metadata.componentId) {
            this.componentId = message.metadata.componentId;
          }

          if (message.metadata.versionOnlyIssues) {
            message.metadata.versionOnlyIssues.forEach(issueId => {
              this.issueSourceMap[issueId] = { versionOnly: true };
            });
          }

          // Store the selected version ID
          if (message.metadata.selectedVersionId) {
            this.selectedVersionId = message.metadata.selectedVersionId;
          } else {
            this.selectedVersionId = null;
          }

          // Update affected issue IDs set
          this.affectedIssueIds = new Set(message.metadata.affectedIssueIds || []);
        }

        // When selecting a new component/version, turn off the filter by default
        this.componentVersionFilter = false;

        this.saveState();
      } else if (message && message.command === "issueUpdated") {
        // Handle direct issue updates without requiring a full refresh
        if (message.updatedIssue) {
          // Find and update the issue in our local list
          const issueIndex = this.issues.findIndex(issue => issue.id === message.issueId);
          if (issueIndex !== -1) {
            // Create a new array with the updated issue
            const updatedIssues = [...this.issues];
            updatedIssues[issueIndex] = message.updatedIssue;
            this.issues = updatedIssues;
            this.saveState();
            console.log(`Updated issue ${message.issueId}, field: ${message.field}`);
          } else {
            // If for some reason we can't find the issue, request a full refresh
            if (vscode) {
              vscode.postMessage({ command: "refreshRequested" });
            }
          }
        } else {
          // Fallback to a full refresh if we don't have updated issue data
          if (vscode) {
            vscode.postMessage({ command: "refreshRequested" });
          }
        }
      } else if (message.command === "fetchIssueTemplates") {
        // Handle fetching templates
        this.fetchIssueTemplates()
          .then(templates => {
            webviewView.webview.postMessage({
              command: 'issueTemplatesLoaded',
              templates: templates
            });
          })
          .catch(error => {
            console.error("Error fetching issue templates:", error);
            webviewView.webview.postMessage({
              command: 'issueTemplatesLoaded',
              templates: [],
              error: error.message
            });
          });
      } else if (message.command === "createIssue") {
        // Handle creating issue
        this.createIssue(message.input)
          .then(newIssue => {
            webviewView.webview.postMessage({
              command: 'issueCreated',
              issue: newIssue
            });

            // Refresh the issues list
            this.refreshCurrentIssues();
          })
          .catch(error => {
            console.error("Error creating issue:", error);
            webviewView.webview.postMessage({
              command: 'issueCreationError',
              error: error.message
            });
          });
      } else if (message.command === "issueTemplatesLoaded") {
        console.log("Received issue templates:", message.templates);
        this.issueTemplates = message.templates || [];

        if (message.error) {
          console.error("Error loading templates:", message.error);
        }
      } else if (message.command === 'issueCreated') {
        console.log("Issue created successfully:", message.issue);
        // Optionally add the new issue to the local list for immediate display
        if (message.issue) {
          this.issues = [message.issue, ...this.issues];
          this.saveState();
        }
      }
      else if (message.command === 'issueCreationError') {
        console.error("Error creating issue:", message.error);
        // Show error to the user
        alert(`Error creating issue: ${message.error}`);
      }
      return;
    });

    // Close filter menu when clicking outside
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    /**
 * Applies markdown formatting to the selected text or at the cursor position.
 * 
 * @param {string} type - The type of formatting to apply ('b', 'i', 'h', 'link', 'quote', 'code', 'ul', 'ol', 'task')
 */
    applyFormatting(type) {
      // Get the textarea element
      const textarea = this.$refs.descriptionTextarea;
      if (!textarea) {
        return;
      }

      // Get the current selection/cursor position
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;
      const text = this.newIssue.description || '';
      const selectedText = text.substring(start, end);

      // Define formatting templates
      let prefix = '';
      let suffix = '';
      let cursorOffset = 0;
      let selectionOffset = 0;

      switch (type) {
        case 'h':
          prefix = '### ';
          cursorOffset = prefix.length;
          break;
        case 'b':
          prefix = '**';
          suffix = '**';
          cursorOffset = prefix.length;
          break;
        case 'i':
          prefix = '_';
          suffix = '_';
          cursorOffset = prefix.length;
          break;
        case 'quote':
          prefix = '> ';
          cursorOffset = prefix.length;
          break;
        case 'link':
          if (hasSelection) {
            prefix = '[';
            suffix = '](url)';
            selectionOffset = prefix.length + selectedText.length + 1;
          } else {
            prefix = '[';
            suffix = '](url)';
            cursorOffset = prefix.length;
          }
          break;
        case 'code':
          if (hasSelection && selectedText.includes('\n')) {
            prefix = '```\n';
            suffix = '\n```';
            cursorOffset = prefix.length;
          } else {
            prefix = '`';
            suffix = '`';
            cursorOffset = prefix.length;
          }
          break;
        case 'ul':
          if (hasSelection) {
            const lines = selectedText.split('\n');
            const formattedLines = lines.map(line => line.trim() ? `- ${line}` : line);
            const newSelectedText = formattedLines.join('\n');

            this.newIssue.description =
              text.substring(0, start) +
              newSelectedText +
              text.substring(end);

            this.$nextTick(() => {
              textarea.focus();
              textarea.setSelectionRange(start, start + newSelectedText.length);
            });
            return;
          } else {
            prefix = '- ';
            cursorOffset = prefix.length;
          }
          break;
        case 'ol':
          if (hasSelection) {
            const lines = selectedText.split('\n');
            const formattedLines = lines.map((line, index) =>
              line.trim() ? `${index + 1}. ${line}` : line
            );
            const newSelectedText = formattedLines.join('\n');

            this.newIssue.description =
              text.substring(0, start) +
              newSelectedText +
              text.substring(end);

            this.$nextTick(() => {
              textarea.focus();
              textarea.setSelectionRange(start, start + newSelectedText.length);
            });
            return;
          } else {
            prefix = '1. ';
            cursorOffset = prefix.length;
          }
          break;
        case 'task':
          prefix = '- [ ] ';
          cursorOffset = prefix.length;
          break;
      }

      // Apply the formatting
      let newText;
      let newCursorPos;

      if (hasSelection) {
        newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
        newCursorPos = start + prefix.length + selectedText.length + suffix.length;

        if (type === 'link' && selectionOffset > 0) {
          newCursorPos = start + selectionOffset;
        }
      } else {
        newText = text.substring(0, start) + prefix + suffix + text.substring(end);
        newCursorPos = start + cursorOffset;
      }

      // Update the text
      this.newIssue.description = newText;

      // Focus and position cursor
      this.$nextTick(() => {
        textarea.focus();
        if (type === 'link' && hasSelection && selectionOffset > 0) {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } else if (hasSelection) {
          textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
        } else {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    }, markdownToHtml(markdown) {
      if (!markdown) return '';

      // You can either:
      // 1. Use a simple regex-based markdown converter (limited but lightweight)
      // 2. Import a library like marked.js (more complete but requires import)

      // For this example, I'll provide a very simple implementation
      // that handles basic markdown formatting:
      let html = markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Lists
        .replace(/^\s*- (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
        // Task lists
        .replace(/- \[ \] (.*$)/gim, '<div class="task-list-item"><input type="checkbox" disabled> $1</div>')
        .replace(/- \[x\] (.*$)/gim, '<div class="task-list-item"><input type="checkbox" checked disabled> $1</div>')
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        // Quotes
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        // Line breaks
        .replace(/\n/g, '<br>');

      // Fix nested list rendering by removing extra ul/ol tags
      html = html.replace(/<\/ul><ul>/g, '').replace(/<\/ol><ol>/g, '');

      return html;
    },
    getIconPath(type, isOpen) {
      switch (type) {
        case "Bug":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/bug-green.png", import.meta.url).href
            : new URL("../../resources/icons/bug-red.png", import.meta.url).href;
        case "Misc":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
        case "Feature":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href
            : new URL("../../resources/icons/lightbulb-feature-red.png", import.meta.url).href;
        case "Task":
          return Boolean(isOpen)
            ? new URL("../../resources/icons/exclamation-green.png", import.meta.url).href
            : new URL("../../resources/icons/exclamation-red.png", import.meta.url).href;
      }
    },
    getTypeIconPath(type) {
      switch (type) {
        case "Bug":
          return new URL("../../resources/icons/bug-white.png", import.meta.url).href;
        case "Feature":
          return new URL("../../resources/icons/lightbulb-feature-white.png", import.meta.url).href;
        case "Misc":
        case "Task":
          return new URL("../../resources/icons/exclamation-white.png", import.meta.url).href;
      }
    }, getTypeIconForOption(type) {
      switch (type.name) {
        case "Bug":
          return new URL("../../resources/icons/bug-green.png", import.meta.url).href;
        case "Feature":
          return new URL("../../resources/icons/lightbulb-feature-green.png", import.meta.url).href;
        case "Misc":
        case "Task":
          return new URL("../../resources/icons/exclamation-green.png", import.meta.url).href;
        default:
          return new URL("../../resources/icons/bug-green.png", import.meta.url).href;
      }
    },// Create Issue Dialog Methods
    showCreateIssue() {

      // Only allow creating an issue if a component is selected
      if (!this.hasComponentSelected) {
        // Optionally show a message to the user
        if (vscode) {
          vscode.postMessage({
            command: "showMessage",
            message: "Please select a component first to create an issue."
          });
        }
        return;  // Prevent the modal from opening
      }
      this.showCreateIssueModal = true;
      this.currentTab = 'general';
      this.resetForm();
      this.fetchIssueTemplates();

      // Get the current component ID from the metadata
      if (this.selectedVersionId && !this.componentId) {
        this.componentId = this.selectedVersionId;
      }

      // Close any open dropdowns
      this.showTemplateDropdown = false;
      this.showTypeDropdown = false;
      this.showStateDropdown = false;
    },

    closeCreateIssue() {
      this.showCreateIssueModal = false;
    },

    resetForm() {
      this.newIssue = {
        title: '',
        templateId: '',
        templateName: '',
        typeId: '',
        typeName: '',
        stateId: '',
        stateName: '',
        description: '',
      };
      this.templatedFields = [];
      this.validationErrors = {
        title: false,
        template: false,
        type: false,
        state: false
      };
    },

    async fetchIssueTemplates() {
      if (vscode) {
        this.issueTemplates = [];
        this.issueTypes = [];
        this.issueStates = [];

        // Request templates from the extension
        vscode.postMessage({
          command: 'fetchIssueTemplates'
        });
      }
    },

    selectTemplate(template) {
      this.newIssue.templateId = template.id;
      this.newIssue.templateName = template.name;
      this.showTemplateDropdown = false;
      this.validationErrors.template = false;

      // Update available types and states based on the template
      this.issueTypes = template.issueTypes?.nodes || [];
      this.issueStates = template.issueStates?.nodes || [];

      // Reset type and state if they're not available in the new template
      const typeExists = this.issueTypes.find(t => t.id === this.newIssue.typeId);
      if (!typeExists) {
        this.newIssue.typeId = '';
        this.newIssue.typeName = '';
      }

      const stateExists = this.issueStates.find(s => s.id === this.newIssue.stateId);
      if (!stateExists) {
        this.newIssue.stateId = '';
        this.newIssue.stateName = '';
      }

      // Set up templated fields
      this.setupTemplatedFields(template);
    },

    selectType(type) {
      this.newIssue.typeId = type.id;
      this.newIssue.typeName = type.name;
      this.showTypeDropdown = false;
      this.validationErrors.type = false;
    },

    selectState(state) {
      this.newIssue.stateId = state.id;
      this.newIssue.stateName = state.name;
      this.showStateDropdown = false;
      this.validationErrors.state = false;
    },

    setupTemplatedFields(template) {
      // Check if the template has field specifications
      if (template.templateFieldSpecifications &&
        template.templateFieldSpecifications.length > 0) {

        // Map template field specifications to templated fields
        this.templatedFields = template.templateFieldSpecifications.map(field => {
          // Parse the value to determine field type and options
          let fieldType = 'string';
          let fieldOptions = [];
          let isRequired = false;

          if (field.value) {
            // Handle different value structures
            if (field.value.type) {
              fieldType = field.value.type;
            }

            // Check for enum/options
            if (field.value.enum && Array.isArray(field.value.enum)) {
              fieldType = 'select';
              fieldOptions = field.value.enum;
            }

            // Check if field is required
            if (field.value.nullable === false) {
              isRequired = true;
            }
          }

          return {
            name: field.name,
            // Don't use the label as description - it's just metadata
            // description: field.value?.metadata?.label || '',
            type: fieldType,
            options: fieldOptions,
            required: isRequired,
            value: ''  // Initialize with empty value
          };
        });
      } else {
        // Fallback to empty array if no fields
        this.templatedFields = [];
      }
    },

    validateAndProceed() {
      // Reset validation errors
      this.validationErrors = {
        title: !this.newIssue.title,
        template: !this.newIssue.templateId,
        type: !this.newIssue.typeId,
        state: !this.newIssue.stateId
      };

      // Check if all required fields are filled
      if (!this.validationErrors.title &&
        !this.validationErrors.template &&
        !this.validationErrors.type &&
        !this.validationErrors.state) {
        // Proceed to description tab
        this.currentTab = 'description';
      }
    }, goToTemplatedFields() {
      // Description is optional, so we can proceed without validation
      this.currentTab = 'templated';
    },
    async createIssue() {
      // Validate all required fields
      if (!this.newIssue.title || !this.newIssue.templateId || !this.newIssue.typeId || !this.newIssue.stateId) {
        // Show validation errors
        this.validationErrors = {
          title: !this.newIssue.title,
          template: !this.newIssue.templateId,
          type: !this.newIssue.typeId,
          state: !this.newIssue.stateId
        };

        // Switch to the general tab to show validation errors
        this.currentTab = 'general';
        return;
      }

      // Make sure we have a component ID to create the issue for
      if (!this.componentId) {
        if (this.selectedVersionId) {
          this.componentId = this.selectedVersionId;
        } else {
          console.error("Cannot create issue: Missing component ID");
          vscode.postMessage({
            command: 'showMessage',
            message: 'Error: Missing component ID. Please select a component first.'
          });
          return;
        }
      }

      // Format templated fields - filter out empty fields
      const formattedFields = this.templatedFields
        .filter(field => field.value !== '')
        .map(field => ({
          name: field.name,
          value: field.value
        }));

      // Prepare the issue creation input according to the API requirements
      const input = {
        title: this.newIssue.title,
        template: this.newIssue.templateId,
        type: this.newIssue.typeId,
        state: this.newIssue.stateId,
        body: this.newIssue.description || "", // Include the description if provided
        trackables: [this.componentId], // Track the selected component (array as required by API)
        templatedFields: formattedFields
      };

      console.log("Creating issue with input:", input);

      // Send the creation request to the extension
      if (vscode) {
        vscode.postMessage({
          command: 'createIssue',
          input: input
        });

        // Close the dialog
        this.closeCreateIssue();

        // Show loading indicator or message
        vscode.postMessage({
          command: 'showMessage',
          message: 'Creating issue...'
        });
      }
    },
    setStatusFilter(status) {
      this.statusFilter = this.statusFilter === status ? null : status;
      this.saveState();
    },
    setTypeFilter(type) {
      this.typeFilter = this.typeFilter === type ? null : type;
      this.saveState();
    },

    toggleSortOrder() {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      this.saveState();
    },

    resetStatusFilter() {
      this.statusFilter = null;
      this.saveState();
    },
    openIssueDetails(issueId) {
      console.log("ComponentIssues.vue: Opening issue details for issue id:", issueId);
      // Send a message with command "issueClicked" and the correct issue id
      vscode.postMessage({ command: "issueClicked", issueId });
    },
    toggleVersionFilter() {
      console.log("Filter before:", this.componentVersionFilter);
      this.componentVersionFilter = !this.componentVersionFilter;
      console.log("Filter after:", this.componentVersionFilter);
      console.log("Selected version:", this.selectedVersionId);
      console.log("Affected issues count:", this.affectedIssueIds.size);
      this.saveState();
    },
    toggleSortMenu() {
      this.showSortMenu = !this.showSortMenu;
    },
    setSort(sortValue) {
      this.sortBy = sortValue;
      this.showSortMenu = false;
      this.saveState();
    },
    clearSearch() {
      this.searchQuery = '';
      this.saveState();
    },
    handleClickOutside(event) {
      if (this.$refs.sortDropdown && !this.$refs.sortDropdown.contains(event.target)) {
        this.showSortMenu = false;
      }

      // Add this to your handleClickOutside method
      if (this.showCreateIssueModal) {
        // Only close dropdowns if clicking outside of them
        const dropdownsContainers = document.querySelectorAll('.select-container');
        let clickedInsideDropdown = false;

        dropdownsContainers.forEach(container => {
          if (container.contains(event.target)) {
            clickedInsideDropdown = true;
          }
        });

        if (!clickedInsideDropdown) {
          this.showTemplateDropdown = false;
          this.showTypeDropdown = false;
          this.showStateDropdown = false;
        }
      }
    },
    saveState() {
      if (vscode) {
        vscode.setState({
          issues: this.issues,
          searchQuery: this.searchQuery,
          statusFilter: this.statusFilter,
          typeFilter: this.typeFilter,
          sortOrder: this.sortOrder
        });
      }
    }
  }

};
</script>

<style>
#app {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  padding: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Filter Controls */
.filter-container {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin-bottom: 12px;
  align-items: center;
  width: calc(100% - 16px);
  padding-right: 16px;
}

/* Search Box */
.search-box {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
}

.sort-dropdown,
.status-toggle,
.type-filter {
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 4px;
  padding: 4px 8px;
  padding-right: 24px;
  font-size: 12px;
  height: 24px;
  box-sizing: border-box;
  max-width: none;
}

.search-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

.clear-search {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--vscode-descriptionForeground);
}

/* Sort Dropdown */
.sort-dropdown {
  position: relative;
}

.sort-button {
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

.sort-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

.sort-icon {
  font-size: 14px;
}

.sort-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  background-color: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  width: 150px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.sort-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.sort-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.sort-item.selected {
  background-color: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.checkmark {
  width: 16px;
  margin-right: 8px;
}

/* Status Toggle */
.status-toggle {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  border: 1px solid var(--vscode-button-border, transparent);
}

.status-button {
  background: none;
  border: none;
  padding: 4px 8px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  height: 24px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
}

.status-button:hover,
.status-button.active {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
  color: var(--vscode-foreground);
  opacity: 1;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-indicator.open {
  background-color: #2ea043;
}

.status-indicator.closed {
  background-color: #f85149;
}

/* Issues List */
.issues-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex-grow: 1;
}

.issue-item {
  padding: 8px 10px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
  cursor: pointer;
}

.issue-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.issue-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue-icon {
  width: 16px;
  height: 16px;
}

.issue-name {
  flex-grow: 1;
}

/* No Results */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}

.clear-button {
  margin-top: 8px;
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}

.clear-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

/* Type Filter Styles */
.type-filter {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  border-radius: 4px;
  border: 1px solid var(--vscode-button-border, transparent);
  overflow: hidden;
}

.type-button {
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 24px;
  opacity: 0.6;
  /* Slightly reduced opacity for inactive state */
  transition: opacity 0.2s, background-color 0.2s;
}

.type-button:hover,
.type-button.active {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
  opacity: 1;
}

.type-icon {
  width: 16px;
  height: 16px;
  filter: brightness(1) grayscale(100%);
  /* Keep icons white/grayscale */
}

.type-button.active .type-icon {
  filter: brightness(1) grayscale(0%);
  /* Full color when active */
}

.version-badge {
  background-color: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ffffff);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 0.8em;
  margin-left: 8px;
}

.version-filter-button {
  background: none;
  border: none;
  padding: 4px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}

.version-filter-button:hover,
.version-filter-button.active {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
  color: var(--vscode-foreground);
  opacity: 1;
}

.version-filter {
  margin-left: 4px;
}

.version-filter-button {
  background: none;
  border: none;
  padding: 4px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
  background-color: var(--vscode-button-secondaryBackground, #2d2d2d);
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}

/* Create Issue Button */
.create-issue-container {
  margin-left: 4px;
}

.create-issue-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
}

.create-issue-button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

/* Modal Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.create-issue-modal {
  background-color: var(--vscode-editor-background);
  border-radius: 6px;
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--vscode-foreground);
  opacity: 0.7;
}

.close-button:hover {
  opacity: 1;
}

.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.tab {
  padding: 8px 12px;
  cursor: pointer;
  opacity: 0.7;
  border-bottom: 2px solid transparent;
}

.tab.active {
  opacity: 1;
  border-bottom-color: var(--vscode-button-background);
}

.tab-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--vscode-button-secondaryBackground);
  margin-right: 6px;
  font-size: 0.8em;
}

.modal-content {
  padding: 12px;
  overflow-y: auto;
  max-height: 50vh;
  /* Important: Prevent horizontal scrolling */
  overflow-x: hidden;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.form-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.form-row .form-group {
  flex: 1;
}

.form-input {
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

.dropdown-display {
  background-color: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.dropdown-display.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.validation-error {
  color: var(--vscode-errorForeground, #f48771);
  font-size: 0.85em;
  margin-top: 2px;
}

.info-message {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85em;
  font-style: italic;
  margin-top: 6px;
  text-align: center;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--vscode-panel-border);
}

.button {
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
}

.primary {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.primary:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.secondary {
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.secondary:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.type-icon-small {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.no-template-message {
  text-align: center;
  padding: 20px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
}


/* GitHub-like editor styles */
.github-editor {
  border: 1px solid var(--vscode-dropdown-border, #444);
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--vscode-input-background, #252526);
}

/* Editor tabs (Write/Preview) */
.editor-tabs {
  display: flex;
  background-color: var(--vscode-panel-background, #1e1e1e);
  border-bottom: 1px solid var(--vscode-panel-border, #444);
}

.editor-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  border-right: 1px solid var(--vscode-panel-border, #444);
  color: var(--vscode-foreground, #ccc);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.editor-tab:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

.editor-tab.active {
  color: var(--vscode-activityBarBadge-foreground, #fff);
  background-color: var(--vscode-input-background, #252526);
  border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
  margin-bottom: -1px;
}

/* Editor toolbar */
.editor-toolbar {
  display: flex;
  padding: 8px;
  background-color: var(--vscode-panel-background, #1e1e1e);
  border-bottom: 1px solid var(--vscode-panel-border, #444);
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-button {
  background: none;
  border: none;
  color: var(--vscode-foreground, #ccc);
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
  opacity: 1;
}

.toolbar-button svg {
  width: 16px;
  height: 16px;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: var(--vscode-panel-border, #444);
  margin: 0 8px;
}

/* Editor content area */
.editor-content {
  padding: 0;
}

.github-textarea {
  width: 100%;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
  padding: 8px 16px;
  border: none;
  resize: vertical;
  background-color: var(--vscode-input-background, #252526);
  color: var(--vscode-input-foreground, #ccc);
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  line-height: 1.5;
  overflow-y: auto;
}

.github-textarea:focus {
  outline: none;
}

/* Preview area */
.editor-preview {
  padding: 16px;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
  overflow-y: auto;
  color: var(--vscode-foreground, #ccc);
}

.preview-placeholder {
  color: var(--vscode-descriptionForeground, #999);
  font-style: italic;
}

/* Editor footer */
.editor-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: var(--vscode-panel-background, #1e1e1e);
  border-top: 1px solid var(--vscode-panel-border, #444);
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #999);
}

.markdown-link {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--vscode-textLink-foreground, #3794ff);
  text-decoration: none;
}

.markdown-link:hover {
  text-decoration: underline;
}

.markdown-icon {
  opacity: 0.8;
}

.textarea-tip {
  font-style: italic;
}

/* Markdown content in preview mode */
.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content h1 {
  font-size: 1.5em;
}

.markdown-content h2 {
  font-size: 1.25em;
}

.markdown-content h3 {
  font-size: 1em;
}

.markdown-content ul,
.markdown-content ol {
  padding-left: 2em;
  margin-bottom: 16px;
}

.markdown-content blockquote {
  padding: 0 1em;
  color: var(--vscode-descriptionForeground, #999);
  border-left: 0.25em solid var(--vscode-panel-border, #444);
  margin: 0 0 16px 0;
}

.markdown-content pre {
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 3px;
  padding: 16px;
  overflow: auto;
  margin-bottom: 16px;
}

.markdown-content code {
  font-family: var(--vscode-editor-font-family, monospace);
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.markdown-content pre code {
  background-color: transparent;
  padding: 0;
}

.markdown-content .task-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.markdown-content a {
  color: var(--vscode-textLink-foreground, #3794ff);
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.create-issue-button.disabled {
  background-color: var(--vscode-button-secondaryBackground, #3d3d3d);
  opacity: 0.5;
  cursor: not-allowed;
}

.create-issue-button:disabled {
  pointer-events: none;
}

.field-required-message {
  color: var(--vscode-errorForeground, #f48771);
  font-size: 0.85em;
  margin-top: 4px;
}
</style>