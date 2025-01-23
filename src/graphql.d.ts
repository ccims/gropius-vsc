declare module '*.graphql' {
    import { DocumentNode } from 'graphql';
    const content: DocumentNode;
    export default content;
    
    // For named exports of specific queries/mutations
    export const GET_PROJECT_GRAPH: DocumentNode;
    // Add other named exports as needed
  }