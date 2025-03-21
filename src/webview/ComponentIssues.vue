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
      affectedIssueIds: new Set(),
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
</style>