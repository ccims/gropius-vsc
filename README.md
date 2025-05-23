# Running the Gropius Visual Studio Code Extension

Before you start, note that **more detailed information** about the extension, its functionality, and usage can be found in the [Gropius VS Code Extension Wiki](https://github.com/ccims/gropius-vsc/wiki).  
We highly recommend checking the [User Documentation](https://github.com/ccims/gropius-vsc/wiki/User-Documentation) to better understand the concepts and functionality behind the extension.

---

# How to Run the Application

1. **Apply Credentials**
   - Open `src/config.ts`.
   - Enter your **client credentials**, API endpoints, or any other required configuration.
   - You need this to connect the extension with the gropius frontend.

   Example configuration:
   ![Example configuration for config.ts](./assets/image-18.png)

2. **Install Dependencies**
   ```bash
   npm install
   ```
   
3. **Launch in VS Code**
   - Press **F5** to start a new VS Code instance with your extension (or application) loaded.
   - Open a workspace in Visual Studio Code.

---

# Starting Gropius

1. **Generate the Environment**
   - Update your system and install required tools:
     ```bash
     sudo apt-get update
     sudo apt-get install dos2unix
     ```
   - Convert the script and execute it:
     ```bash
     dos2unix generate_env.sh
     ./generate_env.sh
     ```

2. **Build the Project**
   - Use Docker Compose to start the Gropius environment:
     ```bash
     docker compose up
     ```

3. **Log In**
   - Use the default admin credentials to log in:
     ```
     Username: admin
     Password: admin
     ```

---

# Import Templates

1. **Create an Auth Client**
   - Use **Client Credential flow** as **System-Admin**.
   - Ensure the following:
     - The client requires a secret.
     - The client is marked as valid.

2. **Download the Templates**
   - Obtain a prepared template file, e.g., `templates 1.json`.

3. **Clone the Templates Importer**
   - Clone the repository for the template importer:
     ```bash
     git clone https://github.com/ccims/template-importer
     ```

4. **Build and Run the Script**
   - Install dependencies and build the project:
     ```bash
     npm i
     npm run build
     ```
   - Run the importer script with your template file and credentials:
     ```bash
     npm start <file_path> <client_id> <client_secret> [gropius_endpoint]
     ```
   **Example**:
   ```bash
   npm start '.\templates 1.json' ebd7bfaf-7136-4549-b0b3-17a8b16a104b 9755d60ecd5ee8d94f10b293cd8bba
   ```

   - `<file_path>`: Path to the templates file (e.g., `templates.json`).
   - `<client_id>` and `<client_secret>`: Credentials from the auth client.
   - `[gropius_endpoint]`: Optional. If omitted, defaults to a local or pre-configured endpoint.
