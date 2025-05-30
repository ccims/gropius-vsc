export const GET_ARTIFACTS_FOR_TRACKABLE = `
query GetArtifactsForTrackable($trackableId: ID!) {
  node(id: $trackableId) {
    ... on Component {
      id
      name
      artefacts {
        nodes {
          id
          file
          from
          to
          version
          templatedFields {
            name
            value
          }
          trackable {
            id
            name
            __typename
          }
        }
      }
    }
    ... on Project {
      id
      name
      artefacts {
        nodes {
          id
          file
          from
          to
          version
          templatedFields {
            name
            value
          }
          trackable {
            id
            name
            __typename
          }
        }
      }
    }
  }
}
`;

export const GET_ARTIFACTS_FOR_ISSUE_WITH_ICON = `
query GetArtifactsForIssueWithIcon($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
      id
      title
      type {
        name
        iconPath
      }
      state {
        isOpen
      }
      incomingRelations {
        totalCount
      }
      outgoingRelations {
        totalCount
      }
      artefacts {
        nodes {
          id
          file
          from
          to
          version
          templatedFields {
            name
            value
          }
        }
      }
    }
  }
}
`;

export const UPDATE_ARTIFACT_LINES_MUTATION = `
mutation UpdateArtifactLines($id: ID!, $from: Int, $to: Int) {
  updateArtefact(input: {
    id: $id,
    from: $from,
    to: $to
  }) {
    artefact {
      id
      file
      from
      to
      version
    }
  }
}
`;

export const GET_ARTIFACTS_FOR_ISSUE = `
query GetArtifactsForIssue($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
      id
      title
      type {
        name
        iconPath
      }
      state {
        isOpen
      }
      incomingRelations {
        totalCount
      }
      outgoingRelations {
        totalCount
      }
      artefacts {
        nodes {
          id
          file
          from
          to
          version
          templatedFields {
            name
            value
          }
        }
      }
    }
  }
}
`;

export const GET_OPEN_ISSUES_WITH_ARTIFACTS = `
query GetOpenIssuesWithArtifacts {
  searchIssues(
    filter: { state: { isOpen: { eq: true } } }, 
    first: 100,
    query: "*"
  ) {
    id
    title
    type {
      name
      iconPath
    }
    state {
      isOpen
    }
    incomingRelations {
      totalCount
    }
    outgoingRelations {
      totalCount
    }
    artefacts {
      nodes {
        id
        file
        from
        to
      }
    }
  }
}
`;

export const GET_AVAILABLE_ARTIFACTS_FOR_TRACKABLES = `
query GetAvailableArtifactsForTrackables($trackableIds: [ID!]!, $issueId: ID!) {
  searchArtefacts(
    filter: {
      trackable: {
        in: $trackableIds
      },
      notInIssue: $issueId
    },
    first: 50
  ) {
    id
    file
    from
    to
    version
    templatedFields {
      name
      value
    }
    trackable {
      id
      name
      __typename
    }
  }
}
`;

export const CREATE_ARTIFACT_MUTATION = `
mutation CreateArtefact($input: CreateArtefactInput!) {
  createArtefact(input: $input) {
    artefact {
      id
      file
      from
      to
      version
      templatedFields {
        name
        value
      }
      trackable {
        id
        name
      }
    }
  }
}
`;

export const ADD_ARTIFACT_TO_ISSUE_MUTATION = `
mutation AddArtefactToIssue($input: AddArtefactToIssueInput!) {
  addArtefactToIssue(input: $input) {
    addedArtefactEvent {
      addedArtefact {
        id
      }
    }
  }
}
`;

export const GET_ARTIFACT_TEMPLATES_QUERY = `
query GetArtefactTemplates {
  artefactTemplates {
    nodes {
      id
      name
      description
      templateFieldSpecifications {
        name
        value
      }
    }
  }
}
`;

export const GET_ISSUES_OF_COMPONENT_QUERY = `
query GetIssuesOfComponent($id: ID!) {
  node(id: $id) {
    ... on Component {
      id
      name
      issues {
        nodes {
          id
          title
          type {
            name
            iconPath
          }
          state {
            isOpen
          }
          incomingRelations {
            nodes {
              id
            }
            totalCount
          }
          outgoingRelations {
            nodes {
              id
            }
            totalCount
          }
        }
      }
    }
  }
}
`;

