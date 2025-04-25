import * as vscode from "vscode";
import { exec } from 'child_process';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { loadConfigurations } from './mapping/config-loader';
import {
  REMOVE_ARTIFACT_FROM_ISSUE_MUTATION,
  GET_AVAILABLE_ARTIFACTS_FOR_TRACKABLES,
  FETCH_COMPONENT_VERSIONS_QUERY,
  FETCH_DYNAMIC_PROJECTS_QUERY,
  FETCH_PROJECT_GRAPH_QUERY,
  GET_ISSUES_OF_COMPONENT_VERSION_QUERY,
  GET_ISSUE_DETAILS,
  FETCH_COMPONENT_VERSION_BY_ID_QUERY,
  GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY,
  GET_ARTIFACTS_FOR_ISSUE,
  CREATE_ARTIFACT_MUTATION,
  ADD_ARTIFACT_TO_ISSUE_MUTATION,
  GET_ARTIFACT_TEMPLATES_QUERY,
  GET_ISSUES_OF_COMPONENT_QUERY,
  UPDATE_BODY_MUTATION,
  CHANGE_ISSUE_PRIORITY_MUTATION,
  CHANGE_ISSUE_TYPE_MUTATION,
  CHANGE_ISSUE_STATE_MUTATION,
  GET_ISSUE_TEMPLATE_TYPES,
  GET_ISSUE_TEMPLATE_STATES,
  GET_ISSUE_TEMPLATE_PRIORITIES,
  CHANGE_ISSUE_TITLE_MUTATION,
  GET_ASSIGNMENT_TYPES_FOR_TEMPLATE,
  CHANGE_ASSIGNMENT_TYPE_MUTATION,
  REMOVE_ASSIGNMENT_MUTATION,
  GET_TEMPLATE_OPTIONS,
  GET_ALL_USERS,
  CREATE_ASSIGNMENT_MUTATION,
  REMOVE_ISSUE_RELATION_MUTATION,
  CHANGE_ISSUE_RELATION_TYPE_MUTATION,
  GET_ISSUE_RELATION_TYPES,
  FETCH_ALL_WORKSPACE_COMPONENTS_AND_ISSUES,
  FETCH_FOR_ISSUE_GRAPH,
  FETCH_TEMP_ISSUE_GRAPH,
  GET_COMPONENT_ISSUES_BY_ID_QUERY,
  CREATE_ISSUE_RELATION_MUTATION,
  GET_ALL_LABELS_QUERY,
  ADD_LABEL_TO_ISSUE_MUTATION,
  REMOVE_LABEL_FROM_ISSUE_MUTATION,
  CREATE_LABEL_MUTATION,
  GET_ISSUE_TEMPLATES,
  CREATE_ISSUE_MUTATION,
  GET_COMPONENTS_BY_IDS,
  GET_AVAILABLE_COMPONENTS,
  GET_AVAILABLE_PROJECTS,
  GET_ARTIFACTS_FOR_TRACKABLE
} from "./queries";
import path from "path";
import { workerData } from "worker_threads";

// Create a single, global API client instance
const globalApiClient = new APIClient(API_URL, CLIENT_ID, CLIENT_SECRET);

// Create the artifact decorator manager (code highlighting)
let artifactDecoratorManager: ArtifactDecoratorManager;

/**
 * Interface for component tree items in the Gropius Component Versions provider
 */
interface ComponentTreeItem {
  id?: string;
  componentVersionIds?: string[];
  name: string;
  description?: string;
  versions?: string[];
  children?: ComponentTreeItem[];
  expanded: boolean;
}

interface DescriptionEditorData {
  markdown: string;
  issueId: string;
  bodyId: string;
  issueTitle?: string; // Make issueTitle optional
}

/**
 * Loads and registers all artifacts for open issues
 */
