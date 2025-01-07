import("node-fetch"); // Importing node-fetch for HTTP requests

/**
 * APIClient is responsible for interacting with an OAuth-secured API.
 * It provides methods to authenticate and execute GraphQL queries.
 */
export class APIClient {
    // Token used for API authentication
    private token: string | null = null;

    /**
     * Initializes the APIClient with the necessary configuration.
     * @param {string} url - The base URL of the API.
     * @param {string} clientId - The client ID for OAuth authentication.
     * @param {string} clientSecret - The client secret for OAuth authentication.
     */
    constructor(private url: string, private clientId: string, private clientSecret: string) {}

    /**
     * Authenticates with the API using OAuth client credentials grant.
     * It retrieves an access token and stores it in the `token` property.
     * @returns {Promise<void>} - Resolves when authentication is successful.
     * @throws {Error} - Throws an error if authentication fails.
     */
    async authenticate(): Promise<void> {
        // Make a POST request to the OAuth token endpoint
        const response = await fetch(`${this.url}/auth/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "client_credentials", // OAuth grant type
                client_id: this.clientId,         // OAuth client ID
                client_secret: this.clientSecret  // OAuth client secret
            }).toString()
        });

        // Check if the response is not successful
        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        // Parse the response JSON and extract the access token
        const data = await response.json();
        this.token = data.access_token; // Store the token for future requests
    }

    /**
     * Executes a GraphQL query against the API.
     * Requires prior authentication using the `authenticate` method.
     * @param {string} query - The GraphQL query string to execute.
     * @returns {Promise<any>} - Resolves with the JSON response of the query.
     * @throws {Error} - Throws an error if not authenticated or the query fails.
     */
    async executeQuery(query: string): Promise<any> {
        // Ensure the client is authenticated before executing the query
        if (!this.token) {
            throw new Error("Not authenticated. Please call authenticate() first.");
        }

        // Make a POST request to the GraphQL endpoint
        const response = await fetch(`${this.url}/api/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}` // Include the access token in the Authorization header
            },
            body: JSON.stringify({ query }) // Send the query in the request body
        });

        // Check if the response is not successful
        if (!response.ok) {
            throw new Error(`GraphQL query failed: ${response.statusText}`);
        }

        // Parse and return the JSON response
        return response.json();
    }
}