export const FETCH_COMPONENT_VERSIONS_QUERY = `
query MyQuery {
  components {
    nodes {
      id
      name
      description
      versions {
        nodes {
          id
          tags
          version
        }
      }
      issues {
        nodes {
          id
          title
          type {
            name
          }
          state {
            isOpen
          }
        }
      }
    }
  }
}
`;

export const GET_ISSUES_OF_COMPONENT_VERSION_QUERY = `
query GetIssueIDOfComponentVersion($id: ID!) {
  node(id: $id) {
    ... on ComponentVersion {
      id
      version
      aggregatedIssues {
        nodes {
          issues {
            nodes {
              id
              title
              type {
                name
              }
              state {
                isOpen
              }
            }
          }
        }
      }
    }
  }
}
`;

export const GET_ISSUE_DETAILS = `
query GetIssueDetails($id: ID!) {
  node(id: $id) {
    ... on Issue {
      id
      title
      createdAt
      lastUpdatedAt
      issueComments {
        nodes {
          id
          body
          createdAt
          lastModifiedAt
          createdBy {
            displayName
            username
            avatar
          }
          isDeleted
        }
        totalCount
      }
      template {
        id
        name
      }
      labels {
        nodes {
          id
          name
          color
          description
        }
      }
      affects {
        nodes {
          __typename
          ... on Component {
            id
            name
          }
          ... on ComponentVersion {
            id
            version
            component {
              name
              id
            }
          }
          ... on Interface {
            id
            interfaceDefinition {
              id
            }
          }
          ... on InterfacePart {
            id
            name
          }
          ... on Project {
            id
            name
          }
        }
      }
      trackables {
        nodes {
          __typename
          ... on Component {
            id
            name
          }
          ... on Project {
            id
            name
          }
        }
      }
      state {
        id
        isOpen
        name
      }
      type {
        id
        name
        iconPath
      }
      priority {
        id
        name
      }
      body {
        id
        body
        lastModifiedAt
        createdAt
        createdBy {
          username
        }
      }
      templatedFields {
        name
        value
      }
      estimatedTime
      hasPermission(permission: READ)
      outgoingRelations {
        nodes {
          relatedIssue {
            id
            title
            state {
              isOpen
            }
            type {
              name
            }
            incomingRelations {
              totalCount
            }
            outgoingRelations {
              totalCount
            }
          }
          id
        }
        totalCount
        edges {
          node {
            type {
              name
            }
            relatedIssue {
              title
              id
            }
          }
        }
      }
      incomingRelations {
        nodes {
          issue {
            id
            title
            state {
              isOpen
            }
            type {
              name
            }
            incomingRelations {
              totalCount
            }
            outgoingRelations {
              totalCount
            }
          }
        }
        totalCount
        edges {
          node {
            type {
              name
            }
            issue {
              title
              id
            }
          }
        }
      }
      assignments {
        nodes {
          id
          user {
            username
            displayName
            avatar
          }
          type {
            name
          }
        }
      }
      templatedField(name: "")
      templatedFields {
        name
        value
      }
    }
  }
}`;

export const FETCH_COMPONENT_VERSION_BY_ID_QUERY = `
query GetComponentVersion($id: ID!) {
  node(id: $id) {
    ... on ComponentVersion {
      id
      version
      component {
        id
        name
        description
      }
    }
  }
}
`;

export const GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY = `
query GetComponentVersionsInProject($projectId: ID!) {
  project: node(id: $projectId) {
    ... on Project {
      id
      name
      components {
        nodes {
          id
          version
          component {
            id
            name
            description
          }
        }
      }
    }
  }
}
`;

