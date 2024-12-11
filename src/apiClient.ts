import("node-fetch");

export class APIClient {
    private token: string | null = null;

    constructor(private url: string, private clientId: string, private clientSecret: string) {}

    // Authenticate and retrieve the token
    async authenticate(): Promise<void> {
        const response = await fetch(`${this.url}/auth/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: this.clientId,
                client_secret: this.clientSecret
            }).toString()
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.token = data.access_token;
    }

    // Execute a GraphQL query
    async executeQuery(query: string): Promise<any> {
        if (!this.token) {
            throw new Error("Not authenticated. Please call authenticate() first.");
        }

        const response = await fetch(`${this.url}/api/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}`
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`GraphQL query failed: ${response.statusText}`);
        }

        return response.json();
    }
}