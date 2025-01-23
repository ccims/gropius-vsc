export interface ProjectGraphResponse {
    node: {
      components: {
        nodes: Array<{
          version: string;
          component: {
            id: string;
            name: string;
            template: {
              id: string;
              name: string;
              fill: {
                color: string;
              };
              stroke: {
                color: string;
                dash: string;
              };
              shapeType: string;
              shapeRadius: number;
            };
          };
        }>;
      };
      relationLayouts: {
        nodes: Array<{
          relation: {
            id: string;
          };
          points: Array<{
            x: number;
            y: number;
          }>;
        }>;
      };
      relationPartnerLayouts: {
        nodes: Array<{
          relationPartner: {
            id: string;
          };
          pos: {
            x: number;
            y: number;
          };
        }>;
      };
    };
  }