export const FETCH_DYNAMIC_PROJECTS_QUERY = `
  query MyQuery {
    projects {
      nodes {
        id
        name
        issues {
          nodes {
            id
            title
          }
        }
        components {
          nodes {
            id
            version
            component {
              id
              name
              description
              issues {
                nodes {
                  id
                  title
                  type {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;


export const FETCH_PROJECT_GRAPH_QUERY = `
  query getProjectGraph($project: ID!) {
    node(id: $project) {
      ... on Project {
        components {
          nodes {
            version
            id
            component {
              id
              name
              template {
                id
                name
                fill {
                  color
                }
                stroke {
                  color
                  dash
                }
                shapeType
                shapeRadius
              }
            }
            
            aggregatedIssues {
              nodes {
                id
                type {
                  id
                  name
                  iconPath
                }
                count
                isOpen
                outgoingRelations(filter: { end: { relationPartner: { partOfProject: $project } } }) {
                  nodes {
                    id
                    end {
                      id
                      relationPartner {
                        id
                      }
                    }
                    type {
                      name
                      id
                    }
                  }
                }
                affectedByIssues: incomingRelations(filter: { start: { relationPartner: { partOfProject: $project } } }) {
                  nodes {
                    id
                    start {
                      id
                      relationPartner {
                        id
                      }
                    }
                    type {
                      name
                      id
                    }
                  }
                }
              }
            }

            outgoingRelations(filter: { end: { partOfProject: $project } }) {
              nodes {
                id
                end {
                  id
                }
                template {
                  name
                  stroke {
                    color
                    dash
                  }
                  markerType
                }
              }
            }
            
            interfaceDefinitions {
              nodes {
                visibleInterface {
                  id
                  aggregatedIssues {
                    nodes {
                      id
                      type {
                        id
                        name
                        iconPath
                      }
                      count
                      isOpen
                      outgoingRelations(filter: { end: { relationPartner: { partOfProject: $project } } }) {
                        nodes {
                          id
                          end {
                            id
                            relationPartner {
                              id
                            }
                          }
                          type {
                            name
                            id
                          }
                        }
                      }
                      affectedByIssues: incomingRelations(filter: { start: { relationPartner: { partOfProject: $project } } }) {
                        nodes {
                          id
                          start {
                            id
                            relationPartner {
                              id
                            }
                          }
                          type {
                            name
                            id
                          }
                        }
                      }
                    }
                  }
                  outgoingRelations(filter: { end: { partOfProject: $project } }) {
                    nodes {
                      id
                      end {
                        id
                      }
                      template {
                        name
                        stroke {
                          color
                          dash
                        }
                        markerType
                      }
                    }
                  }
                }
                interfaceSpecificationVersion {
                  id
                  version
                  interfaceSpecification {
                    id
                    name
                    template {
                      id
                      name
                      fill {
                        color
                      }
                      stroke {
                        color
                        dash
                      }
                      shapeType
                      shapeRadius
                    }
                  }
                }
              }
            }
          }
        }
        relationLayouts {
          nodes {
            relation {
              id
            }
            points {
              x
              y
            }
          }
        }
        relationPartnerLayouts {
          nodes {
            relationPartner {
              id
            }
            pos {
              x
              y
            }
          }
        }
      }
    }
  }
