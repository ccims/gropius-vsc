import("node-fetch");

/**
 * APIClient is responsible for interacting with an OAuth-secured API.
 * It provides methods to authenticate and execute GraphQL queries.
 */
export class APIClient {
    private token: string | null = null;

    constructor(private url: string, private clientId: string, private clientSecret: string) {}

    /**
     * Authenticates with the API using OAuth client credentials grant.
     * Retrieves an access token and stores it in the `token` property.
     */
    async authenticate(): Promise<void> {
        const response = await fetch(`${this.url}/auth/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: this.clientId,
                client_secret: this.clientSecret,
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.token = data.access_token;
    }

    /**
     * Executes a GraphQL query against the API.
     * @param query - The GraphQL query string to execute.
     * @param variables - Variables for the GraphQL query (optional).
     */
    async executeQuery(query: string, variables?: Record<string, any>): Promise<any> {
        if (!this.token) {
            throw new Error("Not authenticated. Please call authenticate() first.");
        }

        const response = await fetch(`${this.url}/api/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(`GraphQL query failed: ${response.statusText}`);
        }

        return response.json();
    }
}