async function loadAndRegisterOpenIssueArtifacts() {
  try {
    console.log('[loadAndRegisterOpenIssueArtifacts] Loading artifacts for open issues...');

    // Authenticate before making API calls
    await globalApiClient.authenticate();

    // Query for open issues with their artifacts
    const result = await globalApiClient.executeQuery(`
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
          }
          state {
            isOpen
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
    `);

    // Process the results
    if (result.data?.searchIssues) {
      const openIssues = result.data.searchIssues;
      console.log(`[loadAndRegisterOpenIssueArtifacts] Found ${openIssues.length} open issues`);

      // Track the number of artifacts registered
      let artifactsRegistered = 0;

      // Register each artifact from each open issue
      for (const issue of openIssues) {
        if (issue.artefacts && issue.artefacts.nodes) {
          for (const artifact of issue.artefacts.nodes) {
            if (artifact.file && artifact.from && artifact.to) {
              // Register artifact with the decorator manager
              artifactDecoratorManager.registerArtifact(
                artifact.id,
                artifact.file,
                artifact.from,
                artifact.to,
                {
                  issueId: issue.id,
                  issueType: issue.type.name,
                  isOpen: issue.state.isOpen,
                  title: issue.title
                }
              );

              artifactsRegistered++;
            }
          }
        }
      }

      console.log(`[loadAndRegisterOpenIssueArtifacts] Registered ${artifactsRegistered} artifacts from open issues`);
    }
  } catch (error) {
    console.error('[loadAndRegisterOpenIssueArtifacts] Error:', error);
    vscode.window.showErrorMessage(`Failed to load artifacts for open issues: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Loads and registers artifacts for a specific issue
 * @param issueId The issue ID
 */
async function loadAndRegisterIssueArtifacts(issueId: string) {
  try {
    console.log(`[loadAndRegisterIssueArtifacts] Loading artifacts for issue ${issueId}...`);

    // Authenticate before making API calls
    await globalApiClient.authenticate();

    // Get the issue details with its artifacts
    const result = await globalApiClient.executeQuery(
      GET_ARTIFACTS_FOR_ISSUE,
      { issueId }
    );

    // Process the result
    if (result.data?.node) {
      const issue = result.data.node;

      if (issue.artefacts && issue.artefacts.nodes) {
        console.log(`[loadAndRegisterIssueArtifacts] Found ${issue.artefacts.nodes.length} artifacts for issue ${issueId}`);

        // Register each artifact for this issue
        for (const artifact of issue.artefacts.nodes) {
          if (artifact.file && artifact.from && artifact.to) {
            artifactDecoratorManager.registerArtifact(
              artifact.id,
              artifact.file,
              artifact.from,
              artifact.to,
              {
                issueId: issue.id,
                issueType: issue.type.name,
                isOpen: issue.state.isOpen,
                title: issue.title
              }
            );
          }
        }
      } else {
        console.log(`[loadAndRegisterIssueArtifacts] No artifacts found for issue ${issueId}`);
      }
    }
  } catch (error) {
    console.error(`[loadAndRegisterIssueArtifacts] Error for issue ${issueId}:`, error);
    vscode.window.showErrorMessage(`Failed to load artifacts for issue: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Registers all providers and commands in VS Code
 */
export function activate(context: vscode.ExtensionContext) {

  // Initialize the artifact decorator manager
  artifactDecoratorManager = new ArtifactDecoratorManager(context);

  // manually refresh artifact highlights
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshArtifactHighlights', () => {
      loadAndRegisterOpenIssueArtifacts();
    })
  );

  loadAndRegisterOpenIssueArtifacts();

  // 1) Register the Gropius Component Versions view
  const gropiusComponentVersionsProvider = new GropiusComponentVersionsProvider(context, globalApiClient);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GropiusComponentVersionsProvider.viewType,
      gropiusComponentVersionsProvider
    )
  );

  // 2) Register the "Component Issues" view
  const componentIssuesProvider = new ComponentIssuesProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("componentIssues", componentIssuesProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.showComponentVersionIssues', async (componentVersionId: string): Promise<void> => {
      await componentIssuesProvider.updateVersionIssues(componentVersionId);
      componentIssuesProvider.revealView();
    })
  );

  // Register command to refresh component issues
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshComponentIssues', () => {
      componentIssuesProvider.refreshCurrentIssues();
    })
  );
  // Register command to handle issue updates and propagate them to other views
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.issueUpdated', (data) => {
      // Notify ComponentIssuesProvider about the update
      componentIssuesProvider.handleIssueUpdate(data);
    })
  );


  // 3) Register the "Issue Details" view
  const issueDetailsProvider = new IssueDetailsProvider(context, globalApiClient, context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IssueDetailsProvider.viewType, issueDetailsProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshCurrentIssue', () => {
      issueDetailsProvider.refreshCurrentIssue();
    })
  );

  // Command to create Artifacts 
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createArtifact', async (issueId) => {

      // Get the active text editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found. Please open a file and select code.');
        return;
      }

      // Get selection range and check if any code is actually selected
      const selection = editor.selection;

      // Check if the selection is empty (cursor is just at one position)
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('No code selected. Please select the code you want to create an artifact for.');
        return;
      }

      const from = selection.start.line + 1; // 1-based line numbers
      const to = selection.end.line + 1;
      const filePath = editor.document.uri.toString();

      try {
        // Authenticate
        await globalApiClient.authenticate();

        // 1. Fetch the issue details to see which trackables it affects
        const issueDetailsResult = await globalApiClient.executeQuery(GET_ISSUE_DETAILS, { id: issueId });

        // Check the trackables field first (from the updated query)
        let affectedTrackables: any[] = [];

        if (issueDetailsResult.data?.node?.trackables?.nodes &&
          issueDetailsResult.data.node.trackables.nodes.length > 0) {

          // Use the direct trackables field (should contain only Components and Projects)
          affectedTrackables = issueDetailsResult.data.node.trackables.nodes
            .map((node: any) => ({
              id: node.id,
              name: node.name || (node.__typename === 'Component' ? 'Component' : 'Project'),
              type: node.__typename
            }));
        }
        // If no trackables, try the affects relationship
        else if (issueDetailsResult.data?.node?.affects?.nodes &&
          issueDetailsResult.data.node.affects.nodes.length > 0) {

          // Filter for Components and Projects from affects relationship
          const directTrackables = issueDetailsResult.data.node.affects.nodes
            .filter((node: any) => node.__typename === 'Component' || node.__typename === 'Project')
            .map((node: any) => ({
              id: node.id,
              name: node.name || node.__typename,
              type: node.__typename
            }));

          affectedTrackables.push(...directTrackables);

          // Also get Components from ComponentVersions in affects
          const componentVersions = issueDetailsResult.data.node.affects.nodes
            .filter((node: any) => node.__typename === 'ComponentVersion' && node.component);

          // Add unique components from component versions
          for (const cv of componentVersions) {
            // Check if this component is already in the list
            if (!affectedTrackables.some((t: any) => t.id === cv.component.id)) {
              affectedTrackables.push({
                id: cv.component.id,
                name: cv.component.name || 'Component',
                type: 'Component'
              });
            }
          }
        }

        if (affectedTrackables.length === 0) {
          vscode.window.showErrorMessage('This issue does not affect any trackable components or projects.');
          return;
        }

        // Automatically use the first component if there's only one, otherwise let user choose
        let selectedTrackable;
        if (affectedTrackables.length === 1) {
          selectedTrackable = affectedTrackables[0];
        } else {
          const trackableItems = affectedTrackables.map((t: any) => ({
            label: t.name,
            description: t.type,
            detail: t.id
          }));

          const selectedItem = await vscode.window.showQuickPick(trackableItems, {
            placeHolder: 'Select which component or project this artifact belongs to'
          }) as vscode.QuickPickItem | undefined;

          if (!selectedItem) {
            return; // User cancelled
          }

          selectedTrackable = {
            id: selectedItem.detail || '',
            name: selectedItem.label || '',
            type: selectedItem.description || ''
          };
        }

        // 2. Fetch available artifact templates
        const templatesResult = await globalApiClient.executeQuery(GET_ARTIFACT_TEMPLATES_QUERY);

        if (!templatesResult.data?.artefactTemplates?.nodes || templatesResult.data.artefactTemplates.nodes.length === 0) {
          vscode.window.showErrorMessage('No artifact templates available.');
          return;
        }

        // 3. Let user select a template by name
        const templateItems = templatesResult.data.artefactTemplates.nodes.map((template: any) => ({
          label: template.name,
          description: template.description || '',
          detail: template.id
        }));

        const selectedTemplateItem = await vscode.window.showQuickPick(templateItems, {
          placeHolder: 'Select an artifact template'
        }) as vscode.QuickPickItem | undefined;

        if (!selectedTemplateItem) {
          return; // User cancelled
        }

        const selectedTemplateId = selectedTemplateItem.detail || '';

        // 4. Get any template field values if needed
        const selectedTemplate = templatesResult.data.artefactTemplates.nodes.find(
          (t: any) => t.id === selectedTemplateId
        );

        const templatedFields: any[] = [];

        if (selectedTemplate && selectedTemplate.templateFieldSpecifications && selectedTemplate.templateFieldSpecifications.length > 0) {
          for (const field of selectedTemplate.templateFieldSpecifications) {
            const fieldValue = await vscode.window.showInputBox({
              prompt: `Enter value for ${field.name}`,
              placeHolder: field.value?.metadata?.description || `Value for ${field.name}`
            });

            if (fieldValue !== undefined) { // Allow empty strings, but not undefined (canceled)
              templatedFields.push({
                name: field.name,
                value: fieldValue
              });
            } else {
              return; // User cancelled
            }
          }
        }

        // 5. Create the artifact
        const createResult = await globalApiClient.executeQuery(CREATE_ARTIFACT_MUTATION, {
          input: {
            file: filePath,
            from,
            to,
            template: selectedTemplateId,
            templatedFields,
            trackable: selectedTrackable.id
          }
        });

        // Log the full result for debugging

        if (!createResult.data?.createArtefact?.artefact) {
          if (createResult.errors) {
            vscode.window.showErrorMessage(`Error creating artifact: ${createResult.errors[0].message}`);
          } else {
            vscode.window.showErrorMessage('Failed to create artifact.');
          }
          return;
        }

        const artifactId = createResult.data.createArtefact.artefact.id;

        // 6. Link the artifact to the issue
        const linkResult = await globalApiClient.executeQuery(ADD_ARTIFACT_TO_ISSUE_MUTATION, {
          input: {
            issue: issueId,
            artefact: artifactId
          }
        });


        if (linkResult.data?.addArtefactToIssue?.addedArtefactEvent) {
          vscode.window.showInformationMessage(`Artifact created and linked to issue successfully.`);

          if (createResult.data?.createArtefact?.artefact) {
            const newArtifact = createResult.data.createArtefact.artefact;

            // After successfully linking the artifact to the issue, register it for highlighting
            artifactDecoratorManager.registerArtifact(
              newArtifact.id,
              newArtifact.file,
              newArtifact.from,
              newArtifact.to,
              {
                issueId: issueId,
                issueType: issueDetailsResult.data?.node?.type?.name || 'Bug',
                isOpen: issueDetailsResult.data?.node?.state?.isOpen || false,
                title: issueDetailsResult.data?.node?.title || 'Unknown Issue'
              }
            );
          }

          // Refresh the issue details to show the new artifact
          if (issueDetailsProvider) {
            issueDetailsProvider.refreshCurrentIssue();
          }
        } else if (linkResult.errors) {
          console.error("[extension.createArtifact] Link error:", JSON.stringify(linkResult.errors, null, 2));
          vscode.window.showWarningMessage(`Artifact created but could not be linked to the issue: ${linkResult.errors[0].message}`);
        } else {
          console.error("[extension.createArtifact] Link result:", JSON.stringify(linkResult, null, 2));
          vscode.window.showWarningMessage('Artifact created but could not be linked to the issue.');
        }
      } catch (error) {
        console.error("[extension.createArtifact] Error:", error);
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createStandaloneArtifact', async () => {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found. Please open a file and select code.');
        return;
      }

      // Get selection range and check if any code is actually selected
      const selection = editor.selection;

      // Check if the selection is empty (cursor is just at one position)
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('No code selected. Please select the code you want to create an artifact for.');
        return;
      }

      const from = selection.start.line + 1; // 1-based line numbers
      const to = selection.end.line + 1;
      const filePath = editor.document.uri.toString();

      try {
        // Show progress indication
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Creating standalone artifact...",
          cancellable: false
        }, async (progress) => {

          progress.report({ message: "Authenticating..." });
          // Authenticate
          await globalApiClient.authenticate();

          progress.report({ message: "Finding component mappings for this file..." });
          // 1. Get available trackables for this specific file
          const trackables = await getAvailableTrackablesForFile(filePath);

          if (!trackables || trackables.length === 0) {
            vscode.window.showErrorMessage(
              'No component or project mappings found for this file. ' +
              'Please configure a mapping for this file or its parent folder first.'
            );
            return;
          }

          const trackableItems = trackables.map((t: any) => ({
            label: t.name,
            description: t.type,
            detail: t.id
          }));

          // 2. Let user choose a trackable
          let selectedTrackable;
          if (trackables.length === 1) {
            selectedTrackable = trackables[0];
            // Still inform the user which component/project is being used
            vscode.window.showInformationMessage(`Using mapped ${selectedTrackable.type}: ${selectedTrackable.name}`);
          } else {
            const selectedItem = await vscode.window.showQuickPick(trackableItems, {
              placeHolder: `Select which component or project this artifact belongs to (${trackables.length} mappings found)`
            }) as vscode.QuickPickItem | undefined;

            if (!selectedItem) {
              return; // User cancelled
            }

            selectedTrackable = {
              id: selectedItem.detail || '',
              name: selectedItem.label || '',
              type: selectedItem.description || ''
            };
          }

          progress.report({ message: "Loading artifact templates..." });
          // 3. Fetch available artifact templates
          const templatesResult = await globalApiClient.executeQuery(GET_ARTIFACT_TEMPLATES_QUERY);

          if (!templatesResult.data?.artefactTemplates?.nodes || templatesResult.data.artefactTemplates.nodes.length === 0) {
            vscode.window.showErrorMessage('No artifact templates available.');
            return;
          }

          // 4. Let user select a template
          const templateItems = templatesResult.data.artefactTemplates.nodes.map((template: any) => ({
            label: template.name,
            description: template.description || '',
            detail: template.id
          }));

          const selectedTemplateItem = await vscode.window.showQuickPick(templateItems, {
            placeHolder: 'Select an artifact template'
          }) as vscode.QuickPickItem | undefined;

          if (!selectedTemplateItem) {
            return; // User cancelled
          }

          const selectedTemplateId = selectedTemplateItem.detail || '';

          // 5. Get template field values if needed
          const selectedTemplate = templatesResult.data.artefactTemplates.nodes.find(
            (t: any) => t.id === selectedTemplateId
          );
          const templatedFields = [];

          if (selectedTemplate && selectedTemplate.templateFieldSpecifications && selectedTemplate.templateFieldSpecifications.length > 0) {
            for (const field of selectedTemplate.templateFieldSpecifications) {
              const fieldValue = await vscode.window.showInputBox({
                prompt: `Enter value for ${field.name}`,
                placeHolder: field.value?.metadata?.description || `Value for ${field.name}`
              });

              if (fieldValue !== undefined) { // Allow empty strings, but not undefined (canceled)
                templatedFields.push({
                  name: field.name,
                  value: fieldValue
                });
              } else {
                return; // User cancelled
              }
            }
          }

          progress.report({ message: "Creating artifact..." });
          // 6. Create the artifact (but don't link it to any issue)
          const createResult = await globalApiClient.executeQuery(CREATE_ARTIFACT_MUTATION, {
            input: {
              file: filePath,
              from,
              to,
              template: selectedTemplateId,
              templatedFields,
              trackable: selectedTrackable.id
            }
          });

          if (!createResult.data?.createArtefact?.artefact) {
            if (createResult.errors) {
              vscode.window.showErrorMessage(`Error creating artifact: ${createResult.errors[0].message}`);
            } else {
              vscode.window.showErrorMessage('Failed to create artifact.');
            }
            return;
          }

          const artifactId = createResult.data.createArtefact.artefact.id;
          vscode.window.showInformationMessage(`Standalone artifact created successfully for ${selectedTrackable.name}.`);
        });
      } catch (error) {
        console.error("[extension.createStandaloneArtifact] Error:", error);
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to open and highlight a file for an artifact
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openArtifactFile', async (message) => {
      try {
        console.log('[extension.openArtifactFile] Received message:', JSON.stringify(message, null, 2));

        // Handle both message object and direct artifact data scenarios
        let artifactData;
        if (message.artifactData) {
          artifactData = message.artifactData;
        } else if (typeof message === 'object' && message.file) {
          artifactData = message;
        } else {
          console.error('[extension.openArtifactFile] Invalid message format');
          vscode.window.showErrorMessage('Invalid artifact data received');
          return;
        }

        const {
          file = '',
          from = 1,
          to = undefined,
          id = ''
        } = artifactData;

        console.log(`[extension.openArtifactFile] Processing artifact: ${file}`);

        // Validate file path
        if (!file) {
          vscode.window.showErrorMessage('No file path provided for the artifact.');
          return;
        }

        // Convert the file URI string to a vscode.Uri object
        const fileUri = vscode.Uri.parse(file);

        // Check if file exists in workspace
        let fileExists = false;
        try {
          await vscode.workspace.fs.stat(fileUri);
          fileExists = true;
        } catch (error) {
          // File doesn't exist or isn't accessible
          fileExists = false;
        }

        if (!fileExists) {
          vscode.window.showWarningMessage(`File not found in workspace: ${fileUri.fsPath}`);
          return;
        }

        // Open the document in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document);

        // If we have valid line numbers, scroll to that position
        if (from !== undefined) {
          // Convert to 0-based line numbers for VSCode API
          const startLine = Math.max(0, from - 1);
          const endLine = to !== undefined ? Math.max(0, to - 1) : startLine;

          // Create a range for the relevant lines
          const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
          );

          // Reveal the range in the editor
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

          // Position the cursor at the start
          editor.selection = new vscode.Selection(range.start, range.start);
        }

        // If a source issue was provided, you might want to do something with it
        const sourceIssueId = message.sourceIssueId || message.issueId;
        if (sourceIssueId) {
          console.log(`[extension.openArtifactFile] Source issue ID: ${sourceIssueId}`);
          // You could potentially store or use this information
        }

      } catch (error) {
        console.error(`[extension.openArtifactFile] Comprehensive error:`, error);
        vscode.window.showErrorMessage(`Failed to open artifact file: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );


  // 4) Register the "Graphs" view
  const graphsProvider = new GraphsProvider(context, globalApiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("graphs", graphsProvider)
  );

  // Command to refresh component versions
  context.subscriptions.push(
    vscode.commands.registerCommand('gropius.refreshComponentVersions', () => {
      gropiusComponentVersionsProvider.refresh();
    })
  );

  // Command to show component issues for a given component ID
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showComponentIssues", async (data: any): Promise<void> => {
      const componentId = typeof data === 'string' ? data : data.componentId;
      await componentIssuesProvider.updateIssues(componentId);
      componentIssuesProvider.revealView();
    })
  );

  // Command to show issue details for a given issue ID
  vscode.commands.registerCommand('extension.showIssueDetails', (data: any) => {
    const issueId = typeof data === 'string' ? data : data.issueId;
    const originComponentId = typeof data === 'string' ? null : data.originComponentId;
    // Load and register artifacts for this issue, regardless of its state
    loadAndRegisterIssueArtifacts(issueId);
    issueDetailsProvider.updateIssueDetails(issueId, originComponentId);
    issueDetailsProvider.revealView();
  });


  // Optional: command to open the Graph Editor for a project ID
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showGraph", async (projectId: string): Promise<void> => {
      await graphsProvider.openGraphEditor(projectId);
    })
  );

  // *** NEW: Command to rebuild the Vue bundles ***
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.rebuildVue', () => {
      // Adjust the working directory (cwd) as needed.
      exec('npm run build:vue', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`Vue build failed: ${stderr}`);
          console.error("Vue build error:", error);
        } else {
          vscode.window.showInformationMessage("Vue build completed successfully.");
          // Optionally, refresh affected webviews here.
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshOutgoingRelations', () => {
      issueDetailsProvider.refreshCurrentIssue();
    })
  );
}

/**
 * GropiusComponentVersionsProvider: Displays a list of Gropius component versions.
 * - Associates local folders with Gropius components
 * - Shows component versions in a tree view
 * - Allows selection of versions to view associated issues
 */
export class GropiusComponentVersionsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gropiusComponentVersions';
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private isAuthenticated: boolean = false;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) {
    this._extensionUri = _context.extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getComponentVersions':
          await this._sendComponentVersionsData();
          break;
        case 'versionClicked':
          break;
        case 'showComponentVersionIssues':
          vscode.commands.executeCommand('extension.showComponentVersionIssues', message.data.componentVersionId);
          break;
        case 'showComponentIssues':
          // If the component has versions, use the first one's ID
          if (message.data.componentId) {
            vscode.commands.executeCommand('extension.showComponentIssues', message.data);
          }
          break;
        case 'showWorkspaceGraph':
          // Opens the workspace graph for the given workspace
          console.log("Start workspaceGraph");
          this.openWorkspaceGraphEditor();
      }
    });
  }

  /**
   * Opens the graph editor.
   * Loads the workspace graph.
   * 
   */
  public async openWorkspaceGraphEditor(): Promise<void> {
    console.log("Start openWorkspaceGraphEditor.");
    const panel = vscode.window.createWebviewPanel(
      "graphWorkspaceEditor",
      "Graph Editor",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._context.extensionUri, "out", "webview")
        ]
      }
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "out", "webview", "GraphWorkspaceEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);
    if (!panel.webview) {
      console.error("Webview is undefined!");
    }

    panel.webview.onDidReceiveMessage((message: any): void => {
      console.log("START: onDidReceiveMessage in ComponentVersionsProvider");
      if (message.type === "ready") {
        (async () => {
          try {
            await this.apiClient.authenticate();
            const workspaceData = await this.fetchWorkspaceGraphData();
            panel.webview.postMessage({
              type: "workspaceData",
              data: workspaceData
            });
          } catch (error) {
            vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
          }
        })();
      } else {
        console.log("We are in EEEEEEEEEEEEEEEEEELLLLLLLLLLLLLLLLLLSSSSSSSSSSSSSSSSSEEEEEEEEEEEEEEE");
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
  }
  /**
   * Todo: in... all found components or smth different
   * @returns 
   */
  private async fetchWorkspaceGraphData(): Promise<any> {
    console.log("Start fetchWorkspaceData");
    try {
      await this.apiClient.authenticate();
      const mappings = await loadConfigurations();
      const workspaceData = await this._buildTreeData(mappings);
      const components = this.getComponents(workspaceData);
      const response = await this.apiClient.executeQuery(FETCH_ALL_WORKSPACE_COMPONENTS_AND_ISSUES, { in: components });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch workspace graph: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
  private getComponents(data: any): string[] {
    console.log("Start getComponents.");
    let ids: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        ids = ids.concat(this.getComponents(item));
      }
    } else if (typeof data === "object" && data !== null) {
      for (const key in data) {
        if (key === "id") {
          ids.push(data[key]);
        } else {
          ids = ids.concat(this.getComponents(data[key]));
        }
      }
    }

    return ids;
  }
  getGraphEditorHtml(scriptUri: vscode.Uri): string {
    console.log("STEP: Generating Webview HTML");
    console.log("Script URI:", scriptUri.toString());
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Graph Editor</title>
        <style>
          html, body {
            height: 100vh;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          #app {
            height: 100vh;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="app"></div>
        <script src="${scriptUri}"></script>

      </body>
      </html>
    `;
  }

  // Refresh the component versions data
  public async refresh() {
    if (this._view) {
      await this._sendComponentVersionsData();
    }
  }

  private async _sendComponentVersionsData() {
    if (!this._view) {
      return;
    }

    try {
      if (!this.isAuthenticated) {
        await this.apiClient.authenticate();
        this.isAuthenticated = true;
      }

      const mappings = await loadConfigurations();

      // Transform mappings into tree data for the webview
      const treeData = await this._buildTreeData(mappings);

      // Send data to the webview
      this._view.webview.postMessage({
        command: 'componentVersionsData',
        data: treeData
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to load component versions: ${errorMessage}`);

      // Send empty data to avoid leaving the view in a loading state
      this._view.webview.postMessage({
        command: 'componentVersionsData',
        data: []
      });
    }
  }

  private async _fetchComponentVersions(
    componentId?: string,
    projectId?: string,
    componentVersionId?: string
  ): Promise<{ id?: string, componentVersionIds?: string[], name: string, description?: string, versions: string[] }> {
    try {
      // Authenticate if needed
      if (!this.isAuthenticated) {
        await this.apiClient.authenticate();
        this.isAuthenticated = true;
      }

      // If we have a direct component version ID, fetch that specific version
      if (componentVersionId) {

        const result = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSION_BY_ID_QUERY, { id: componentVersionId });

        if (result.data?.node) {
          const version = result.data.node;
          const versionString = version.version.startsWith('v') ? version.version : `v${version.version}`;
          return {
            id: version.component?.id,
            componentVersionIds: [version.id],
            name: version.component?.name || "Unknown Component",
            description: version.component?.description || "",
            versions: [versionString]
          };
        }
      }
      // For the component+project case
      else if (componentId && projectId) {

        const result = await this.apiClient.executeQuery(GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY, {
          projectId: projectId
        });

        if (result.data?.project) {
          const project = result.data.project;
          // Filter to get only versions of our target component
          const componentVersions = project.components.nodes
            .filter((node: any) => node.component.id === componentId);

          if (componentVersions.length > 0) {
            const componentId = componentVersions[0].component.id;
            const componentName = componentVersions[0].component.name;
            const componentDescription = componentVersions[0].component.description || "";

            const versionStrings = [];
            const versionIds = [];

            for (const v of componentVersions) {
              versionStrings.push(v.version.startsWith('v') ? v.version : `v${v.version}`);
              versionIds.push(v.id);  // Store the version ID
            }

            return {
              id: componentId,
              name: componentName,
              componentVersionIds: versionIds,
              description: componentDescription,
              versions: versionStrings,
            };
          }
        }
      }

      return { name: "Unknown", versions: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching component version:', errorMessage);
      vscode.window.showErrorMessage(`Error fetching component version: ${errorMessage}`);
      return { name: "Error", versions: [] };
    }
  }

  private async _buildTreeData(mappings: Map<string, any[]>) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const treeItems = [];

    // Handle multi-root workspace
    if (workspaceFolders.length > 1) {
      for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        const folderMappings = mappings.get(rootPath);

        if (folderMappings && folderMappings.length > 0) {
          // Check if the root folder itself is mapped
          const rootMapping = folderMappings.find(m => m.path === '/');

          if (rootMapping) {
            // Root folder is directly mapped to a component version
            if (rootMapping.componentVersion) {
              const component = await this._fetchComponentVersions(
                undefined, undefined, rootMapping.componentVersion
              );

              if (component.versions.length > 0) {
                treeItems.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }
          } else {
            // Root contains multiple component mappings
            const folderItem: ComponentTreeItem = {
              name: folder.name,
              expanded: false,
              children: []
            };

            // Process each mapping in this folder
            for (const mapping of folderMappings) {
              let component;

              if (mapping.componentVersion) {
                component = await this._fetchComponentVersions(
                  undefined, undefined, mapping.componentVersion
                );
              } else if (mapping.component && mapping.project) {
                component = await this._fetchComponentVersions(
                  mapping.component, mapping.project
                );
              }

              if (component && component.versions.length > 0) {
                folderItem.children!.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }

            if (folderItem.children!.length > 0) {
              treeItems.push(folderItem);
            }
          }
        }
      }
    } else {
      // Single root workspace - flat list of components
      for (const [rootPath, folderMappings] of mappings.entries()) {
        for (const mapping of folderMappings) {
          let component;

          if (mapping.componentVersion) {
            component = await this._fetchComponentVersions(
              undefined, undefined, mapping.componentVersion
            );
          } else if (mapping.component && mapping.project) {
            component = await this._fetchComponentVersions(
              mapping.component, mapping.project
            );
          }

          if (component && component.versions.length > 0) {
            treeItems.push({
              id: component.id,
              componentVersionIds: component.componentVersionIds,
              name: component.name,
              description: component.description,
              versions: component.versions,
              expanded: false
            });
          }
        }
      }
    }

    return treeItems;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'gropiusComponentVersions.js')
    );

    const iconPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', 'icons', 'gropius-component-version-icon.png')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gropius Component Versions</title>
        <script>
            // Make the icon path available to the Vue app
            window.customIconPath = "${iconPath}";
        </script>
    </head>
    <body>
        <div id="app"></div>
        <script src="${scriptPath}"></script>
    </body>
    </html>`;
  }
}

/**
 * Finds component versions mapped to a specific file path
 * 
 * @param filePath The file path to check mappings for (VSCode URI string)
 * @param mappings The loaded mappings from workspace
 * @returns Array of mapped trackables with component/project information
 */
async function getComponentVersionsForFile(
  filePath: string,
  mappings: Map<string, any[]>,
  apiClient: APIClient
): Promise<any[]> {
  // Initialize array to store found mappings
  const mappedTrackables: any[] = [];

  try {
    // Convert file URI to normal path
    const fileUri = vscode.Uri.parse(filePath);
    const normalizedFilePath = fileUri.fsPath;

    console.log(`[getComponentVersionsForFile] Checking mappings for file: ${normalizedFilePath}`);

    // Iterate through workspace folders and their mappings
    for (const [rootPath, folderMappings] of mappings.entries()) {
      // Check if file is in this workspace folder
      if (!normalizedFilePath.startsWith(rootPath)) {
        continue;
      }

      console.log(`[getComponentVersionsForFile] File is in workspace folder: ${rootPath}`);

      // Calculate relative path from workspace root
      let relativePath = normalizedFilePath.substring(rootPath.length);
      // Normalize path separators to forward slashes
      relativePath = relativePath.replace(/\\/g, '/');
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }

      console.log(`[getComponentVersionsForFile] Relative path: ${relativePath}`);

      // Check each mapping to see if it applies to this file
      for (const mapping of folderMappings) {
        // Get mapping path, ensuring it has a trailing slash for directory matching
        let mappingPath = mapping.path;
        if (mappingPath !== '/' && !mappingPath.endsWith('/')) {
          mappingPath += '/';
        }

        // Check if the file is in this mapped folder
        if (relativePath === mappingPath || relativePath.startsWith(mappingPath)) {
          console.log(`[getComponentVersionsForFile] Found matching mapping: ${mappingPath}`);

          // Direct component version mapping
          if (mapping.componentVersion) {
            console.log(`[getComponentVersionsForFile] Direct component version mapping: ${mapping.componentVersion}`);

            // Fetch component version details
            const cvResult = await apiClient.executeQuery(FETCH_COMPONENT_VERSION_BY_ID_QUERY, { id: mapping.componentVersion });

            if (cvResult.data?.node?.component) {
              const component = cvResult.data.node.component;
              mappedTrackables.push({
                id: component.id,
                name: component.name || 'Component',
                type: 'Component',
                matchType: 'direct_version',
                mappingPath: mappingPath
              });
            }
          }
          // Component+Project mapping
          else if (mapping.component && mapping.project) {
            console.log(`[getComponentVersionsForFile] Component+Project mapping: Component=${mapping.component}, Project=${mapping.project}`);

            // Add component trackable
            mappedTrackables.push({
              id: mapping.component,
              name: await getEntityName(mapping.component, 'Component', apiClient),
              type: 'Component',
              matchType: 'component_project',
              mappingPath: mappingPath
            });

            // Add project trackable
            mappedTrackables.push({
              id: mapping.project,
              name: await getEntityName(mapping.project, 'Project', apiClient),
              type: 'Project',
              matchType: 'component_project',
              mappingPath: mappingPath
            });
          }
        }
      }
    }

    // Log the results
    console.log(`[getComponentVersionsForFile] Found ${mappedTrackables.length} mapped trackables:`, mappedTrackables);

    // Filter out duplicate trackables (using a Map with ID as key)
    const uniqueTrackables = new Map();
    for (const trackable of mappedTrackables) {
      if (!uniqueTrackables.has(trackable.id)) {
        uniqueTrackables.set(trackable.id, trackable);
      }
    }

    return Array.from(uniqueTrackables.values());
  } catch (error) {
    console.error(`[getComponentVersionsForFile] Error finding mapped components: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Helper function to get entity name from ID
 */
async function getEntityName(id: string, type: string, apiClient: APIClient): Promise<string> {
  try {
    const query = `query GetEntityName($id: ID!) {
      node(id: $id) {
        ... on ${type} {
          name
        }
      }
    }`;

    const result = await apiClient.executeQuery(query, { id });
    return result.data?.node?.name || type;
  } catch (error) {
    console.error(`Error getting name for ${type} ${id}: ${error}`);
    return type;
  }
}

// Helper function that gets available trackables specifically for a file
async function getAvailableTrackablesForFile(filePath: string) {
  try {
    await globalApiClient.authenticate();

    // Load mappings
    const mappings = await loadConfigurations();

    // Get component versions mapped to this specific file
    const mappedTrackables = await getComponentVersionsForFile(filePath, mappings, globalApiClient);

    if (mappedTrackables.length > 0) {
      console.log(`[getAvailableTrackablesForFile] Found ${mappedTrackables.length} mapped trackables for file: ${filePath}`);
      return mappedTrackables;
    }

    // If no mappings found, return empty array (we won't use a fallback)
    console.log(`[getAvailableTrackablesForFile] No mappings found for file: ${filePath}`);
    return [];
  } catch (error) {
    console.error("[getAvailableTrackablesForFile] Error:", error);
    vscode.window.showErrorMessage(`Failed to find mapped components for this file: ${error instanceof Error ? error.message : String(error)}`);
    return []; // Return empty array on error
  }
}

// Helper function to get available trackables (components and projects)
async function getAvailableTrackables() {
  try {
    await globalApiClient.authenticate();

    // First try to get components from workspace mappings
    const mappings = await loadConfigurations();
    const componentIds = new Set<string>();
    const availableTrackables = [];

    // Process mappings to extract component IDs
    for (const [rootPath, folderMappings] of mappings.entries()) {
      for (const mapping of folderMappings) {
        if (mapping.component && !componentIds.has(mapping.component)) {
          componentIds.add(mapping.component);
        }
      }
    }

    // Fetch component details for the extracted IDs
    if (componentIds.size > 0) {
      // Convert the set to an array
      const componentIdList = Array.from(componentIds);

      // Query for component details using our new query
      const result = await globalApiClient.executeQuery(
        GET_COMPONENTS_BY_IDS,
        { ids: componentIdList }
      );

      if (result.data?.components?.nodes) {
        // Add each component to the available trackables
        for (const component of result.data.components.nodes) {
          availableTrackables.push({
            id: component.id,
            name: component.name || 'Component',
            type: 'Component'
          });
        }
      }
    }

    // If no components from workspace, fetch all available components
    if (availableTrackables.length === 0) {
      const result = await globalApiClient.executeQuery(GET_AVAILABLE_COMPONENTS);

      if (result.data?.components?.nodes) {
        for (const component of result.data.components.nodes) {
          availableTrackables.push({
            id: component.id,
            name: component.name || 'Component',
            type: 'Component'
          });
        }
      }
    }

    // Also fetch available projects
    const projectsResult = await globalApiClient.executeQuery(GET_AVAILABLE_PROJECTS);

    if (projectsResult.data?.projects?.nodes) {
      for (const project of projectsResult.data.projects.nodes) {
        availableTrackables.push({
          id: project.id,
          name: project.name || 'Project',
          type: 'Project'
        });
      }
    }

    return availableTrackables;
  } catch (error) {
    console.error("[getAvailableTrackables] Error:", error);
    vscode.window.showErrorMessage(`Failed to get available components and projects: ${error instanceof Error ? error.message : String(error)}`);
    return []; // Return empty array on error
  }
}

/**
 * ComponentIssuesProvider:
 * - Receives a component ID
 * - Fetches all components with FETCH_COMPONENT_VERSIONS_QUERY
 * - Finds the matching component
 * - Sends its issues via "updateComponentIssues"
 */
export class ComponentIssuesProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "componentIssues";

  // Store the last fetched issues and the last selected version ID
  private lastIssues: any[] | null = null;
  private lastVersionId: string | null = null;
  private _viewVisibilityChangedDisposable?: vscode.Disposable;
  private originComponentId: string | null = null; // store origin component ID

  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Provide HTML for the webview
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Register visibility changed listener
    this._viewVisibilityChangedDisposable?.dispose();
    this._viewVisibilityChangedDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshCurrentIssues();
      }
    });

    // When the view is resolved, force a refresh regardless of previous state
    this.refreshCurrentIssues();

    // Listen for messages from the Vue app
    webviewView.webview.onDidReceiveMessage(async (message: any): Promise<void> => {
      if (message.command === "vueAppReady") {
        this.refreshCurrentIssues();
      } else if (message.command === "issueClicked") {
        let originId = this.originComponentId;
        if (!originId && this.lastIssues && this.lastIssues.length > 0) {
          originId = this.findComponentIdFromIssues(this.lastIssues);
        }

        vscode.commands.executeCommand('extension.showIssueDetails', {
          issueId: message.issueId,
          originComponentId: originId
        });
      } else if (message.command === "refreshRequested") {
        this.refreshCurrentIssues();
      } else if (message.command === "fetchIssueTemplates") {
        this.fetchIssueTemplates()
          .then(templates => {
            webviewView.webview.postMessage({
              command: 'issueTemplatesLoaded',
              templates: templates
            });
          })
          .catch(error => {
            console.error("Error fetching issue templates:", error);
            webviewView.webview.postMessage({
              command: 'issueTemplatesLoaded',
              templates: [],
              error: error.message
            });
          });
      } else if (message.command === "createIssue") {
        this.createIssue(message.input)
          .then(newIssue => {
            webviewView.webview.postMessage({
              command: 'issueCreated',
              issue: newIssue
            });
            // Refresh the issues list
            this.refreshCurrentIssues();
          })
          .catch(error => {
            console.error("Error creating issue:", error);
            webviewView.webview.postMessage({
              command: 'issueCreationError',
              error: error instanceof Error ? error.message : String(error)
            });
          });
      } else if (message.command === "showMessage") {
        vscode.window.showInformationMessage(message.message);
      }
      return;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "componentIssues.js"
      )
    );
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>Component Issues</title>
      </head>
      <body style="padding:0;margin:0;">
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  /**
   * Called by "extension.showComponentIssues" with a componentId.
   */
  public async updateIssues(componentId: string): Promise<void> {
    try {
      this.lastVersionId = null;
      this.originComponentId = componentId; // Save origin component ID

      await this.apiClient.authenticate();
      const result = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      if (!result.data || !result.data.node) {
        throw new Error("No component data received.");
      }

      const issues = result.data.node.issues.nodes || [];
      this.lastIssues = issues;

      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: issues,
          metadata: {
            versionOnlyIssues: [],
            selectedVersionId: null,
            componentId: componentId,
          }
        });
      }

      // Reveal the view after updating issues
      this.revealView();
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component issues: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async fetchIssueTemplates() {
    try {
      await this.apiClient.authenticate();

      const result = await this.apiClient.executeQuery(
        GET_ISSUE_TEMPLATES
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.issueTemplates?.nodes || [];
    } catch (error) {
      console.error("Error fetching issue templates:", error);
      throw error;
    }
  }

  private async createIssue(input: any) {
    try {
      await this.apiClient.authenticate();

      // Execute the CreateIssue mutation with the provided input
      const result = await this.apiClient.executeQuery(
        CREATE_ISSUE_MUTATION,
        { input }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.createIssue?.issue) {
        throw new Error('Failed to create issue: No issue data returned');
      }

      const newIssue = result.data.createIssue.issue;

      // Send the created issue back to the webview
      if (this._view) {
        this._view.webview.postMessage({
          command: 'issueCreated',
          issue: newIssue
        });
      }

      // Show success message
      vscode.window.showInformationMessage(`Issue "${newIssue.title}" created successfully.`);

      // Refresh the issues list
      this.refreshCurrentIssues();

      return newIssue;
    } catch (error) {
      console.error("Error creating issue:", error);
      vscode.window.showErrorMessage(`Failed to create issue: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
 * Handles issue updates from other parts of the extension
 * Updates the issue in the current issues list without requiring a full refresh
 */
  public handleIssueUpdate(data: { issueId: string, field: string, newValue: any }): void {
    if (!this.lastIssues || !this._view) {
      return; // No issues to update or view not visible
    }

    const { issueId, field, newValue } = data;

    // Find the issue in our current list
    const issueIndex = this.lastIssues.findIndex(issue => issue.id === issueId);
    if (issueIndex === -1) {
      return; // Issue not found in our current list
    }

    // Create a copy of the issue to modify
    const updatedIssue = { ...this.lastIssues[issueIndex] };

    // Update the specific field
    switch (field) {
      case 'state':
        updatedIssue.state = newValue;
        break;
      case 'type':
        updatedIssue.type = newValue;
        break;
      case 'priority':
        updatedIssue.priority = newValue;
        break;
      case 'title':
        updatedIssue.title = newValue;
        break;
    }

    // Update the issue in our local cache
    this.lastIssues[issueIndex] = updatedIssue;

    // Notify the webview about the update
    if (this._view) {
      this._view.webview.postMessage({
        command: 'issueUpdated',
        issueId,
        field,
        newValue,
        updatedIssue
      });
    }
  }

  /**
 * Refreshes the current set of issues by refetching them from the API.
 */
  public async refreshCurrentIssues(): Promise<void> {

    try {
      // Clear any cached issues first to ensure fresh data
      if (this._view) {
        // Start with a loading indicator
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: this.lastIssues || [],
          isLoading: true
        });
      }

      // If we have a component version selected, refresh its issues
      if (this.lastVersionId) {
        // Force a complete refresh by clearing the cache
        this.lastIssues = null;
        await this.updateVersionIssues(this.lastVersionId);
        return;
      }

      // If no version ID but we have component issues with component ID, use that
      if (this.lastIssues && this.lastIssues.length > 0) {
        // Try to find component ID from the first issue
        const componentId = this.findComponentIdFromIssues(this.lastIssues);
        if (componentId) {
          // Force a complete refresh by clearing the cache
          this.lastIssues = null;
          await this.updateIssues(componentId);
          return;
        }
      }

    } catch (error) {
      console.error("[ComponentIssuesProvider] Error refreshing issues:", error);
      vscode.window.showErrorMessage(`Failed to refresh issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to extract component ID from issues
  private findComponentIdFromIssues(issues: any[]): string | null {
    // Attempt different ways to find the component ID
    for (const issue of issues) {
      // Check if component ID is directly available
      if (issue.component?.id) {
        return issue.component.id;
      }

      // Check if component ID is available in affects relationship
      if (issue.affects?.nodes) {
        for (const node of issue.affects.nodes) {
          if (node.__typename === 'Component' && node.id) {
            return node.id;
          }
        }
      }
    }

    return null;
  }


  /**
   * Called by "extension.showComponentVersionIssues" with a version ID.
   * This method fetches the issues for the selected version, stores them,
   * and (if the view is open) posts them.
   */
  public async updateVersionIssues(componentVersionId: string): Promise<void> {
    try {
      this.lastVersionId = componentVersionId;

      await this.apiClient.authenticate();

      // Get the component ID from the component version
      const componentVersionResult = await this.apiClient.executeQuery(
        FETCH_COMPONENT_VERSION_BY_ID_QUERY,
        { id: componentVersionId }
      );
      const componentId = componentVersionResult.data?.node?.component?.id;

      if (!componentId) {
        throw new Error("Could not find component ID for this version");
      }

      // Set the originComponentId when a version is clicked
      this.originComponentId = componentId;

      // Get ALL component issues (same as clicking the component)
      const componentResult = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      // Get all issues specific to the component
      const componentIssues = componentResult.data?.node?.issues?.nodes || [];

      // Mark which issues are affected by the selected version
      const versionResult = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_VERSION_QUERY,
        { id: componentVersionId }
      );
      const affectedIssueIds = new Set();
      const versionIssueGroups = versionResult.data?.node?.aggregatedIssues?.nodes || [];
      for (const group of versionIssueGroups) {
        const issues = group.issues.nodes || [];
        for (const issue of issues) {
          affectedIssueIds.add(issue.id);
        }
      }

      const allIssues = componentIssues.map((issue: { id: unknown; }) => ({
        ...issue,
        affectsSelectedVersion: affectedIssueIds.has(issue.id)
      }));

      this.lastIssues = allIssues;

      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: allIssues,
          metadata: {
            componentId: componentId,
            selectedVersionId: componentVersionId,
            affectedIssueIds: Array.from(affectedIssueIds)
          }
        });
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch component version issues: ${error instanceof Error ? error.message : String(error)}`
      );
      this.lastIssues = [];
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateComponentIssues",
          data: []
        });
      }
    }
  }

  public async updateComponentIssues(componentId: string): Promise<void> {
    try {
      // Clear the last version ID
      this.lastVersionId = null;

      await this.apiClient.authenticate();

      const result = await this.apiClient.executeQuery(
        GET_ISSUES_OF_COMPONENT_QUERY,
        { id: componentId }
      );

      if (result.data?.node) {
        const componentIssues = result.data.node.issues.nodes || [];

        // Update the issue list
        this.lastIssues = componentIssues;

        // If the view is open, post the new issues
        if (this._view) {
          this._view.webview.postMessage({
            command: "updateComponentIssues",
            data: componentIssues,
            metadata: {
              componentId: componentId,  // Include componentId in metadata
              versionOnlyIssues: [] // No version-only issues when viewing component issues
            }
          });
        }
      }
    } catch (error: any) {
      // Handle errors
    }
  }

  /**
   * Force the "Component Issues" view to open and refresh its data.
   * This method is called whenever a new version is clicked.
   */
  public revealView() {
    if (this._view) {
      this._view.show(false); // Force the view to show
      if (this.lastVersionId) {
        // Force a re-fetch for the last selected version
        this.updateVersionIssues(this.lastVersionId);
      }
    } else {
      // If the view is not yet resolved, try to open the Explorer
      vscode.commands.executeCommand('workbench.view.explorer');
    }
  }
}

