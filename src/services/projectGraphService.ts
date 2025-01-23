import type { ProjectGraphResponse } from '@/types/projectGraph';
import { GET_PROJECT_GRAPH } from '@/graphql/graph.graphql';

export class ProjectGraphService {
  private client: any; // Replace 'any' with your actual GraphQL client type

  constructor(graphqlClient: any) {
    this.client = graphqlClient;
  }

  async getProjectGraph(id: string): Promise<ProjectGraphResponse> {
    try {
      const response = await this.client.query({
        query: GET_PROJECT_GRAPH,
        variables: {
          project: id
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching project graph:', error);
      throw error;
    }
  }
}