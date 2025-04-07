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
        <button class="create-issue-button" @click="showCreateIssue" title="Create new issue">
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
      <p>No issues available.</p>
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
          <div class="description-editor">
            <div class="editor-toolbar">
              <button class="toolbar-button" @click="applyFormatting('h')"><span class="toolbar-icon">H</span></button>
              <button class="toolbar-button" @click="applyFormatting('b')"><span class="toolbar-icon">B</span></button>
              <button class="toolbar-button" @click="applyFormatting('i')"><span class="toolbar-icon">I</span></button>
              <button class="toolbar-button" @click="applyFormatting('quote')"><span
                  class="toolbar-icon">"</span></button>
              <button class="toolbar-button" @click="applyFormatting('link')"><span
                  class="toolbar-icon">🔗</span></button>
              <button class="toolbar-button" @click="applyFormatting('code')"><span class="toolbar-icon">{
                  }</span></button>
              <button class="toolbar-button" @click="applyFormatting('ul')"><span class="toolbar-icon">•
                </span></button>
              <button class="toolbar-button" @click="applyFormatting('ol')"><span class="toolbar-icon">1.
                </span></button>
            </div>

            <textarea class="description-textarea" v-model="newIssue.description" placeholder="Description (optional)"
              rows="8"></textarea>

            <div class="editor-footer">
              <span class="editor-info">Markdown supported</span>
            </div>
          </div>
        </div>

        <!-- Templated Fields Tab -->
        <div v-else class="tab-content">
          <div v-if="newIssue.templateId" class="templated-fields">
            <div v-for="(field, index) in templatedFields" :key="index" class="form-group">
              <label>{{ field.name }}</label>
              <input type="text" v-model="field.value" class="form-input" />
            </div>
          </div>
          <div v-else class="no-template-message">
            Please select a template first
          </div>
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
</template>

<script>
let vscode;
export default {
  name: "ComponentIssues",
  data() {
    return {
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

        // If we have metadata about issue sources, update the map
        if (message.metadata && message.metadata.versionOnlyIssues) {
          message.metadata.versionOnlyIssues.forEach(issueId => {
            this.issueSourceMap[issueId] = { versionOnly: true };
          });
        }

        // Store the selected version ID
        if (message.metadata) {
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
      } else if (message && message.command === "issueTemplatesLoaded") {
        // Handle templates loaded from backend
        this.issueTemplates = message.templates || [];
        console.log("Templates loaded:", this.issueTemplates.length);
      } else if (message && message.command === "issueCreated") {
        // Handle successful issue creation
        if (message.issue) {
          // Add the new issue to our list if not already there
          const issueExists = this.issues.some(i => i.id === message.issue.id);
          if (!issueExists) {
            this.issues = [...this.issues, message.issue];
            this.saveState();
          }

          // Show success notification or auto-open the new issue
          console.log("Issue created successfully:", message.issue.id);

          // Optionally, open the newly created issue
          this.openIssueDetails(message.issue.id);
        }
      }
    });

    // Close filter menu when clicking outside
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
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
      this.showCreateIssueModal = true;
      this.currentTab = 'general';
      this.resetForm();
      this.fetchIssueTemplates();

      // Get the current component ID from the metadata
      if (this.selectedVersionId) {
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
      // TODO: get templated fields from the template
      this.templatedFields = [
        { name: 'Priority', value: '' },
        { name: 'Estimated Time', value: '' }
      ];
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
    }, applyFormatting(type) {
      // Get the textarea element
      const textarea = this.$el.querySelector('.description-textarea');
      if (!textarea) return;

      // Get the current selection
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = this.newIssue.description.substring(start, end);

      let formattedText = '';
      let cursorOffset = 0;

      switch (type) {
        case 'h':
          formattedText = `### ${selectedText}`;
          cursorOffset = 4;
          break;
        case 'b':
          formattedText = `**${selectedText}**`;
          cursorOffset = 2;
          break;
        case 'i':
          formattedText = `*${selectedText}*`;
          cursorOffset = 1;
          break;
        case 'quote':
          formattedText = `> ${selectedText}`;
          cursorOffset = 2;
          break;
        case 'link':
          formattedText = `[${selectedText}](url)`;
          cursorOffset = 1;
          break;
        case 'code':
          formattedText = `\`${selectedText}\``;
          cursorOffset = 1;
          break;
        case 'ul':
          formattedText = `- ${selectedText}`;
          cursorOffset = 2;
          break;
        case 'ol':
          formattedText = `1. ${selectedText}`;
          cursorOffset = 3;
          break;
      }

      // Replace the selected text with the formatted text
      this.newIssue.description =
        this.newIssue.description.substring(0, start) +
        formattedText +
        this.newIssue.description.substring(end);

      // Reset the selection
      this.$nextTick(() => {
        textarea.focus();
        if (start === end) {
          // No text was selected, place cursor after the format markers
          textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
        } else {
          // Text was selected, select the newly formatted text
          textarea.setSelectionRange(start, start + formattedText.length);
        }
      });
    },
    createIssue() {
      if (!this.componentId) {
        if (this.selectedVersionId) {
          this.componentId = this.selectedVersionId;
        } else {
          console.error("Cannot create issue: Missing component ID");
          return;
        }
      }

      // Format templated fields
      const formattedFields = this.templatedFields.map(field => ({
        name: field.name,
        value: field.value
      })).filter(field => field.value !== '');

      // Prepare the issue creation input
      const input = {
        title: this.newIssue.title,
        template: this.newIssue.templateId,
        type: this.newIssue.typeId,
        state: this.newIssue.stateId,
        body: "", // Empty body initially
        trackables: this.componentId,
        templatedFields: formattedFields
      };

      // Send the creation request to the extension
      if (vscode) {
        vscode.postMessage({
          command: 'createIssue',
          input: input
        });

        // Close the dialog
        this.closeCreateIssue();
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
</style>