`;

export const UPDATE_BODY_MUTATION = `
mutation UpdateBody($input: UpdateBodyInput!) {
  updateBody(input: $input) {
    body {
      id
      body
      lastModifiedAt
    }
  }
}
`;


// Mutation to change issue priority
export const CHANGE_ISSUE_PRIORITY_MUTATION = `
mutation ChangeIssuePriority($input: ChangeIssuePriorityInput!) {
  changeIssuePriority(input: $input) {
    priorityChangedEvent {
      newPriority {
        id
        name
      }
    }
  }
}
`;

// Mutation to change issue state
export const CHANGE_ISSUE_STATE_MUTATION = `
mutation ChangeIssueState($input: ChangeIssueStateInput!) {
  changeIssueState(input: $input) {
    stateChangedEvent {
      newState {
        id
        name
        isOpen
      }
    }
  }
}
`;

// Mutation to change issue type
export const CHANGE_ISSUE_TYPE_MUTATION = `
mutation ChangeIssueType($input: ChangeIssueTypeInput!) {
  changeIssueType(input: $input) {
    typeChangedEvent {
      newType {
        id
        name
        iconPath
      }
    }
  }
}
`;

// Query to get available issue priorities 
export const GET_ISSUE_TEMPLATE_PRIORITIES = `
query GetIssuePriorities {
  searchIssuePriorities(first: 500, query: "*") {
    id
    name
  }
}
`;

// Query to get available issue states
export const GET_ISSUE_TEMPLATE_STATES = `
query GetIssueStates {
  searchIssueStates(first: 500, query: "*") {
    id
    name
    isOpen
  }
}
`;

// Query to get available issue types
export const GET_ISSUE_TEMPLATE_TYPES = `
query GetIssueTypes {
  searchIssueTypes(first: 500, query: "*") {
    id
    name
  }
}
`;

// Mutation to change issue title
export const CHANGE_ISSUE_TITLE_MUTATION = `
mutation ChangeIssueTitle($input: ChangeIssueTitleInput!) {
  changeIssueTitle(input: $input) {
    titleChangedEvent {
      newTitle
    }
  }
}
`;

// Queries to get users and assignment types
export const GET_ALL_USERS = `
query GetAllUsers {
  searchUsers(first: 500, query: "*") {
    id
    username
    displayName
  }
}
`;

export const GET_ASSIGNMENT_TYPES_FOR_TEMPLATE = `
query GetAssignmentTypesForTemplate($templateId: ID!) {
  node(id: $templateId) {
    ... on IssueTemplate {
      id
      name
      assignmentTypes {
        nodes {
          id
          name
          description
        }
      }
    }
  }
}
`;

// Mutations for assignments
export const CREATE_ASSIGNMENT_MUTATION = `
mutation CreateAssignment($input: CreateAssignmentInput!) {
  createAssignment(input: $input) {
    assignment {
      id
      user {
        username
        displayName
      }
      type {
        id
        name
      }
    }
  }
}
`;

export const REMOVE_ASSIGNMENT_MUTATION = `
mutation RemoveAssignment($input: RemoveAssignmentInput!) {
  removeAssignment(input: $input) {
    removedAssignmentEvent {
      id
    }
  }
}
`;

export const CHANGE_ASSIGNMENT_TYPE_MUTATION = `
mutation ChangeAssignmentType($input: ChangeAssignmentTypeInput!) {
  changeAssignmentType(input: $input) {
    assignmentTypeChangedEvent {
      assignment {
        id
        type {
          id
          name
        }
      }
    }
  }
}
`;

export const GET_TEMPLATE_OPTIONS = `
query GetTemplateOptions($templateId: ID!) {
  node(id: $templateId) {
    ... on IssueTemplate {
      id
      name
      issueTypes {
        nodes {
          id
          name
        }
      }
      issueStates {
        nodes {
          isOpen
          id
          name
        }
      }
      issuePriorities {
        nodes {
          id
          name
        }
      }
    }
  }
}
`;

export const GET_ISSUE_TEMPLATES = `
query GetIssueTemplates {
  issueTemplates {
    nodes {
      id
      name
      description
      issueTypes {
        nodes {
          id
          name
        }
      }
      issueStates {
        nodes {
          id
          name
          isOpen
        }
      }
      templateFieldSpecifications {
        name
        value
      }
    }
  }
}
`;

export const CREATE_ISSUE_MUTATION = `
mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
    issue {
      id
      title
      type {
        name
      }
      state {
        isOpen
      }
    }
  }
}
`;

/**
 * Fetch all Components of the given List
 * List: Workspace components (versions)
 * All comonents, with issues
 * Issues concerning a hole component or a specific componentversion
 * 
 * For extracting: First check whether there are versions
 * -> YES: take the issues of versions
 * -> NO: take the issues for component
 * --> If a issue is selected to the component and to a comonentversion it will affect all componentversions. Always if the whole component is affected it is for all componentversions 
 * --> Thats why we do not have to differ.
 * --> TEST this !
 */
export const FETCH_ALL_WORKSPACE_COMPONENTS_AND_ISSUES = `query MyQuery($in: [ID!]) {
  components(filter: {id: {in: $in}}) {
    nodes {
      id
      name
      issues {
        nodes {
          id
          title
          aggregatedBy {
            nodes {
              id
              issues {
                nodes {
                  id
                  title
                  type {
                    name
                    iconPath
                  }
                }
              }
              count
              isOpen
            }
          }
        }
      }
      versions {
        nodes {
          version
          id
          aggregatedIssues {
            nodes {
              count
              isOpen
              id
              type {
                id
                name
                iconPath
              }
              outgoingRelations {
                nodes {
                  end {
                    id
                    relationPartner {
                      id
                    }
                    type {
                      id
                    }
                  }
                  start {
                    id
                    type {
                      id
                    }
                  }
                }
              }
            }
          }
          incomingRelations {
            nodes {
              start {
                id
              }
              end {
                id
              }
              template {
                stroke {
                  color
                  dash
                }
                markerType
              }
              id
            }
          }
          interfaceDefinitions {
            nodes {
              visibleInterface {
                id
                aggregatedIssues {
                  nodes {
                    id
                    isOpen
                    count
                    type {
                      iconPath
                      name
                    }
                  }
                }
              }
              interfaceSpecificationVersion {
                interfaceSpecification {
                  name
                  template {
                    fill {
                      color
                    }
                    stroke {
                      color
                      dash
                    }
                    shapeRadius
                    shapeType
                  }
                  id
                }
                version
                id
              }
              id
            }
          }
        }
      }
      template {
        shapeType
        fill {
          color
        }
        stroke {
          color
        }
      }
    }
  }
}
`;

/**
 * Fetch all information of the selected issue
 * All related issues
 * All componentversions of those issues
 */
export const FETCH_FOR_ISSUE_GRAPH = `query MyQuery($id: ID!) {
  node(id: $id) {
    ... on Issue {
      id
      state {
        isOpen
      }
      type {
        name
        iconPath
      }
      affects {
        nodes {
          ... on ComponentVersion {
            id
            version
            template {
              id
              name
            }
            component {
              name
            }
            aggregatedIssues {
              nodes {
                count
                isOpen
                id
                type {
                  id
                  name
                  iconPath
                }
                outgoingRelations {
                  nodes {
                    end {
                      id
                      relationPartner {
                        id
                      }
                      type {
                        id
                      }
                    }
                    start {
                      id
                      type {
                        id
                      }
                    }
                  }
                }
              }
            }
            incomingRelations {
              nodes {
                start {
                  id
                }
                end {
                  id
                }
                template {
                  stroke {
                    color
                    dash
                  }
                  markerType
                }
                id
              }
            }
            interfaceDefinitions {
              nodes {
                visibleInterface {
                  id
                  aggregatedIssues {
                    nodes {
                      id
                      isOpen
                      count
                      type {
                        iconPath
                        name
                      }
                    }
                  }
                }
                interfaceSpecificationVersion {
                  interfaceSpecification {
                    name
                    template {
                      fill {
                        color
                      }
                      stroke {
                        color
                        dash
                      }
                    }
                    id
                  }
                  version
                  id
                }
                id
              }
            }
          }
          ... on Interface {
            id
          }
        }
      }
    }
  }
}`;

/**
 * TEMP Query for issue graph
 */
export const FETCH_TEMP_ISSUE_GRAPH = `query MyQuery($id: ID!) {
  node(id: $id) {
    ... on Issue {
      id
      title
      state {
        isOpen
      }
      type {
        name
        iconPath
      }
      aggregatedBy {
        nodes {
          count
          id
          relationPartner {
            ... on ComponentVersion {
              id
              component {
                name
                template {
                  shapeType
                  fill {
                    color
                  }
                  stroke {
                    color
                  }
                }
              }
              version
              incomingRelations {
                nodes {
                  start {
                    id
                  }
                  end {
                    id
                  }
                  template {
                    stroke {
                      color
                      dash
                    }
                    markerType
                  }
                  id
                }
              }
              outgoingRelations {
                nodes {
                  start {
                    id
                  }
                  end {
                    id
                  }
                  template {
                    stroke {
                      color
                      dash
                    }
                    markerType
                  }
                  id
                }
              }
              interfaceDefinitions {
                nodes {
                  visibleInterface {
                    id
                    aggregatedIssues {
                      nodes {
                        id
                        isOpen
                        count
                        type {
                          iconPath
                          name
                        }
                      }
                    }
                  }
                  interfaceSpecificationVersion {
                    interfaceSpecification {
                      name
                      template {
                        fill {
                          color
                        }
                        stroke {
                          color
                          dash
                        }
                        shapeRadius
                        shapeType
                      }
                      id
                    }
                    version
                    id
                  }
                  id
                }
              }
            }
          }
        }
      }
      incomingRelations {
        nodes {
          issue {
            id
            type {
              name
              iconPath
            }
            state {
              isOpen
            }
            aggregatedBy {
              nodes {
                count
                relationPartner {
                  ... on ComponentVersion {
                    id
                    component {
                      name
                      template {
                        shapeType
                        fill {
                          color
                        }
                        stroke {
                          color
                        }
                      }
                    }
                    version
                    incomingRelations {
                      nodes {
                        start {
                          id
                        }
                        end {
                          id
                        }
                        template {
                          stroke {
                            color
                            dash
                          }
                          markerType
                        }
                        id
                      }
                    }
                    interfaceDefinitions {
                      nodes {
                        visibleInterface {
                          id
                          aggregatedIssues {
                            nodes {
                              id
                              isOpen
                              count
                              type {
                                iconPath
                                name
                              }
                            }
                          }
                        }
                        interfaceSpecificationVersion {
                          interfaceSpecification {
                            name
                            template {
                              fill {
                                color
                              }
                              stroke {
                                color
                                dash
                              }
                              shapeRadius
                              shapeType
                            }
                            id
                          }
                          version
                          id
                        }
                        id
                      }
                    }
                  }
                }
                id
                isOpen
              }
            }
          }
        }
      }
      outgoingRelations {
        nodes {
          relatedIssue {
            id
            type {
              name
              iconPath
            }
            state {
              isOpen
            }
            aggregatedBy {
              nodes {
                count
                relationPartner {
                  ... on ComponentVersion {
                    id
                    component {
                      name
                      template {
                        shapeType
                        fill {
                          color
                        }
                        stroke {
                          color
                        }
                      }
                    }
                    version
                    interfaceDefinitions {
                      nodes {
                        visibleInterface {
                          id
                          aggregatedIssues {
                            nodes {
                              id
                              isOpen
                              count
                              type {
                                iconPath
                                name
                              }
                            }
                          }
                        }
                        interfaceSpecificationVersion {
                          interfaceSpecification {
                            name
                            template {
                              fill {
                                color
                              }
                              stroke {
                                color
                                dash
                              }
                              shapeRadius
                              shapeType
                            }
                            id
                          }
                          version
                          id
                        }
                        id
                      }
                    }
                    incomingRelations {
                      nodes {
                        start {
                          id
                        }
                        end {
                          id
                        }
                        template {
                          stroke {
                            color
                            dash
                          }
                          markerType
                        }
                        id
                      }
                    }
                  }
                }
                id
                isOpen
              }
            }
          }
        }
      }
    }
  }
}`;

export const GET_ISSUE_RELATION_TYPES = `
query GetIssueRelationTypes(
  $filter: IssueRelationTypeFilterInput,
  $first: Int!,
  $query: String!,
  $skip: Int
) {
  searchIssueRelationTypes(filter: $filter, first: $first, query: $query, skip: $skip) {
    id
    name
    description
  }
}
`;

export const REMOVE_ISSUE_RELATION_MUTATION = `
mutation removeIssueRelation($relationId: ID!) {
  removeIssueRelation(input: { issueRelation: $relationId }) {
    removedOutgoingRelationEvent {
      id
      removedRelation {
        id
        relatedIssue {
          id
          title
        }
      }
    }
  }
}
`;

export const CHANGE_ISSUE_RELATION_TYPE_MUTATION = `
mutation changeIssueRelationType($input: ChangeIssueRelationTypeInput!) {
  changeIssueRelationType(input: $input) {
    outgoingRelationTypeChangedEvent {
      id
      newType {
        id
        name
      }
    }
  }
}
`;

export const GET_COMPONENT_ISSUES_BY_ID_QUERY = `
query getComponentIssuesById($componentId: ID!, $first: Int!, $query: String!, $skip: Int) {
  searchComponents(
    filter: { id: { eq: $componentId } },
    first: $first,
    query: $query,
    skip: $skip
  ) {
    id
    name
    issues {
      nodes {
        id
        title
        state { isOpen }
        type { name }
        outgoingRelations { totalCount }
        incomingRelations { totalCount }
      }
    }
  }
}
`;

export const CREATE_ISSUE_RELATION_MUTATION = `
  mutation CreateIssueRelation($input: CreateIssueRelationInput!) {
    createIssueRelation(input: $input) {
      issueRelation {
        id
        type {
          id
          name
          inverseName
          description
        }
      }
    }
  }
