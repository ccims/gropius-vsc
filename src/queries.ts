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

export const FETCH_COMPONENT_VERSION_BY_ID_QUERY = `
query GetComponentVersion($id: ID!) {
  node(id: $id) {
    ... on ComponentVersion {
      id
      version
      component {
        id
        name
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
