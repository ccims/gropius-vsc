import exp from "constants";

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
    }
  }
}
`;

export const GET_ARTIFACTS_FOR_ISSUE = `
query GetArtifactsForIssue($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
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
      labels {
        nodes {
          name
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
      state {
        isOpen
        name
      }
      type {
        name
      }
      priority {
        name
      }
      body {
        body
        lastModifiedAt
      }
      estimatedTime
      hasPermission(permission: READ)
      outgoingRelations {
        nodes {
          issue {
            id
            title
          }
        }
      }
      incomingRelations {
        nodes {
          issue {
            id
            title
          }
        }
      }
    }
  }
}
`;

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
/**
 * Query for the workspace graph.
 * Fetches Componentversion, Component or Project refering to the given id
 */
export const FETCH_WORKSPACE_GRAPH_QUERY = `{
  query getAllForWorkspace($givenID: ID!) {
    node(id: $givenID) {
      ... on ComponentVersion {
        id
        component {
          id
          name
        }
        version
      }
      ... on Component {
        id
        name
      }
      ... on Project {
        id
        name
      }
    }
  }`;

/**
 * Query to fetch all components concerning one issue for the issue graph
 */
export const FETCH_ISSUES_GRAPH_QUERY = `{
  query MyQuery($in: [ID!] = ["d2bb5c86-aa45-41cb-802a-37f1ce487ddb", "3adbeeb7-ccaf-46fb-a7a5-13686d1b98ea"]) {
   components(filter: {issues: {any: {id: {in: $in}}}}) {
     nodes {
       id
       name
      }
  }
 }
}`;

/**
 * Temp Query to get all workspace components
 */
export const FETCH_ALL_WORKSPACE_COMPONENTS = `
  query MyQuery($in: [ID!] = "") {
  components(filter: {id: {in: $in}}) {
    nodes {
      id
      name
      template {
        id
        name
      }
    }
  }
}
`;