/**
 * IssueDetailsProvider:
 * - Displays detailed information about a selected issue
 * - Handles issue selection and view persistence
 * - Saves changes back to the backend via GraphQL mutation
 */
class IssueDetailsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'issueDetails';
  private _view?: vscode.WebviewView;
  private lastIssueId: string | null = null;
  private originComponentId: string | null = null; // store origin component ID
  private tempFileUri: vscode.Uri | null = null;
  private descriptionEditData: { bodyId: string, issueId: string } | null = null;
  private isAuthenticated: boolean = false;

  public refreshCurrentIssue(): void {
    if (this._view && this.lastIssueId) {
      this.updateIssueDetails(this.lastIssueId);
    }
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient,
    private readonly _extensionUri: vscode.Uri
  ) {

  }
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // When the view is (re)opened, if a last issue was selected, re-fetch its details.
    if (this.lastIssueId && this.originComponentId) {
      this.updateIssueDetails(this.lastIssueId, this.originComponentId);
    } else {
      // Optionally, post an empty message so the view shows nothing.
      this._view?.webview.postMessage({ command: 'displayIssue', issue: null });
    }

    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      if (message.command === "vueAppReady") {
        if (this.lastIssueId && this.originComponentId) {
          this.updateIssueDetails(this.lastIssueId);
        } else {
          this._view?.webview.postMessage({ command: 'displayIssue', issue: null });
        }
      } else if (message.command === "openRelatedIssue") {
        vscode.commands.executeCommand('extension.showIssueDetails', message.issueId);
      } else if (message.command === "createArtifact") {
        vscode.commands.executeCommand('extension.createArtifact', message.issueId);
      } else if (message.command === "openArtifactFile") {
        vscode.commands.executeCommand('extension.openArtifactFile', message.artifactData);
      } else if (message.command === 'openInExternalBrowser' && message.url) {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.command === 'searchUsers') {
        try {
          const users = await this.searchUsers(message.query);
          this._view?.webview.postMessage({
            command: 'userSearchResults',
            users
          });
        } catch (error) {
          console.error('[IssueDetailsProvider] Error searching users:', error);
        }
      } else if (message.command === 'openArtifactFile') {
        // Forward the complete message to the command with sourceIssueId
        vscode.commands.executeCommand('extension.openArtifactFile', {
          artifactData: message.artifactData,
          sourceIssueId: message.sourceIssueId
        });
      } else if (message.command === 'createAssignment') {
        try {
          const assignment = await this.createAssignment(message.issueId, message.userId);
          this._view?.webview.postMessage({
            command: 'assignmentCreated',
            assignment
          });

          // Refresh issue details to show the new assignment
          this.refreshCurrentIssue();
        } catch (error) {
          console.error('[IssueDetailsProvider] Error creating assignment:', error);
          this._view?.webview.postMessage({
            command: 'assignmentError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'editDescription') {
        // New handler for edit description command
        this.openDescriptionEditor(message.data);
      } else if (message.command === 'updateDescription') {
        // New handler for saving description changes
        this.saveDescriptionChanges(message.data);
      } else if (message.command === 'getIssueOptions') {
        // Fetch available options for issue editing
        const templateId = message.templateId;
        console.log(`[IssueDetailsProvider] Received getIssueOptions request for template: ${templateId}`);
        if (templateId) {
          try {
            const options = await this.fetchIssueOptions(templateId);
            console.log(`[IssueDetailsProvider] Sending options to webview:`, {
              states: options.states.length,
              types: options.types.length,
              priorities: options.priorities.length
            });

            this._view?.webview.postMessage({
              command: 'issueOptionsLoaded',
              options
            });
          } catch (error) {
            console.error('[IssueDetailsProvider] Error getting issue options:', error);
            this._view?.webview.postMessage({
              command: 'issueOptionsError',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          console.error('[IssueDetailsProvider] Missing templateId in getIssueOptions request');
          this._view?.webview.postMessage({
            command: 'issueOptionsError',
            error: 'Missing template ID'
          });
        }
      } else if (message.command === 'changeIssueState') {
        // Change issue state
        try {
          const updatedState = await this.changeIssueState({
            issueId: message.issueId,
            stateId: message.stateId
          });
          this._view?.webview.postMessage({
            command: 'issueStateUpdated',
            state: updatedState
          });
          // Refresh issue details to reflect all changes
          this.refreshCurrentIssue();

          vscode.commands.executeCommand('extension.issueUpdated', {
            issueId: message.issueId,
            field: 'state',
            newValue: updatedState
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update issue state: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'changeIssueType') {
        // Change issue type
        try {
          const updatedType = await this.changeIssueType({
            issueId: message.issueId,
            typeId: message.typeId
          });
          this._view?.webview.postMessage({
            command: 'issueTypeUpdated',
            type: updatedType
          });
          // Refresh issue details to reflect all changes
          this.refreshCurrentIssue();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update issue type: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'changeIssuePriority') {
        // Change issue priority
        try {
          const updatedPriority = await this.changeIssuePriority({
            issueId: message.issueId,
            priorityId: message.priorityId
          });
          this._view?.webview.postMessage({
            command: 'issuePriorityUpdated',
            priority: updatedPriority
          });
          // Refresh issue details to reflect all changes
          this.refreshCurrentIssue();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update issue priority: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'changeIssueTitle') {
        // Change issue title
        try {
          const updatedTitle = await this.changeIssueTitle({
            issueId: message.issueId,
            title: message.title
          });
          this._view?.webview.postMessage({
            command: 'issueTitleUpdated',
            title: updatedTitle
          });
          // Refresh issue details to reflect all changes
          this.refreshCurrentIssue();

          // Notify other views about the issue update
          vscode.commands.executeCommand('extension.issueUpdated', {
            issueId: message.issueId,
            field: 'title',
            newValue: updatedTitle
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update issue title: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'refreshCurrentIssue') {
        if (this.lastIssueId) {
          this.updateIssueDetails(this.lastIssueId);
        }
      } else if (message.command === 'getAssignmentTypes') {
        // Fetch available assignment types for a template
        const templateId = message.templateId;
        console.log(`[IssueDetailsProvider] Received getAssignmentTypes request for template: ${templateId}`);
        if (templateId) {
          try {
            const types = await this.fetchAssignmentTypesForTemplate(templateId);
            this._view?.webview.postMessage({
              command: 'assignmentTypesLoaded',
              types
            });
          } catch (error) {
            console.error('[IssueDetailsProvider] Error getting assignment types:', error);
            this._view?.webview.postMessage({
              command: 'assignmentTypesError',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          console.error('[IssueDetailsProvider] Missing templateId in getAssignmentTypes request');
          this._view?.webview.postMessage({
            command: 'assignmentTypesError',
            error: 'Missing template ID'
          });
        }
      } else if (message.command === 'changeAssignmentType') {
        try {
          const result = await this.changeAssignmentType({
            assignmentId: message.assignmentId,
            typeId: message.typeId
          });

          this._view?.webview.postMessage({
            command: 'assignmentTypeUpdated',
            assignment: result
          });

          // Refresh issue details to update the UI
          this.refreshCurrentIssue();
        } catch (error) {
          console.error('[IssueDetailsProvider] Error changing assignment type:', error);
          this._view?.webview.postMessage({
            command: 'assignmentTypeError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'removeAssignment') {
        try {
          await this.removeAssignment(message.assignmentId);
          this._view?.webview.postMessage({
            command: 'assignmentRemoved',
            assignmentId: message.assignmentId
          });

          // Refresh issue details to update the UI
          this.refreshCurrentIssue();
        } catch (error) {
          console.error('[IssueDetailsProvider] Error removing assignment:', error);
          this._view?.webview.postMessage({
            command: 'assignmentError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'removeIssueRelation') {
        console.log(`[IssueDetailsProvider] Received removeIssueRelation request for relation: ${message.relationId}`);
        try {
          await this.removeIssueRelation(message.relationId);
          vscode.window.showInformationMessage("Relation removed successfully.");
          // Refresh the issue details to update the outgoing relations UI
          this.refreshCurrentIssue();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to remove relation: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === "showIssueGraph") {
        console.log("Start issueGraph");
        this.openIssueGraphEditor();
      } else if (message.command === 'getRelationTypes') {
        try {
          const relationTypes = await this.fetchIssueRelationTypes();
          this._view?.webview.postMessage({
            command: 'relationTypesLoaded',
            relationId: message.relationId,
            types: relationTypes
          });
        } catch (error) {
          this._view?.webview.postMessage({
            command: 'relationTypesError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'changeRelationType') {
        try {
          const newType = await this.changeIssueRelationType({
            relationId: message.relationId,
            typeId: message.typeId,
          });
          this._view?.webview.postMessage({
            command: 'relationTypeChanged',
            relationId: message.relationId,
            newType
          });
          // Optionally refresh issue details
          this.refreshCurrentIssue();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to change relation type: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'createOutgoingRelation') {
        const componentId = this.originComponentId;
        if (!componentId) {
          vscode.window.showErrorMessage('Origin component ID is missing.');
          return;
        }
        try {
          await this.apiClient.authenticate();
          const result = await this.apiClient.executeQuery(GET_COMPONENT_ISSUES_BY_ID_QUERY, {
            componentId,
            first: 20,
            query: "*",
            skip: 0
          });
          // Correctly extract issues from the query response.
          // Assuming the response returns an array of components.
          const components = result.data?.searchComponents || [];
          let issues = [];
          if (components.length > 0) {
            issues = components[0].issues?.nodes || [];
          }
          this._view?.webview.postMessage({ command: 'newOutgoingRelationList', issues });
        } catch (error) {
          vscode.window.showErrorMessage(`Error fetching issues: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'getNewRelationTypes') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(GET_ISSUE_RELATION_TYPES, {
            filter: {},
            first: 10,
            query: "*",
            skip: 0
          });
          const types = result.data && result.data.searchIssueRelationTypes ? result.data.searchIssueRelationTypes : [];
          this._view?.webview.postMessage({ command: 'newRelationTypesLoaded', types });
        } catch (error) {
          this._view?.webview.postMessage({
            command: 'newRelationTypesError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'createIssueRelation') {
        try {
          await globalApiClient.authenticate();
          // Execute the mutation passing in the three IDs: 
          //   - issue: the currently viewed issue ID,
          //   - issueRelationType: the selected relation type ID,
          //   - relatedIssue: the candidate issue ID chosen from the dropdown
          const result = await globalApiClient.executeQuery(CREATE_ISSUE_RELATION_MUTATION, {
            input: {
              issue: message.input.issue,
              issueRelationType: message.input.issueRelationType,
              relatedIssue: message.input.relatedIssue,
            },
          });
          if (!result.data?.createIssueRelation?.issueRelation) {
            this._view?.webview.postMessage({
              command: 'issueRelationCreationError',
              error: "No data returned from mutation",
            });
          } else {
            // You can either pass back the created relation,
            // or simply post a refresh command.
            this._view?.webview.postMessage({
              command: 'issueRelationCreated',
              issueRelation: result.data.createIssueRelation.issueRelation,
            });
            // Optionally, trigger a refresh:
            vscode.commands.executeCommand('extension.refreshOutgoingRelations');
          }
        } catch (error) {
          this._view?.webview.postMessage({
            command: 'issueRelationCreationError',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === 'getAllLabels') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(GET_ALL_LABELS_QUERY, {
            originComponentId: message.originComponentId, // Added parameter
            first: message.first || 20,
            query: message.query || "*",
            skip: message.skip || 0
          });
          const labels = result.data?.searchLabels || [];
          this._view?.webview.postMessage({ command: 'allLabelsLoaded', labels });
        } catch (error) {
          this._view?.webview.postMessage({
            command: 'allLabelsError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'addLabelToIssue') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(ADD_LABEL_TO_ISSUE_MUTATION, {
            input: message.input, // { issue: string, label: string }
          });

          // Check whether the mutation returned a valid label
          if (!result.data?.addLabelToIssue?.addedLabelEvent?.addedLabel) {
            throw new Error(
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : "No label was added."
            );
          }

          // Send the added label back to the webview
          this._view?.webview.postMessage({
            command: 'labelAddedToIssue',
            label: result.data.addLabelToIssue.addedLabelEvent.addedLabel,
          });

          // Optionally trigger a refresh of the issue view
          vscode.commands.executeCommand('extension.refreshCurrentIssue');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // Display the error notification in VS Code
          vscode.window.showErrorMessage(`Failed to add label: ${errorMsg}`);
          // Send the error back to the webview if further handling is needed
          this._view?.webview.postMessage({
            command: 'addLabelToIssueError',
            error: errorMsg,
          });
        }
      } else if (message.command === 'removeLabelFromIssue') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(REMOVE_LABEL_FROM_ISSUE_MUTATION, {
            input: message.input, // { issue: string, label: string }
          });
          if (!result.data?.removeLabelFromIssue?.removedLabelEvent?.removedLabel) {
            throw new Error(
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : "Label removal failed."
            );
          }
          this._view?.webview.postMessage({
            command: 'labelRemovedFromIssue',
            removedLabel: result.data.removeLabelFromIssue.removedLabelEvent.removedLabel,
          });
          // Optionally, trigger a refresh of the issue details view:
          vscode.commands.executeCommand('extension.refreshCurrentIssue');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to remove label: ${errorMsg}`);
          this._view?.webview.postMessage({
            command: 'removeLabelFromIssueError',
            error: errorMsg,
          });
        }
      } else if (message.command === 'createNewLabel') {
        try {
          await globalApiClient.authenticate();
          const labelInput = {
            name: message.data.name,
            description: message.data.description,
            color: message.data.color,
            // Use originComponentId for trackables instead of the issue id.
            trackables: [this.originComponentId]
          };
          console.log('Creating label with input:', labelInput);

          const result = await globalApiClient.executeQuery(CREATE_LABEL_MUTATION, {
            input: labelInput
          });
          if (result.errors) {
            throw new Error(result.errors[0].message);
          }
          this._view?.webview.postMessage({
            command: 'newLabelCreated',
            label: result.data.createLabel.label
          });
          vscode.window.showInformationMessage('Label created successfully.');
          // Pass originComponentId into the GET_ALL_LABELS_QUERY call.
          const labelsResult = await globalApiClient.executeQuery(GET_ALL_LABELS_QUERY, {
            originComponentId: this.originComponentId,
            first: 20,
            query: "*",
            skip: 0
          });
          this._view?.webview.postMessage({
            command: 'allLabelsLoaded',
            labels: labelsResult.data?.searchLabels || []
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create label: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === 'getAvailableArtifacts') {
        try {
          const trackableIds = message.trackableIds;
          const issueId = message.issueId;

          if (!trackableIds || !trackableIds.length || !issueId) {
            this._view?.webview.postMessage({
              command: 'availableArtifactsLoaded',
              artifacts: [],
              error: 'Missing trackable IDs or issue ID'
            });
            return;
          }

          console.log(`[IssueDetailsProvider] Fetching available artifacts for trackables:`, trackableIds);

          this.fetchAvailableArtifacts(trackableIds, issueId)
            .then(artifacts => {
              this._view?.webview.postMessage({
                command: 'availableArtifactsLoaded',
                artifacts: artifacts
              });
            })
            .catch(error => {
              console.error('[IssueDetailsProvider] Error fetching artifacts:', error);
              this._view?.webview.postMessage({
                command: 'availableArtifactsLoaded',
                artifacts: [],
                error: error instanceof Error ? error.message : String(error)
              });
            });
        } catch (error) {
          console.error('[IssueDetailsProvider] Error processing getAvailableArtifacts:', error);
          this._view?.webview.postMessage({
            command: 'availableArtifactsLoaded',
            artifacts: [],
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      else if (message.command === 'addArtifactToIssue') {
        try {
          const input = message.input;

          if (!input || !input.issue || !input.artefact) {
            this._view?.webview.postMessage({
              command: 'addArtifactError',
              error: 'Missing issue ID or artifact ID'
            });
            return;
          }

          console.log(`[IssueDetailsProvider] Adding artifact ${input.artefact} to issue ${input.issue}`);

          this.addArtifactToIssue(input)
            .then(result => {
              this._view?.webview.postMessage({
                command: 'artifactAddedToIssue',
                artifactId: input.artefact,
                result: result
              });

              // Refresh the issue details to show the new artifact
              this.refreshCurrentIssue();
            })
            .catch(error => {
              console.error('[IssueDetailsProvider] Error adding artifact to issue:', error);
              this._view?.webview.postMessage({
                command: 'addArtifactError',
                error: error instanceof Error ? error.message : String(error)
              });
            });
        } catch (error) {
          console.error('[IssueDetailsProvider] Error processing addArtifactToIssue:', error);
          this._view?.webview.postMessage({
            command: 'addArtifactError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'removeArtifactFromIssue') {
        try {
          const input = message.input;

          if (!input || !input.issue || !input.artefact) {
            this._view?.webview.postMessage({
              command: 'removeArtifactError',
              error: 'Missing issue ID or artifact ID'
            });
            return;
          }

          console.log(`[IssueDetailsProvider] Removing artifact ${input.artefact} from issue ${input.issue}`);

          this.removeArtifactFromIssue(input)
            .then(result => {
              this._view?.webview.postMessage({
                command: 'artifactRemovedFromIssue',
                artifactId: input.artefact,
                result: result
              });

              // Refresh the issue details to update the artifact list
              this.refreshCurrentIssue();
            })
            .catch(error => {
              console.error('[IssueDetailsProvider] Error removing artifact from issue:', error);
              this._view?.webview.postMessage({
                command: 'removeArtifactError',
                error: error instanceof Error ? error.message : String(error)
              });
            });
        } catch (error) {
          console.error('[IssueDetailsProvider] Error processing removeArtifactFromIssue:', error);
          this._view?.webview.postMessage({
            command: 'removeArtifactError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
  }


  /**
   * Fetches available artifacts for the given trackables that are not already linked to the issue
   */
  private async fetchAvailableArtifacts(trackableIds: string[], issueId: string): Promise<any[]> {
    try {
      await this.apiClient.authenticate();

      // First, get the current issue's artifacts to filter them out
      const issueArtifactsResult = await this.apiClient.executeQuery(
        GET_ARTIFACTS_FOR_ISSUE,
        { issueId }
      );

      const existingArtifactIds = new Set();
      if (issueArtifactsResult.data?.node?.artefacts?.nodes) {
        for (const artifact of issueArtifactsResult.data.node.artefacts.nodes) {
          existingArtifactIds.add(artifact.id);
        }
      }

      console.log(`[IssueDetailsProvider] Issue has ${existingArtifactIds.size} artifacts already`);

      // Fetch artifacts for each trackable
      const allArtifacts = [];

      for (const trackableId of trackableIds) {
        try {
          const trackableResult = await this.apiClient.executeQuery(
            GET_ARTIFACTS_FOR_TRACKABLE,
            { trackableId }
          );

          if (trackableResult.errors) {
            console.warn(`[IssueDetailsProvider] Error fetching artifacts for trackable ${trackableId}:`,
              trackableResult.errors[0].message);
            continue;
          }

          // Get artifacts from the result
          const trackableArtifacts = trackableResult.data?.node?.artefacts?.nodes || [];

          // Filter out artifacts that are already linked to the issue
          const availableArtifacts = trackableArtifacts.filter(
            (artifact: any) => !existingArtifactIds.has(artifact.id)
          );

          console.log(`[IssueDetailsProvider] Found ${availableArtifacts.length} available artifacts for trackable ${trackableId}`);

          // Add these artifacts to our collection
          allArtifacts.push(...availableArtifacts);
        } catch (error) {
          console.warn(`[IssueDetailsProvider] Error processing trackable ${trackableId}:`, error);
          continue;
        }
      }

      // Return the combined list of available artifacts
      return allArtifacts;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error in fetchAvailableArtifacts:', error);
      throw error;
    }
  }

  /**
   * Adds an artifact to an issue
   */
  private async addArtifactToIssue(input: { issue: string, artefact: string }): Promise<any> {
    try {
      await this.apiClient.authenticate();

      const result = await this.apiClient.executeQuery(
        ADD_ARTIFACT_TO_ISSUE_MUTATION,
        { input }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.addArtefactToIssue?.addedArtefactEvent) {
        throw new Error('Failed to add artifact to issue: No confirmation data returned');
      }

      return result.data.addArtefactToIssue.addedArtefactEvent;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error in addArtifactToIssue:', error);
      throw error;
    }
  }


  /**
   * Removes an artifact from an issue
   */
  private async removeArtifactFromIssue(input: { issue: string, artefact: string }): Promise<any> {
    try {
      await this.apiClient.authenticate();

      const result = await this.apiClient.executeQuery(
        REMOVE_ARTIFACT_FROM_ISSUE_MUTATION,
        { input }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.removeArtefactFromIssue?.removedArtefactEvent) {
        throw new Error('Failed to remove artifact from issue: No confirmation data returned');
      }

      return result.data.removeArtefactFromIssue.removedArtefactEvent;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error in removeArtifactFromIssue:', error);
      throw error;
    }
  }

  private async fetchIssueRelationTypes(): Promise<any[]> {
    try {
      await globalApiClient.authenticate();
      const result = await globalApiClient.executeQuery(GET_ISSUE_RELATION_TYPES, {
        filter: {},
        first: 10,
        query: "*",
        skip: 0,
      });
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      return result.data.searchIssueRelationTypes;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching relation types:', error);
      return [];
    }
  }

  private async changeIssueRelationType(data: { relationId: string, typeId: string }): Promise<any> {
    try {
      await globalApiClient.authenticate();
      const result = await globalApiClient.executeQuery(
        CHANGE_ISSUE_RELATION_TYPE_MUTATION,
        {
          input: {
            issueRelation: data.relationId,
            type: data.typeId,
          }
        }
      );
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      const eventData = result.data?.changeIssueRelationType?.outgoingRelationTypeChangedEvent;
      if (!eventData) {
        console.info('No change occurred: the relation type was already set to the selected value.');
        return null;
      }
      return eventData.newType;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing relation type:', error);
      throw error;
    }
  }

  /**
   * Opens the graph editor.
   * Loads the issue graph.
   * 
   */
  public async openIssueGraphEditor(): Promise<void> {
    console.log("Start openIssueGraphEditor.");
    const panel = vscode.window.createWebviewPanel(
      "graphIssueEditor",
      "Graph Editor",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "out", "webview")
        ]
      }
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "GraphIssueEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);
    if (!panel.webview) {
      console.error("Webview is undefined!");
    }

    panel.webview.onDidReceiveMessage((message: any): void => {
      console.log("START: onDidReceiveMessage in IssueDetailsProvider");
      if (message.type === "ready") {
        (async () => {
          try {
            await this.apiClient.authenticate();
            const mappings = await loadConfigurations();
            const workspaceData = await this._buildTreeData(mappings);
            const issueData = await this.fetchIssueGraphData();
            panel.webview.postMessage({
              type: "issueData",
              data: issueData,
              workspace: workspaceData
            });
          } catch (error) {
            vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
          }
        })();
      } else {
        console.log("We are in EEEEEEEEEEEEEEEEEELLLLLLLLLLLLLLLLLLSSSSSSSSSSSSSSSSSEEEEEEEEEEEEEEE");
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
  }
  /**
   * Fetch issue data
   * 
   * @returns 
   */
  private async fetchIssueGraphData(): Promise<any> {
    console.log("Start fetchIssueData");
    try {
      await this.apiClient.authenticate();
      const mappings = await loadConfigurations();
      const workspaceData = await this._buildTreeData(mappings);
      const components = this.getComponents(workspaceData);
      const response = await this.apiClient.executeQuery(FETCH_TEMP_ISSUE_GRAPH, { id: this.lastIssueId }); //this.lastIssueId
      console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY");
      console.log(JSON.stringify(response.data.node));
      console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY");
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch issue graph: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getComponents(data: any): string[] {
    console.log("Start getComponents.");
    let ids: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        ids = ids.concat(this.getComponents(item));
      }
    } else if (typeof data === "object" && data !== null) {
      for (const key in data) {
        if (key === "id") {
          ids.push(data[key]);
        } else {
          ids = ids.concat(this.getComponents(data[key]));
        }
      }
    }

    return ids;
  }

  getGraphEditorHtml(scriptUri: vscode.Uri): string {
    console.log("STEP: Generating Webview HTML");
    console.log("Script URI:", scriptUri.toString());
    return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Graph Editor</title>
      <style>
        html, body {
          height: 100vh;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        #app {
          height: 100vh;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div id="app"></div>
      <script src="${scriptUri}"></script>

    </body>
    </html>
  `;
  }

  private async _fetchComponentVersions(
    componentId?: string,
    projectId?: string,
    componentVersionId?: string
  ): Promise<{ id?: string, componentVersionIds?: string[], name: string, description?: string, versions: string[] }> {
    try {
      // Authenticate if needed
      if (!this.isAuthenticated) {
        await this.apiClient.authenticate();
        this.isAuthenticated = true;
      }

      // If we have a direct component version ID, fetch that specific version
      if (componentVersionId) {
        console.log(`Fetching component version with ID: ${componentVersionId}`);

        const result = await this.apiClient.executeQuery(FETCH_COMPONENT_VERSION_BY_ID_QUERY, { id: componentVersionId });
        console.log("Direct version query result:", JSON.stringify(result, null, 2));

        if (result.data?.node) {
          const version = result.data.node;
          const versionString = version.version.startsWith('v') ? version.version : `v${version.version}`;
          return {
            id: version.component?.id,
            componentVersionIds: [version.id],
            name: version.component?.name || "Unknown Component",
            description: version.component?.description || "",
            versions: [versionString]
          };
        }
      }
      // For the component+project case
      else if (componentId && projectId) {
        console.log(`Fetching versions for component ID: ${componentId} in project: ${projectId}`);

        const result = await this.apiClient.executeQuery(GET_COMPONENT_VERSIONS_IN_PROJECT_QUERY, {
          projectId: projectId
        });

        console.log("Component+Project query result:", JSON.stringify(result, null, 2));

        if (result.data?.project) {
          const project = result.data.project;
          // Filter to get only versions of our target component
          const componentVersions = project.components.nodes
            .filter((node: any) => node.component.id === componentId);

          if (componentVersions.length > 0) {
            const componentId = componentVersions[0].component.id;
            const componentName = componentVersions[0].component.name;
            const componentDescription = componentVersions[0].component.description || "";

            const versionStrings = [];
            const versionIds = [];

            for (const v of componentVersions) {
              versionStrings.push(v.version.startsWith('v') ? v.version : `v${v.version}`);
              versionIds.push(v.id);  // Store the version ID
            }

            return {
              id: componentId,
              name: componentName,
              componentVersionIds: versionIds,
              description: componentDescription,
              versions: versionStrings,
            };
          }
        }
      }

      return { name: "Unknown", versions: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching component version:', errorMessage);
      vscode.window.showErrorMessage(`Error fetching component version: ${errorMessage}`);
      return { name: "Error", versions: [] };
    }
  }

  private async _buildTreeData(mappings: Map<string, any[]>) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const treeItems = [];

    // Handle multi-root workspace
    if (workspaceFolders.length > 1) {
      for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        const folderMappings = mappings.get(rootPath);

        if (folderMappings && folderMappings.length > 0) {
          // Check if the root folder itself is mapped
          const rootMapping = folderMappings.find(m => m.path === '/');

          if (rootMapping) {
            // Root folder is directly mapped to a component version
            if (rootMapping.componentVersion) {
              const component = await this._fetchComponentVersions(
                undefined, undefined, rootMapping.componentVersion
              );

              if (component.versions.length > 0) {
                treeItems.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }
          } else {
            // Root contains multiple component mappings
            const folderItem: ComponentTreeItem = {
              name: folder.name,
              expanded: false,
              children: []
            };

            // Process each mapping in this folder
            for (const mapping of folderMappings) {
              let component;

              if (mapping.componentVersion) {
                component = await this._fetchComponentVersions(
                  undefined, undefined, mapping.componentVersion
                );
              } else if (mapping.component && mapping.project) {
                component = await this._fetchComponentVersions(
                  mapping.component, mapping.project
                );
              }

              if (component && component.versions.length > 0) {
                folderItem.children!.push({
                  id: component.id,
                  componentVersionIds: component.componentVersionIds,
                  name: component.name,
                  description: component.description,
                  versions: component.versions,
                  expanded: false
                });
              }
            }

            if (folderItem.children!.length > 0) {
              treeItems.push(folderItem);
            }
          }
        }
      }
    } else {
      // Single root workspace - flat list of components
      for (const [rootPath, folderMappings] of mappings.entries()) {
        for (const mapping of folderMappings) {
          let component;

          if (mapping.componentVersion) {
            component = await this._fetchComponentVersions(
              undefined, undefined, mapping.componentVersion
            );
          } else if (mapping.component && mapping.project) {
            component = await this._fetchComponentVersions(
              mapping.component, mapping.project
            );
          }

          if (component && component.versions.length > 0) {
            treeItems.push({
              id: component.id,
              componentVersionIds: component.componentVersionIds,
              name: component.name,
              description: component.description,
              versions: component.versions,
              expanded: false
            });
          }
        }
      }
    }

    return treeItems;
  }


  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'issueDetails.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Issue Details</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
  }

  /**
   * Opens a new editor with the issue description for editing
   */
  private async openDescriptionEditor(data: DescriptionEditorData) {

    try {
      // Create a temporary file in the system's temp directory
      const tempDir = vscode.Uri.file(require('os').tmpdir());

      // Create a safe file name from the issue title
      let safeTitlePart = '';
      if (data.issueTitle) {
        // Replace any characters that aren't safe for filenames
        safeTitlePart = data.issueTitle
          .replace(/[^a-zA-Z0-9\-_]/g, '_')
          .substring(0, 30); // Limit length to avoid overly long filenames

        safeTitlePart = `-${safeTitlePart}`;
      }

      const tempFileName = `Description of${safeTitlePart}.md`;
      const tempFileUri = vscode.Uri.joinPath(tempDir, tempFileName);

      // Store the temp file URI and issue data for later use
      this.tempFileUri = tempFileUri;
      this.descriptionEditData = {
        bodyId: data.bodyId,
        issueId: data.issueId
      };

      // Write the current description to the temp file
      const encoder = new TextEncoder();
      const encodedText = encoder.encode(data.markdown);
      await vscode.workspace.fs.writeFile(tempFileUri, encodedText);

      // Open the temp file in the editor
      const document = await vscode.workspace.openTextDocument(tempFileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Set up a file system watcher to detect when the file is saved
      const watcher = vscode.workspace.createFileSystemWatcher(tempFileUri.fsPath);

      // When the file is saved, update the description in the backend
      const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.toString() === tempFileUri.toString()) {
          this.handleDescriptionSave(doc.getText());
        }
      });

      // Clean up when the editor is closed
      const closeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
        const isOpen = editors.some(e => e.document.uri.toString() === tempFileUri.toString());
        if (!isOpen) {
          saveDisposable.dispose();
          watcher.dispose();
          closeDisposable.dispose();
        }
      });

    } catch (error) {
      console.error('[IssueDetailsProvider] Error opening description editor:', error);
      vscode.window.showErrorMessage(`Failed to open description editor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
 * Changes the issue title
 */
  private async changeIssueTitle(data: { issueId: string, title: string }): Promise<string> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(CHANGE_ISSUE_TITLE_MUTATION, {
        input: {
          issue: data.issueId,
          title: data.title
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Return the updated title
      return result.data?.changeIssueTitle?.titleChangedEvent?.newTitle;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing issue title:', error);
      throw error;
    }
  }

  private async searchUsers(query: string): Promise<any[]> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(
        GET_ALL_USERS,
        { query: query }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.searchUsers || [];
    } catch (error) {
      console.error('[IssueDetailsProvider] Error searching users:', error);
      return [];
    }
  }

  // Add this method to IssueDetailsProvider class
  private async createAssignment(issueId: string, userId: string): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(
        CREATE_ASSIGNMENT_MUTATION,
        {
          input: {
            issue: issueId,
            user: userId
            // No type - will default to null
          }
        }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.createAssignment?.assignment;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error creating assignment:', error);
      throw error;
    }
  }

  /**
   * Handles saving the description when the temporary file is saved
   */
  private async handleDescriptionSave(newContent: string) {
    if (!this.descriptionEditData || !this.tempFileUri) {
      console.error('[IssueDetailsProvider] Missing description edit data');
      return;
    }

    try {
      // Save the changes to the backend
      await this.saveDescriptionChanges({
        id: this.descriptionEditData.bodyId,
        body: newContent
      });

      vscode.window.showInformationMessage('Issue description updated successfully.');
    } catch (error) {
      console.error('[IssueDetailsProvider] Error saving description:', error);
      vscode.window.showErrorMessage(`Failed to save description: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves description changes to the backend using the updateBody mutation
   */
  private async saveDescriptionChanges(data: { id: string, body: string }) {
    try {
      // Authenticate
      await globalApiClient.authenticate();

      // Execute the updateBody mutation
      const result = await globalApiClient.executeQuery(UPDATE_BODY_MUTATION, {
        input: {
          id: data.id,
          body: data.body
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.updateBody?.body) {
        throw new Error('Failed to update description: No data returned');
      }

      // Notify the webview that the description has been updated
      if (this._view) {
        this._view.webview.postMessage({
          command: 'descriptionUpdated',
          body: result.data.updateBody.body.body,
          lastModifiedAt: result.data.updateBody.body.lastModifiedAt
        });
      }

      // Refresh the component issues to reflect any changes
      vscode.commands.executeCommand('extension.refreshComponentIssues');

    } catch (error) {
      console.error('[IssueDetailsProvider] Error in saveDescriptionChanges:', error);
      throw error;
    }
  }

  public updateIssueDetails(issueId: string, originComponentId?: string) {
    if (typeof originComponentId !== 'undefined') {
      if (originComponentId) {
        this.originComponentId = originComponentId;
      }
    }
    this.lastIssueId = issueId;

    globalApiClient.authenticate()
      .then(() => {
        return Promise.all([
          globalApiClient.executeQuery(GET_ISSUE_DETAILS, { id: issueId }),
          globalApiClient.executeQuery(GET_ARTIFACTS_FOR_ISSUE, { issueId: issueId })
        ]);
      })
      .then(([issueData, artifactsData]) => {
        if (issueData.data && issueData.data.node) {
          // Check if assignments data exists and log it
          if (issueData.data.node.assignments) {
            console.log(`[IssueDetailsProvider] Issue ${issueId} has assignments data:`,
              issueData.data.node.assignments.nodes ?
                `${issueData.data.node.assignments.nodes.length} assignments` :
                'No assignments nodes');
          } else {
            console.log(`[IssueDetailsProvider] Issue ${issueId} has no assignments data`);
          }

          const issueWithArtifacts = {
            ...issueData.data.node,
            artifacts: artifactsData.data?.node?.artefacts?.nodes || []
          };

          this._view?.webview.postMessage({
            command: 'displayIssue',
            issue: issueWithArtifacts,
            originComponentId: this.originComponentId
          });
          vscode.commands.executeCommand('extension.refreshComponentIssues');
        } else {
          console.warn(`[IssueDetailsProvider] No issue found for id ${issueId}`);
          this._view?.webview.postMessage({
            command: 'displayIssue',
            issue: null,
            error: 'Issue not found'
          });
        }
      })
      .catch(error => {
        console.error("[IssueDetailsProvider] Error fetching data:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this._view?.webview.postMessage({
          command: 'displayIssue',
          issue: null,
          error: `Error fetching issue: ${errorMessage}`
        });
      });
  }

  // Add this function to IssueDetailsProvider class
  private async fetchAssignmentTypesForTemplate(templateId: string): Promise<any[]> {
    try {
      await globalApiClient.authenticate();
      console.log(`[IssueDetailsProvider] Fetching assignment types for template: ${templateId}`);

      const result = await globalApiClient.executeQuery(
        GET_ASSIGNMENT_TYPES_FOR_TEMPLATE,
        { templateId }
      );

      console.log('[IssueDetailsProvider] Assignment types query result:', result);

      if (result.data?.node?.assignmentTypes?.nodes) {
        const types = result.data.node.assignmentTypes.nodes;
        console.log(`[IssueDetailsProvider] Found ${types.length} assignment types for template`);
        return types;
      }

      console.warn('[IssueDetailsProvider] No assignment types found for template');
      return [];
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching assignment types:', error);
      return [];
    }
  }

  private async changeAssignmentType(data: { assignmentId: string, typeId: string | null }): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const input: any = {
        assignment: data.assignmentId
      };

      // Add type if provided
      if (data.typeId) {
        input.type = data.typeId;
      }

      console.log('[IssueDetailsProvider] Sending changeAssignmentType mutation:', input);

      const result = await globalApiClient.executeQuery(
        CHANGE_ASSIGNMENT_TYPE_MUTATION,
        { input }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      console.log('[IssueDetailsProvider] Assignment type updated:', result);

      // Return the updated assignment
      return result.data?.changeAssignmentType?.assignmentTypeChangedEvent?.assignment;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing assignment type:', error);
      throw error;
    }
  }

  private async removeAssignment(assignmentId: string): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(
        REMOVE_ASSIGNMENT_MUTATION,
        { input: { assignment: assignmentId } }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.removeAssignment?.removedAssignmentEvent;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error removing assignment:', error);
      throw error;
    }
  }

  /**
 * Fetches available issue priorities (independent of template)
 */
  private async fetchIssuePriorities(templateId: string): Promise<any[]> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(GET_ISSUE_TEMPLATE_PRIORITIES);

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.searchIssuePriorities || [];
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching priorities:', error);
      throw error;
    }
  }

  /**
   * Fetches available issue states (independent of template)
   */
  private async fetchIssueStates(templateId: string): Promise<any[]> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(GET_ISSUE_TEMPLATE_STATES);

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.searchIssueStates || [];
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching states:', error);
      throw error;
    }
  }

  /**
   * Fetches available issue types (independent of template)
   */
  private async fetchIssueTypes(templateId: string): Promise<any[]> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(GET_ISSUE_TEMPLATE_TYPES);

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data?.searchIssueTypes || [];
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching types:', error);
      throw error;
    }
  }

  /**
   * Fetches all available options for issue editing
   */
  private async fetchIssueOptions(templateId: string): Promise<{ states: any[], types: any[], priorities: any[] }> {
    try {
      console.log(`[IssueDetailsProvider] Fetching options for template ${templateId}`);

      const result = await globalApiClient.executeQuery(
        GET_TEMPLATE_OPTIONS,
        { templateId }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const template = result.data?.node;

      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      const states = template.issueStates?.nodes || [];
      const types = template.issueTypes?.nodes || [];
      const priorities = template.issuePriorities?.nodes || [];

      console.log(`[IssueDetailsProvider] Fetched template-specific options:`, {
        states: states.length,
        types: types.length,
        priorities: priorities.length
      });

      return { states, types, priorities };
    } catch (error) {
      console.error('[IssueDetailsProvider] Error fetching issue options:', error);
      return { states: [], types: [], priorities: [] };
    }
  }

  /**
   * Changes the issue state
   */
  private async changeIssueState(data: { issueId: string, stateId: string }): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(CHANGE_ISSUE_STATE_MUTATION, {
        input: {
          issue: data.issueId,
          state: data.stateId
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Return the updated state
      return result.data?.changeIssueState?.stateChangedEvent?.newState;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing issue state:', error);
      throw error;
    }
  }

  /**
   * Changes the issue type
   */
  private async changeIssueType(data: { issueId: string, typeId: string }): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(CHANGE_ISSUE_TYPE_MUTATION, {
        input: {
          issue: data.issueId,
          type: data.typeId
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Return the updated type
      return result.data?.changeIssueType?.typeChangedEvent?.newType;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing issue type:', error);
      throw error;
    }
  }

  /**
   * Changes the issue priority
   */
  private async changeIssuePriority(data: { issueId: string, priorityId: string }): Promise<any> {
    try {
      await globalApiClient.authenticate();

      const result = await globalApiClient.executeQuery(CHANGE_ISSUE_PRIORITY_MUTATION, {
        input: {
          issue: data.issueId,
          priority: data.priorityId
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Return the updated priority
      return result.data?.changeIssuePriority?.priorityChangedEvent?.newPriority;
    } catch (error) {
      console.error('[IssueDetailsProvider] Error changing issue priority:', error);
      throw error;
    }
  }

  public revealView() {
    if (this._view) {
      // Force the view to show
      this._view.show(false);
      // If there's a last selected issue, re-fetch its details
      if (this.lastIssueId) {
        this.updateIssueDetails(this.lastIssueId);
      }
    } else {
      vscode.commands.executeCommand('workbench.view.explorer');
    }
  }

  // Outgoing Relations

  private async removeIssueRelation(relationId: string): Promise<any> {
    try {
      await globalApiClient.authenticate();
      const result = await globalApiClient.executeQuery(REMOVE_ISSUE_RELATION_MUTATION, { relationId });
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      // Optionally, return the event data for further processing:
      return result.data.removeIssueRelation.removedOutgoingRelationEvent;
    } catch (error) {
      console.error("[IssueDetailsProvider] Error in removeIssueRelation:", error);
      throw error;
    }
  }
}

/**
 * GraphsProvider:
 * - Displays a list of projects using FETCH_DYNAMIC_PROJECTS_QUERY
 * - Each project has a "Show Graph" button that opens a Graph Editor
 */
export class GraphsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "graphs";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient
  ) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Provide HTML for the webview
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: any): void => {
      if (message.command === "vueAppReady") {
        this.fetchAndSendProjects();
      } else if (message.command === "showGraph") {
        const projectId = message.projectId;
        this.openGraphEditor(projectId);
      }
      return;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "graphs.js"
      )
    );
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>Graphs</title>
      </head>
      <body style="padding:0;margin:0;">
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private async fetchAndSendProjects(): Promise<void> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_DYNAMIC_PROJECTS_QUERY);
      if (!response.data || !response.data.projects) {
        throw new Error("No projects data received.");
      }
      const projects = response.data.projects.nodes;
      this._view?.webview.postMessage({
        command: "updateProjects",
        data: projects
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public async openGraphEditor(projectId: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "graphEditor",
      "Graph Editor",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "out", "webview")
        ]
      }
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "graphEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);

    panel.webview.onDidReceiveMessage((message: any): void => {
      if (message.type === "ready") {
        (async () => {
          try {
            await this.apiClient.authenticate();
            const projectData = await this.fetchProjectGraphData(projectId);
            panel.webview.postMessage({
              type: "projectData",
              data: projectData
            });
          } catch (error) {
            vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
          }
        })();
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
  }

  private async fetchProjectGraphData(projectId: string): Promise<any> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_PROJECT_GRAPH_QUERY, { project: projectId });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch project graph: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getGraphEditorHtml(scriptUri: vscode.Uri): string {
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Graph Editor</title>
        <style>
          html, body {
            height: 100vh;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          #app {
            height: 100vh;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
}

/**
 * Manages decorations for artifacts in open text editors
 */
class ArtifactDecoratorManager {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();

  // Map of file URI to artifacts data
  private artifactRanges: Map<string, {
    uri: vscode.Uri,
    ranges: Array<{
      range: vscode.Range,
      artifactId: string
    }>
  }> = new Map();

  // Map of artifact ID to associated issues data
  private artifactIssues: Map<string, Array<{
    issueId: string,
    issueType: string,
    isOpen: boolean,
    title: string
  }>> = new Map();

  // Track which artifact was last accessed from which issue
  private lastAccessedFrom: Map<string, string> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Listen for editor changes to apply decorations
    vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this, context.subscriptions);

    // Apply decorations to all open editors when artifact data changes
    vscode.window.onDidChangeVisibleTextEditors(() => this.applyDecorationsToOpenEditors(), this, context.subscriptions);

    // Apply decorations to the active editor right away
    if (vscode.window.activeTextEditor) {
      this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }
  }

  /**
   * Register an artifact to be highlighted in editors
   * @param artifactId Artifact ID
   * @param fileUri File URI string
   * @param from Starting line (1-based)
   * @param to Ending line (1-based)
   * @param issueData Associated issue data
   */
  public registerArtifact(
    artifactId: string,
    fileUri: string,
    from: number,
    to: number,
    issueData: {
      issueId: string,
      issueType: string,
      isOpen: boolean,
      title: string
    }
  ): void {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const uriString = uri.toString();

      // Convert 1-based line numbers to 0-based
      const startLine = Math.max(0, from - 1);
      const endLine = Math.max(0, to - 1);

      // Create range objects for the first and last lines
      const firstLineRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine, Number.MAX_SAFE_INTEGER)
      );

      // Get or create the artifact ranges for this file
      if (!this.artifactRanges.has(uriString)) {
        this.artifactRanges.set(uriString, {
          uri,
          ranges: []
        });
      }

      const fileRanges = this.artifactRanges.get(uriString)!;

      // Add the first line range
      fileRanges.ranges.push({
        range: firstLineRange,
        artifactId
      });

      // Add the last line range if different from first line
      if (startLine !== endLine) {
        const lastLineRange = new vscode.Range(
          new vscode.Position(endLine, 0),
          new vscode.Position(endLine, Number.MAX_SAFE_INTEGER)
        );

        fileRanges.ranges.push({
          range: lastLineRange,
          artifactId
        });
      }

      // Associate the issue with this artifact
      if (!this.artifactIssues.has(artifactId)) {
        this.artifactIssues.set(artifactId, []);
      }

      const artifactIssues = this.artifactIssues.get(artifactId)!;

      // Check if this issue is already associated
      const existingIssueIndex = artifactIssues.findIndex(issue => issue.issueId === issueData.issueId);

      if (existingIssueIndex >= 0) {
        // Update existing issue data
        artifactIssues[existingIssueIndex] = issueData;
      } else {
        // Add new issue association
        artifactIssues.push(issueData);
      }

      // Apply decorations to open editors
      this.applyDecorationsToOpenEditors();
    } catch (error) {
      console.error(`[ArtifactDecoratorManager] Error registering artifact: ${error}`);
    }
  }

  /**
   * Sets the last accessed issue for an artifact
   * This is used to determine which icon to display
   */
  public setLastAccessedIssue(artifactId: string, issueId: string): void {
    this.lastAccessedFrom.set(artifactId, issueId);
    // Reapply decorations to reflect the change
    this.applyDecorationsToOpenEditors();
  }

  /**
   * Remove an artifact registration
   */
  public unregisterArtifact(artifactId: string): void {
    // Remove issue associations
    this.artifactIssues.delete(artifactId);

    // Remove from last accessed tracking
    this.lastAccessedFrom.delete(artifactId);

    // Find and remove all ranges for this artifact
    for (const [uriString, fileData] of this.artifactRanges.entries()) {
      // Filter out ranges for this artifact
      const updatedRanges = fileData.ranges.filter(r => r.artifactId !== artifactId);

      if (updatedRanges.length === 0) {
        // If no ranges left, remove the file entry
        this.artifactRanges.delete(uriString);
      } else {
        // Update with filtered ranges
        fileData.ranges = updatedRanges;
      }
    }

    // Reapply decorations
    this.applyDecorationsToOpenEditors();
  }

  /**
   * Clear all artifact registrations
   */
  public clearAllArtifacts(): void {
    this.artifactRanges.clear();
    this.artifactIssues.clear();
    this.lastAccessedFrom.clear();
    this.disposeAllDecorations();
  }

  /**
   * Called when the active editor changes
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    // Apply decorations to the new active editor
    this.applyDecorationsToEditor(editor);
  }

  /**
   * Apply decorations to all open editors
   */
  public applyDecorationsToOpenEditors(): void {
    vscode.window.visibleTextEditors.forEach(editor => {
      this.applyDecorationsToEditor(editor);
    });
  }

  private applyDecorationsToEditor(editor: vscode.TextEditor): void {
    const uriString = editor.document.uri.toString();

    // Check if we have artifacts for this file
    if (!this.artifactRanges.has(uriString)) {
      return;
    }

    // Get the file data
    const fileData = this.artifactRanges.get(uriString)!;

    // Group ranges by artifact ID
    const groupedRanges = new Map<string, vscode.Range[]>();

    for (const rangeData of fileData.ranges) {
      if (!groupedRanges.has(rangeData.artifactId)) {
        groupedRanges.set(rangeData.artifactId, []);
      }
      groupedRanges.get(rangeData.artifactId)!.push(rangeData.range);
    }

    // Apply decorations for each artifact
    for (const [artifactId, ranges] of groupedRanges.entries()) {
      // Get issues associated with this artifact
      const issues = this.artifactIssues.get(artifactId) || [];

      // Determine which decoration to use
      const decorationType = this.getDecorationForArtifact(artifactId, issues);

      // Apply the decoration
      editor.setDecorations(decorationType, ranges);
    }
  }

  /**
   * Create or get the decoration type for an artifact
   */
  private getDecorationForArtifact(
    artifactId: string,
    issues: Array<{
      issueId: string,
      issueType: string,
      isOpen: boolean,
      title: string
    }>
  ): vscode.TextEditorDecorationType {
    // Filter open issues
    const openIssues = issues.filter(issue => issue.isOpen);

    // Determine which icon to use
    let iconType: string;
    let iconColor: string;
    let issueCount = issues.length > 1 ? issues.length : 0;

    // If the artifact was last accessed from a specific issue, use that issue's type
    const lastAccessedIssueId = this.lastAccessedFrom.get(artifactId);

    if (lastAccessedIssueId) {
      // Find the last accessed issue
      const lastAccessedIssue = issues.find(issue => issue.issueId === lastAccessedIssueId);

      if (lastAccessedIssue) {
        iconType = lastAccessedIssue.issueType;
        iconColor = lastAccessedIssue.isOpen ? 'green' : 'red';
      } else {
        // Fallback to default selection logic if the last accessed issue is no longer associated
        this.lastAccessedFrom.delete(artifactId);
        [iconType, iconColor] = this.selectIconTypeAndColor(openIssues, issues);
      }
    } else {
      // Default selection logic
      [iconType, iconColor] = this.selectIconTypeAndColor(openIssues, issues);
    }

    // Create a unique key for the decoration type
    const decorationKey = `${artifactId}-${iconType}-${iconColor}-${issueCount}`;

    // Return existing decoration type if we already have one
    if (this.decorationTypes.has(decorationKey)) {
      return this.decorationTypes.get(decorationKey)!;
    }

    // Create a new decoration type
    const extensionPath = this.context.extensionPath;

    const gutterIconPath = path.join(extensionPath, 'resources', 'icons', this.getIconPath(iconType, iconColor));

    // If there are multiple issues, create a decoration with a count
    const decorationType = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Center,
      gutterIconPath: gutterIconPath,
      gutterIconSize: '100%',
      after: issueCount > 0 ? {
        contentText: ` (${issueCount})`,
        color: new vscode.ThemeColor('editorLineNumber.foreground'),
        fontStyle: 'italic'
      } : undefined
    });

    // Store the decoration type
    this.decorationTypes.set(decorationKey, decorationType);

    return decorationType;
  }

  /**
   * Select icon type and color based on available issues
   */
  private selectIconTypeAndColor(
    openIssues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string }>,
    allIssues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string }>
  ): [string, string] {
    // Default to Bug and green if available
    let iconType = 'Bug';
    let iconColor = 'green';

    // If there are open issues, use the first open issue's type
    if (openIssues.length > 0) {
      iconType = openIssues[0].issueType;
      iconColor = 'green'; // Open issues are green
    }
    // Otherwise use the first issue of any state
    else if (allIssues.length > 0) {
      iconType = allIssues[0].issueType;
      iconColor = allIssues[0].isOpen ? 'green' : 'red';
    }

    return [iconType, iconColor];
  }

  /**
   * Get the icon path for a given type and state
   */
  private getIconPath(type: string, color: string): string {
    switch (type) {
      case "Bug":
        return color === 'green' ? "bug-green.png" : "bug-red.png";
      case "Feature":
        return color === 'green' ? "lightbulb-feature-green.png" : "lightbulb-feature-red.png";
      case "Misc":
      case "Task":
        return color === 'green' ? "exclamation-green.png" : "exclamation-red.png";
      default:
        return color === 'green' ? "bug-green.png" : "bug-red.png";
    }
  }

  /**
   * Dispose all decoration types
   */
  private disposeAllDecorations(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.disposeAllDecorations();
  }
}
export function deactivate() {
  // Clean up the decorator manager
  if (artifactDecoratorManager) {
    artifactDecoratorManager.dispose();
  }
}