`;

export const GET_ALL_LABELS_QUERY = `
  query GetAllLabels($originComponentId: ID, $first: Int!, $query: String!, $skip: Int) {
    searchLabels(
      filter: {
        trackables: {
          any: {
            id: {
              eq: $originComponentId
            }
          }
        }
      },
      first: $first,
      query: $query,
      skip: $skip
    ) {
      id
      name
      color
      description
    }
  }
`;

export const ADD_LABEL_TO_ISSUE_MUTATION = `
  mutation AddLabelToIssue($input: AddLabelToIssueInput!) {
    addLabelToIssue(input: $input) {
      addedLabelEvent {
        addedLabel {
          id
          name
          color
        }
      }
    }
  }
`;

export const REMOVE_LABEL_FROM_ISSUE_MUTATION = `
mutation RemoveLabelFromIssue($input: RemoveLabelFromIssueInput!) {
  removeLabelFromIssue(input: $input) {
    removedLabelEvent {
      removedLabel {
        id
        name
        color
      }
    }
  }
}
`;

export const CREATE_LABEL_MUTATION = `
mutation CreateLabel($input: CreateLabelInput!) {
  createLabel(input: $input) {
    label {
      id
      name
      color
      description
    }
  }
}
`;

export const GET_AVAILABLE_COMPONENTS = `
query GetAvailableComponents {
  components(first: 50) {
    nodes {
      id
      name
      description
    }
  }
}
`;

export const GET_AVAILABLE_PROJECTS = `
query GetAvailableProjects {
  projects(first: 20) {
    nodes {
      id
      name
    }
  }
}
`;

export const GET_COMPONENTS_BY_IDS = `
query GetComponentsByIds($ids: [ID!]!) {
  components(filter: {id: {in: $ids}}) {
    nodes {
      id
      name
      description
    }
  }
}
`;

export const REMOVE_ARTIFACT_FROM_ISSUE_MUTATION = `
mutation RemoveArtefactFromIssue($input: RemoveArtefactFromIssueInput!) {
  removeArtefactFromIssue(input: $input) {
    removedArtefactEvent {
      removedArtefact {
        id
      }
    }
  }
}
`;


export const DELETE_ISSUE_COMMENT_MUTATION = `
mutation DeleteIssueComment($input: DeleteNodeInput!) {
  deleteIssueComment(input: $input) {
    issueComment {
      id
      isDeleted
      body
      createdAt
      lastModifiedAt
      createdBy {
        displayName
        username
      }
    }
  }
}
`;

export const REMOVE_AFFECTED_ENTITY_FROM_ISSUE_MUTATION = `
mutation RemoveAffectedEntityFromIssue($issue: ID!, $affectedEntity: ID!) {
  removeAffectedEntityFromIssue(
    input: {issue: $issue, affectedEntity: $affectedEntity}
  ) {
    removedAffectedEntityEvent {
      removedAffectedEntity {
        id
      }
    }
  }
}`;

export const GET_AFFECTED_ENTITIES = `
query GetAffectedEntities {
  projects {
    nodes {
      id
      name
    }
  }
  components {
    nodes {
      id
      name
      versions {
        nodes {
          id
          version
        }
      }
    }
  }
}
`;

export const ADD_AFFECTED_ENTITY_TO_ISSUE = `
mutation AddAffectedEntityToIssue($input: AddAffectedEntityToIssueInput!) {
  addAffectedEntityToIssue(input: $input) {
    addedAffectedEntityEvent {
      addedAffectedEntity {
        __typename
        ... on Component { id name }
        ... on ComponentVersion { id version component { id name } }
        ... on Project   { id name }
      }
    }
  }
}
`;


export const UPDATE_ISSUE_COMMENT_MUTATION = `
mutation UpdateIssueComment($input: UpdateIssueCommentInput!) {
  updateIssueComment(input: $input) {
    issueComment {
      id
      body
      lastModifiedAt
      createdAt
      createdBy {
        displayName
        username
      }
    }
  }
}
`;

export const CREATE_ISSUE_COMMENT_MUTATION = `
  mutation CreateIssueComment($input: CreateIssueCommentInput!) {
    createIssueComment(input: $input) {
      issueComment {
        id
        body
        createdAt
        createdBy {
          id
          displayName
          username
        }
        lastModifiedAt
      }
    }
  }
`;