<template>
  <div id="app">
    <!-- Filter Controls -->
    <div class="filter-container">
      <!-- Search Box -->
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search issues..." 
          class="search-input"
        />
        <span v-if="searchQuery" class="clear-search" @click="clearSearch">×</span>
      </div>
      
      <!-- Sort Button -->
      <div class="sort-dropdown" ref="sortDropdown">
        <button @click="toggleSortMenu" class="sort-button">
          <span class="sort-icon">≡</span>
          <span class="sort-label">{{ currentSortLabel }}</span>
        </button>
        
        <!-- Sort Menu -->
        <div v-if="showSortMenu" class="sort-menu">
          <div 
            v-for="option in sortOptions" 
            :key="option.value" 
            @click="setSort(option.value)"
            class="sort-item"
            :class="{ 'selected': sortBy === option.value }"
          >
            <span v-if="sortBy === option.value" class="checkmark">✓</span>
            {{ option.label }}
          </div>
        </div>
      </div>

      <!-- Status Toggle -->
      <div class="status-toggle">
        <button class="status-button" :class="{ 'active': statusFilter === 'all' || statusFilter === 'open' }"
          @click="setStatusFilter('open')">
          <span class="status-indicator open"></span>
          Open
        </button>
        <button class="status-button" :class="{ 'active': statusFilter === 'all' || statusFilter === 'closed' }"
          @click="setStatusFilter('closed')">
          <span class="status-indicator closed"></span>
          Closed
        </button>
      </div>
    </div>

    <!-- Issues List -->
    <ul v-if="filteredIssues.length" class="issues-list">
      <li 
        v-for="issue in filteredIssues" 
        :key="issue.id" 
        class="issue-item"
        @click="openIssueDetails(issue.id)"
      >
        <div class="issue-title-line">
          <img :src="getIconPath(issue.type.name, issue.state.isOpen)" class="issue-icon" alt="Issue Icon" />
          <span class="issue-name">{{ issue.title }}</span>
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
      statusFilter: 'all', // 'all', 'open', or 'closed'
      sortBy: 'title', // Default to alphabetical sort
      showFilterMenu: false,
      sortOptions: [
        { label: 'Alphabetical', value: 'title' },
        { label: 'Type', value: 'type' }
      ]
    };
  }, 
  computed: {
    currentSortLabel() {
      const option = this.sortOptions.find(opt => opt.value === this.sortBy);
      return option ? option.label : 'Alphabetical';
    },
    filteredIssues() {
      let result = [...this.issues];
      
      // Apply status filter
      if (this.statusFilter !== 'all') {
        const isOpen = this.statusFilter === 'open';
        result = result.filter(issue => issue.state.isOpen === isOpen);
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
        switch(this.sortBy) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'type':
            return a.type.name.localeCompare(b.type.name);
          default:
            return a.title.localeCompare(b.title);
        }
      });
      
      return result;
    }
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
      this.statusFilter = state.statusFilter || 'all';
      this.sortBy = state.sortBy || 'title';
    }
    if (vscode) {
      vscode.postMessage({ command: "vueAppReady" });
    }
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message && message.command === "updateComponentIssues") {
        this.issues = message.data;
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
    openIssueDetails(issueId) {
      console.log("ComponentIssues.vue: Opening issue details for issue id:", issueId);
      // Send a message with command "issueClicked" and the correct issue id
      vscode.postMessage({ command: "issueClicked", issueId });
    }
  },
  etStatusFilter(status) {
      if (this.statusFilter === status) {
        this.statusFilter = 'all';
      } else {
        this.statusFilter = status;
      }
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
          sortBy: this.sortBy
        });
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
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

/* Search Box */
.search-box {
  position: relative;
  flex-grow: 1;
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
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
  display: flex;
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
}

.status-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #3d3d3d);
}

.status-button.active {
  color: var(--vscode-foreground);
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
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
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
</style>