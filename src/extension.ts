import * as vscode from "vscode";
import { exec } from 'child_process';
import { CLIENT_ID, CLIENT_SECRET, API_URL } from "./config";
import { APIClient } from "./apiClient";
import { loadConfigurations } from './mapping/config-loader';
import {
  REMOVE_ARTIFACT_FROM_ISSUE_MUTATION,
  GET_ARTIFACTS_FOR_ISSUE_WITH_ICON,
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
  GET_ARTIFACTS_FOR_TRACKABLE,
  UPDATE_ARTIFACT_LINES_MUTATION,
  DELETE_ISSUE_COMMENT_MUTATION,
  REMOVE_AFFECTED_ENTITY_FROM_ISSUE_MUTATION,
  GET_AFFECTED_ENTITIES,
  UPDATE_ISSUE_COMMENT_MUTATION,
  CREATE_ISSUE_COMMENT_MUTATION,
  ADD_AFFECTED_ENTITY_TO_ISSUE
} from "./queries";
import path from "path";
import { ConsoleLogger } from "sprotty";

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
 * Updated to include icon paths
 */
async function loadAndRegisterOpenIssueArtifacts() {
  try {

    // Authenticate before making API calls
    await globalApiClient.authenticate();

    // Query for open issues with their artifacts - now including iconPath
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
            iconPath
          }
          state {
            isOpen
          }
          incomingRelations {
            totalCount
          }
          outgoingRelations {
            totalCount
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

      // Track the number of artifacts registered
      let artifactsRegistered = 0;

      // Register each artifact from each open issue
      for (const issue of openIssues) {
        if (issue.artefacts && issue.artefacts.nodes) {
          for (const artifact of issue.artefacts.nodes) {
            if (artifact.file && artifact.from && artifact.to) {
              // Register artifact with the decorator manager - now including iconPath
              artifactDecoratorManager.registerArtifact(
                artifact.id,
                artifact.file,
                artifact.from,
                artifact.to,
                {
                  issueId: issue.id,
                  issueType: issue.type.name,
                  isOpen: issue.state.isOpen,
                  title: issue.title,
                  iconPath: issue.type.iconPath // Include the iconPath from the backend
                }
              );

              artifactsRegistered++;
            }
          }
        }
      }

    }
  } catch (error) {
    console.error('[loadAndRegisterOpenIssueArtifacts] Error:', error);
    vscode.window.showErrorMessage(`Failed to load artifacts for open issues: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Loads and registers artifacts for a specific issue
 * Updated to include icon paths
 * @param issueId The issue ID
 */
async function loadAndRegisterIssueArtifacts(issueId: string) {
  try {
    // Authenticate before making API calls
    await globalApiClient.authenticate();

    // Get the issue details with its artifacts - now including iconPath
    const result = await globalApiClient.executeQuery(
      GET_ARTIFACTS_FOR_ISSUE_WITH_ICON,
      { issueId }
    );

    // Process the result
    if (result.data?.node) {
      const issue = result.data.node;

      if (issue.artefacts && issue.artefacts.nodes) {

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
                title: issue.title,
                iconPath: issue.type.iconPath // Include the iconPath from the backend
              }
            );
          }
        }
      } else {
      }
    }
  } catch (error) {
    console.error(`[loadAndRegisterIssueArtifacts] Error for issue ${issueId}:`, error);
    vscode.window.showErrorMessage(`Failed to load artifacts for issue: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to move artifact at cursor position
async function moveArtifactIconAtCursor(direction: 'up' | 'down'): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found.');
    return;
  }

  const cursorLine = editor.selection.active.line;
  const uriString = editor.document.uri.toString();

  // Find artifacts at this line
  const artifactsAtLine = artifactDecoratorManager.getArtifactsAtLine(uriString, cursorLine);

  if (artifactsAtLine.length === 0) {
    vscode.window.showInformationMessage('No artifacts found at this line.');
    return;
  }

  if (artifactsAtLine.length === 1) {
    // Only one artifact, move it directly
    const artifact = artifactsAtLine[0];
    await artifactDecoratorManager.moveArtifactIcon(artifact, direction);
  } else {
    // Multiple artifacts, ask user which one to move
    const items = artifactsAtLine.map(artifact => ({
      label: `Artifact ${artifact.id.substring(0, 8)}`,
      description: `Lines ${artifact.from}-${artifact.to}`,
      artifact
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select which artifact to move'
    });

    if (selected) {
      await artifactDecoratorManager.moveArtifactIcon(selected.artifact, direction);
    }
  }
}


/**
 * Registers all providers and commands in VS Code
 */
export function activate(context: vscode.ExtensionContext) {

  // Initialize the artifact decorator manager
  artifactDecoratorManager = new ArtifactDecoratorManager(context);

  // Add command that can be called directly (optional)
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openIssueFromArtifact', (artifactId: string) => {
      artifactDecoratorManager.handleArtifactCommand(artifactId);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.viewIssueAtCursor', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      
      const cursorLine = editor.selection.active.line;
      const uriString = editor.document.uri.toString();
      
      // Find artifacts at this line
      const artifactsAtLine = artifactDecoratorManager.getArtifactsAtLine(uriString, cursorLine);
      
      if (artifactsAtLine.length > 0) {
        artifactDecoratorManager.handleArtifactClick(artifactsAtLine);
      } else {
        vscode.window.showInformationMessage('No issues associated with this line of code.');
      }
    })
  );

  // manually refresh artifact highlights
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshArtifactHighlights', () => {
      loadAndRegisterOpenIssueArtifacts();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.moveArtifactIcon', async (artifact, direction) => {
      await artifactDecoratorManager.moveArtifactIcon(artifact, direction);
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
  const issueDetailsProvider = new IssueDetailsProvider(context, globalApiClient, context.extensionUri, artifactDecoratorManager);
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
                title: issueDetailsResult.data?.node?.title || 'Unknown Issue',
                iconPath: issueDetailsResult.data?.node?.type?.iconPath // Add this line
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
    vscode.commands.registerCommand('extension.moveArtifactIconUp', async () => {
      await moveArtifactIconAtCursor('up');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.moveArtifactIconDown', async () => {
      await moveArtifactIconAtCursor('down');
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
          // You could potentially store or use this information
        }

      } catch (error) {
        console.error(`[extension.openArtifactFile] Comprehensive error:`, error);
        vscode.window.showErrorMessage(`Failed to open artifact file: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
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
    const originVersionId = typeof data === 'string' ? null : data.originVersionId;

    // Set this as the current issue in the decorator manager
    artifactDecoratorManager.setCurrentIssue(issueId);

    // Load and register artifacts for this issue, regardless of its state
    loadAndRegisterIssueArtifacts(issueId);
    issueDetailsProvider.updateIssueDetails(issueId, originComponentId, originVersionId);
    issueDetailsProvider.revealView();
  });

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
  private checkPanel: Map<string, vscode.WebviewPanel> = new Map();

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
    if (this.checkPanel.has("Workspace Graph")) {
      this.checkPanel.get("Workspace Graph")!.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "graphWorkspaceEditor",
      "Workspace Graph",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._context.extensionUri, "out", "webview")
        ]
      }
    );
    this.checkPanel.set("Workspace Graph", panel);
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "out", "webview", "GraphWorkspaceEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);
    if (!panel.webview) {
      console.error("Webview is undefined!");
    }

    panel.webview.onDidReceiveMessage((message: any): void => {
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
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
    panel.onDidDispose(() => {
      this.checkPanel.delete("Workspace Graph");
    });
  }
  /**
   * Todo: in... all found components or smth different
   * @returns 
   */
  private async fetchWorkspaceGraphData(): Promise<any> {
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

    // Iterate through workspace folders and their mappings
    for (const [rootPath, folderMappings] of mappings.entries()) {
      // Check if file is in this workspace folder
      if (!normalizedFilePath.startsWith(rootPath)) {
        continue;
      }

      // Calculate relative path from workspace root
      let relativePath = normalizedFilePath.substring(rootPath.length);
      // Normalize path separators to forward slashes
      relativePath = relativePath.replace(/\\/g, '/');
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }

      // Check each mapping to see if it applies to this file
      for (const mapping of folderMappings) {
        // Get mapping path, ensuring it has a trailing slash for directory matching
        let mappingPath = mapping.path;
        if (mappingPath !== '/' && !mappingPath.endsWith('/')) {
          mappingPath += '/';
        }

        // Check if the file is in this mapped folder
        if (relativePath === mappingPath || relativePath.startsWith(mappingPath)) {

          // Direct component version mapping
          if (mapping.componentVersion) {
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
      return mappedTrackables;
    }

    // If no mappings found, return empty array (we won't use a fallback)
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
          originComponentId: originId,
          originVersionId: this.lastVersionId
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
      } else if (message.command === 'editNewIssueDescription') {
        this.openNewIssueDescriptionEditor(message.data);
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

  /**
   * Opens a new editor with the issue description for editing
   */
  private async openNewIssueDescriptionEditor(data: DescriptionEditorData) {
    try {
      const tempDir = vscode.Uri.file(require('os').tmpdir());

      let safeTitlePart = '';
      if (data.issueTitle) {
        safeTitlePart = data.issueTitle.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 30);
        safeTitlePart = `-${safeTitlePart}`;
      }

      const tempFileName = `Description of${safeTitlePart}.md`;
      const tempFileUri = vscode.Uri.joinPath(tempDir, tempFileName);

      // Write content to file
      const encodedText = new TextEncoder().encode(data.markdown);
      await vscode.workspace.fs.writeFile(tempFileUri, encodedText);

      // Open editor
      const document = await vscode.workspace.openTextDocument(tempFileUri);
      await vscode.window.showTextDocument(document);

      // Watch for saves
      const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.toString() === tempFileUri.toString()) {
          // Send updated text back to webview
          const updatedText = doc.getText();
          this._view?.webview.postMessage({
            command: 'updateNewIssueDescription',
            markdown: updatedText
          });
        }
      });

      // Clean up when editor closes
      const closeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
        const isStillOpen = editors.some(e => e.document.uri.toString() === tempFileUri.toString());
        if (!isStillOpen) {
          saveDisposable.dispose();
          closeDisposable.dispose();
        }
      });

    } catch (error) {
      console.error('[IssueDetailsProvider] Error opening description editor:', error);
      vscode.window.showErrorMessage(`Failed to open description editor: ${error instanceof Error ? error.message : String(error)}`);
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
  private originVersionId: string | null = null;
  private tempFileUri: vscode.Uri | null = null;
  private descriptionEditData: { bodyId: string, issueId: string } | null = null;
  private isAuthenticated: boolean = false;
  private editCommentData: { commentId: string, issueId: string } | null = null;
  private newCommentData: { issueId: string, commentId: string | null } | null = null;
  private selectedIssueName: string | null = null;
  private checkPanel: Map<string, vscode.WebviewPanel> = new Map();


  public refreshCurrentIssue(): void {
    if (this._view && this.lastIssueId) {
      this.updateIssueDetails(this.lastIssueId);
    }
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: APIClient,
    private readonly _extensionUri: vscode.Uri,
    private readonly artifactDecorator: ArtifactDecoratorManager
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
        if (templateId) {
          try {
            const options = await this.fetchIssueOptions(templateId);

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

          vscode.commands.executeCommand('extension.issueUpdated', {
            issueId: message.issueId,
            field: 'type',
            newValue: updatedType
          });
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
      } else if (message.command === 'deleteIssueComment') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(
            DELETE_ISSUE_COMMENT_MUTATION,
            { input: message.input }
          );

          if (result.errors) {
            throw new Error(result.errors[0].message);
          }

          if (!result.data?.deleteIssueComment?.issueComment) {
            throw new Error('Failed to delete comment: No data returned');
          }

          // Send success response back to the webview
          this._view?.webview.postMessage({
            command: 'commentDeleted',
            commentId: message.input.id
          });

          // Optionally refresh the issue details
          this.refreshCurrentIssue();
        } catch (error) {
          console.error('[IssueDetailsProvider] Error deleting comment:', error);
          this._view?.webview.postMessage({
            command: 'commentDeleteError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'addComment') {
        this.openCommentCreator({
          issueId: message.issueId || this.lastIssueId,
          issueTitle: message.issueTitle
        });
      } else if (message.command === 'editComment') {
        this.openCommentEditor(message.data);
      }
      else if (message.command === 'updateComment') {
        // Save comment changes
        this.saveCommentChanges(message.data);
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
        try {
          await this.removeIssueRelation(message.relationId);
          vscode.window.showInformationMessage("Relation removed successfully.");
          // Refresh the issue details to update the outgoing relations UI
          this.refreshCurrentIssue();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to remove relation: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (message.command === "showIssueGraph") {
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
      } else if (message.command === 'removeAffectedElementFromIssue') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(REMOVE_AFFECTED_ENTITY_FROM_ISSUE_MUTATION, {
            issue: message.input.issue,
            affectedEntity: message.input.affectedEntity
          });
          if (!result.data.removeAffectedEntityFromIssue?.removedAffectedEntityEvent?.removedAffectedEntity) {
            throw new Error(
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : "Affected entity removal failed."
            );
          }
          this._view?.webview.postMessage({
            command: 'affectedEntityRemovedFromIssue',
            removedAffectedEntity: result.data.removeAffectedEntityFromIssue.removedAffectedEntityEvent.removedAffectedEntity,
          });
          // Optionally, trigger a refresh of the issue details view:
          vscode.commands.executeCommand('extension.refreshCurrentIssue');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to remove affected entity: ${errorMsg}`);
          this._view?.webview.postMessage({
            command: 'removeAffectedEntityFromIssueError',
            error: errorMsg,
          });
        }
      } else if (message.command === 'createNewAffection') {
        console.log("Start createNewAffection");
        // Todo
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
      } else if (message.command === 'getAffectedEntities') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(GET_AFFECTED_ENTITIES);
          const projects = result.data?.projects?.nodes || [];
          const components = result.data?.components?.nodes || [];

          this._view?.webview.postMessage({
            command: 'affectedEntitiesLoaded',
            data: { projects, components }
          });
        } catch (error) {
          this._view?.webview.postMessage({
            command: 'affectedEntitiesError',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (message.command === 'addAffectedEntityToIssue') {
        try {
          await globalApiClient.authenticate();
          const result = await globalApiClient.executeQuery(
            ADD_AFFECTED_ENTITY_TO_ISSUE,
            { input: { issue: message.issueId, affectedEntity: message.entityId } }
          );
          const added = result.data?.addAffectedEntityToIssue?.addedAffectedEntityEvent?.addedAffectedEntity;
          if (!added) {
            throw new Error('No entity was added.');
          }
          // Send the newly‐added entity back to the WebView
          this._view?.webview.postMessage({
            command: 'affectedEntityAddedToIssue',
            entity: added
          });
          // Optionally refresh full issue details to update any other UI
          vscode.commands.executeCommand('extension.refreshCurrentIssue');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this._view?.webview.postMessage({
            command: 'addAffectedEntityError',
            error: msg
          });
        }
      }
    });
  }

  private async fetchAffectedEntities(): Promise<{
    projects: { nodes: { id: string; name: string }[] };
    components: { nodes: { id: string; name: string; versions: { nodes: { id: string; version: string }[] }[] } };
  }> {
    await globalApiClient.authenticate();
    const result = await globalApiClient.executeQuery(GET_AFFECTED_ENTITIES);
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    return {
      projects: result.data!.projects,
      components: result.data!.components
    };
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
 * Opens a new editor with the comment for editing
 */
  private async openCommentEditor(data: { commentId: string, body: string, issueId: string, issueTitle?: string }) {
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

      const tempFileName = `Comment${safeTitlePart}.md`;
      const tempFileUri = vscode.Uri.joinPath(tempDir, tempFileName);

      // Store the temp file URI and comment data for later use
      this.tempFileUri = tempFileUri;
      this.editCommentData = {
        commentId: data.commentId,
        issueId: data.issueId
      };

      // Write the current comment text to the temp file
      const encoder = new TextEncoder();
      const encodedText = encoder.encode(data.body);
      await vscode.workspace.fs.writeFile(tempFileUri, encodedText);

      // Open the temp file in the editor
      const document = await vscode.workspace.openTextDocument(tempFileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Set up a file system watcher to detect when the file is saved
      const watcher = vscode.workspace.createFileSystemWatcher(tempFileUri.fsPath);

      // When the file is saved, update the comment in the backend
      const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.toString() === tempFileUri.toString()) {
          this.handleCommentSave(doc.getText());
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
      console.error('[IssueDetailsProvider] Error opening comment editor:', error);
      vscode.window.showErrorMessage(`Failed to open comment editor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handles saving the comment when the temporary file is saved
   */
  private async handleCommentSave(newContent: string) {
    if (!this.editCommentData || !this.tempFileUri) {
      console.error('[IssueDetailsProvider] Missing comment edit data');
      return;
    }

    try {
      // Save the changes to the backend
      await this.saveCommentChanges({
        id: this.editCommentData.commentId,
        body: newContent
      });

      vscode.window.showInformationMessage('Comment updated successfully.');
    } catch (error) {
      console.error('[IssueDetailsProvider] Error saving comment:', error);
      vscode.window.showErrorMessage(`Failed to save comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves comment changes to the backend using the updateIssueComment mutation
   */
  private async saveCommentChanges(data: { id: string, body: string }) {
    try {
      // Authenticate
      await globalApiClient.authenticate();

      // Execute the updateIssueComment mutation
      const result = await globalApiClient.executeQuery(UPDATE_ISSUE_COMMENT_MUTATION, {
        input: {
          id: data.id,
          body: data.body
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.updateIssueComment?.issueComment) {
        throw new Error('Failed to update comment: No data returned');
      }

      // Notify the webview that the comment has been updated
      if (this._view) {
        this._view.webview.postMessage({
          command: 'commentUpdated',
          commentId: data.id,
          body: result.data.updateIssueComment.issueComment.body,
          lastModifiedAt: result.data.updateIssueComment.issueComment.lastModifiedAt
        });
      }

      // Refresh the component issues to reflect any changes
      vscode.commands.executeCommand('extension.refreshComponentIssues');

    } catch (error) {
      console.error('[IssueDetailsProvider] Error in saveCommentChanges:', error);

      // Notify the webview of the error
      if (this._view) {
        this._view.webview.postMessage({
          command: 'commentUpdateError',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      throw error;
    }
  }

  /**
 * Adds an artifact to an issue and immediately registers it for highlighting
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

      // Now, fetch the full artifact and issue details to properly register the artifact
      const artifactId = input.artefact;
      const issueId = input.issue;

      // Fetch the artifact details to get file path, line numbers, etc.
      const artifactResult = await this.apiClient.executeQuery(`
      query GetArtifactDetails($artifactId: ID!) {
        node(id: $artifactId) {
          ... on Artefact {
            id
            file
            from
            to
            version
          }
        }
      }
    `, { artifactId });

      // Fetch the issue details to get type, state, icon path, etc.
      const issueResult = await this.apiClient.executeQuery(
        GET_ISSUE_DETAILS,
        { id: issueId }
      );

      if (artifactResult.data?.node && issueResult.data?.node) {
        const artifact = artifactResult.data.node;
        const issue = issueResult.data.node;

        // Register the artifact with the decorator manager
        artifactDecoratorManager.registerArtifact(
          artifactId,
          artifact.file,
          artifact.from,
          artifact.to,
          {
            issueId: issueId,
            issueType: issue.type.name,
            isOpen: issue.state.isOpen,
            title: issue.title,
            iconPath: issue.type.iconPath
          }
        );

        // Force complete decoration refresh for the affected file
        const affectedUris = [artifact.file];
        artifactDecoratorManager.simulateEditorReopen(affectedUris);
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

      // Add this line to immediately unregister the artifact
      artifactDecoratorManager.unregisterArtifact(input.artefact);

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
    const issueData = await this.fetchIssueGraphData();
    this.selectedIssueName = await issueData.node.title;
    const issueTitle = "Issue Graph Editor for " + this.selectedIssueName;

    if (this.checkPanel.has(issueTitle)) {
      this.checkPanel.get(issueTitle)!.reveal(vscode.ViewColumn.One);
      return;
    }
    let panel = vscode.window.createWebviewPanel(
      "graphIssueEditor",
      issueTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "out", "webview")
        ]
      }
    );
    this.checkPanel.set(issueTitle, panel);
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "GraphIssueEditor.js")
    );
    panel.webview.html = this.getGraphEditorHtml(scriptUri);
    if (!panel.webview) {
      console.error("Webview is undefined!");
    }

    panel.webview.onDidReceiveMessage((message: any): void => {
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
              workspace: workspaceData,
              version: this.originVersionId
            });
          } catch (error) {
            vscode.window.showErrorMessage(`Data fetch failed: ${error}`);
          }
        })();
      } else {
      }
      return;
    });

    panel.reveal(vscode.ViewColumn.One);
    panel.onDidDispose(() => {
      this.checkPanel.delete(issueTitle);
    });
  }
  /**
   * Fetch issue data
   * 
   * @returns 
   */
  private async fetchIssueGraphData(): Promise<any> {
    try {
      await this.apiClient.authenticate();
      const response = await this.apiClient.executeQuery(FETCH_TEMP_ISSUE_GRAPH, { id: this.lastIssueId });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch issue graph: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  getGraphEditorHtml(scriptUri: vscode.Uri): string {
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

  /**
 * Opens a new editor for creating a comment
 */
  private async openCommentCreator(data: { issueId: string, issueTitle?: string }) {
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

      const tempFileName = `NewComment${safeTitlePart}.md`;
      const tempFileUri = vscode.Uri.joinPath(tempDir, tempFileName);

      // Store the temp file URI and issue data for later use
      this.tempFileUri = tempFileUri;
      this.newCommentData = {
        issueId: data.issueId,
        commentId: null // Will be set after first save
      };

      // Write an empty file or template with instructions
      const encoder = new TextEncoder();
      const templateText = `
  <!-- 
  Write your comment here. 
  Save (Ctrl+S) to create the comment. 
  Close without saving to cancel.
  If left empty, no comment will be created. 
  -->
  
  `;
      const encodedText = encoder.encode(templateText);
      await vscode.workspace.fs.writeFile(tempFileUri, encodedText);

      // Open the temp file in the editor
      const document = await vscode.workspace.openTextDocument(tempFileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Set up a file system watcher to detect when the file is saved
      const watcher = vscode.workspace.createFileSystemWatcher(tempFileUri.fsPath);

      // When the file is saved, create or update the comment
      const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.toString() === tempFileUri.toString()) {
          this.handleNewCommentSave(doc.getText());
        }
      });

      // Clean up when the editor is closed
      const closeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
        const isOpen = editors.some(e => e.document.uri.toString() === tempFileUri.toString());
        if (!isOpen) {
          saveDisposable.dispose();
          watcher.dispose();
          closeDisposable.dispose();

          // Reset the comment data when the editor is closed
          this.newCommentData = null;
          this.tempFileUri = null;
        }
      });

    } catch (error) {
      console.error('[IssueDetailsProvider] Error opening comment creator:', error);
      vscode.window.showErrorMessage(`Failed to open comment creator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handles saving a new comment when the temporary file is saved
   */
  private async handleNewCommentSave(content: string) {
    if (!this.newCommentData || !this.tempFileUri) {
      console.error('[IssueDetailsProvider] Missing new comment data');
      return;
    }

    try {
      // Remove the template comment if it's still there
      const cleanContent = content.replace(/<!--\s*Write your comment here[\s\S]*?-->\s*/g, '').trim();

      // Check if there's actual content to save
      if (!cleanContent) {
        vscode.window.showInformationMessage('Comment is empty. No comment will be created.');
        return;
      }

      // If we already have a comment ID, this is an edit to an existing comment
      if (this.newCommentData.commentId) {
        await this.saveCommentChanges({
          id: this.newCommentData.commentId,
          body: cleanContent
        });
        vscode.window.showInformationMessage('Comment updated successfully.');
      } else {
        // Otherwise, this is a new comment
        const newComment = await this.createNewComment(cleanContent);

        // Save the comment ID for future edits
        if (newComment && newComment.id) {
          this.newCommentData.commentId = newComment.id;
        }

        vscode.window.showInformationMessage('Comment created successfully.');
      }
    } catch (error) {
      console.error('[IssueDetailsProvider] Error saving comment:', error);
      vscode.window.showErrorMessage(`Failed to save comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * Creates a new comment using the createIssueComment mutation
   */
  private async createNewComment(body: string): Promise<any> {
    if (!this.newCommentData) {
      throw new Error('Missing comment data');
    }

    try {
      // Authenticate
      await globalApiClient.authenticate();

      // Execute the createIssueComment mutation
      const result = await globalApiClient.executeQuery(CREATE_ISSUE_COMMENT_MUTATION, {
        input: {
          issue: this.newCommentData.issueId,
          body: body
        }
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (!result.data?.createIssueComment?.issueComment) {
        throw new Error('Failed to create comment: No data returned');
      }

      const newComment = result.data.createIssueComment.issueComment;

      // Notify the webview that the comment has been created
      if (this._view) {
        this._view.webview.postMessage({
          command: 'commentCreated',
          comment: newComment
        });
      }

      // Refresh the issue details to show the new comment
      this.refreshCurrentIssue();

      // Return the new comment so we can store its ID
      return newComment;

    } catch (error) {
      console.error('[IssueDetailsProvider] Error in createNewComment:', error);
      throw error;
    }
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

  public updateIssueDetails(issueId: string, originComponentId?: string, originVersionId?: string) {
    if (typeof originComponentId !== 'undefined') {
      if (originComponentId) {
        this.originComponentId = originComponentId;
      }
    }

    if (typeof originVersionId !== 'undefined') {
      if (originVersionId) {
        this.originVersionId = originVersionId;
      }
    }

    if (this.lastIssueId && this.lastIssueId !== issueId) {
      // Update the currently selected issue in the decorator manager
      this.artifactDecorator.setCurrentIssue(issueId);
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

      const result = await globalApiClient.executeQuery(
        GET_ASSIGNMENT_TYPES_FOR_TEMPLATE,
        { templateId }
      );

      if (result.data?.node?.assignmentTypes?.nodes) {
        const types = result.data.node.assignmentTypes.nodes;
        return types;
      }

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

      const result = await globalApiClient.executeQuery(
        CHANGE_ASSIGNMENT_TYPE_MUTATION,
        { input }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

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
 * Manages decorations for artifacts in open text editors
 * Updated to use backend-provided SVG icons instead of local images
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

  /**
 * Moves an artifact icon up or down and updates the backend
 * @param artifactId The ID of the artifact to move
 * @param direction 'up' or 'down' to move the icon
 */
  public async moveArtifactIcon(artifactData: { id: string, file: string, from: number, to: number }, direction: 'up' | 'down'): Promise<void> {
    try {
      // Extract artifact data
      const { id, file, from, to } = artifactData;

      // Calculate new line numbers
      let newFrom = from;
      let newTo = to;

      if (direction === 'up') {
        newFrom = Math.max(1, from - 1);
        newTo = Math.max(1, to - 1);
      } else if (direction === 'down') {
        newFrom = from + 1;
        newTo = to + 1;
      }

      // Call the backend to update the artifact
      await globalApiClient.authenticate();
      const result = await globalApiClient.executeQuery(
        UPDATE_ARTIFACT_LINES_MUTATION,
        {
          id,
          from: newFrom,
          to: newTo
        }
      );

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const updatedArtifact = result.data?.updateArtefact?.artefact;

      if (!updatedArtifact) {
        throw new Error('Failed to update artifact: No data returned');
      }

      // Update our local tracking of the artifact
      this.updateArtifactRanges(id, file, from, to, updatedArtifact.from, updatedArtifact.to);

      // Refresh decorations in all editors
      this.clearAllDecorations();
      this.applyDecorationsToOpenEditors();

      // Notify the issue details view to refresh artifact list
      vscode.commands.executeCommand('extension.refreshCurrentIssue');

      // Show confirmation
      vscode.window.showInformationMessage(`Artifact moved to lines ${updatedArtifact.from}-${updatedArtifact.to}`);

    } catch (error) {
      console.error(`[ArtifactDecoratorManager] Error moving artifact:`, error);
      vscode.window.showErrorMessage(`Failed to move artifact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public handleArtifactCommand(artifactId: string): void {
    const issues = this.artifactIssues.get(artifactId) || [];

    if (issues.length === 0) {
      vscode.window.showInformationMessage('No issues associated with this artifact.');
      return;
    }

    if (issues.length === 1) {
      // Only one issue, open it directly
      vscode.commands.executeCommand('extension.showIssueDetails', issues[0].issueId);
    } else {
      // Find the artifact data
      let artifact: { id: string, file: string, from: number, to: number } | undefined;

      for (const [uriString, fileData] of this.artifactRanges.entries()) {
        for (const rangeData of fileData.ranges) {
          if (rangeData.artifactId === artifactId) {
            artifact = {
              id: artifactId,
              file: uriString,
              from: rangeData.range.start.line + 1,
              to: rangeData.range.end.line + 1
            };
            break;
          }
        }
        if (artifact) {break;}
      }

      if (artifact) {
        // Multiple issues, show quick pick
        this.showQuickPickForIssues(issues, artifact);
      } else {
        vscode.window.showErrorMessage('Could not find artifact data.');
      }
    }
  }

  /**
   * Updates the internal tracking of artifact ranges after a move
   */
  private updateArtifactRanges(
    artifactId: string,
    fileUri: string,
    oldFrom: number,
    oldTo: number,
    newFrom: number,
    newTo: number
  ): void {
    const uriString = fileUri.toString();

    if (!this.artifactRanges.has(uriString)) {
      console.warn(`[ArtifactDecoratorManager] Cannot update artifact ranges: file ${uriString} not found`);
      return;
    }

    const fileData = this.artifactRanges.get(uriString)!;

    // Find the ranges for this artifact
    for (let i = 0; i < fileData.ranges.length; i++) {
      const rangeData = fileData.ranges[i];

      if (rangeData.artifactId === artifactId) {
        // Check if this is a start or end line
        const isStartLine = rangeData.range.start.line === oldFrom - 1;
        const isEndLine = rangeData.range.end.line === oldTo - 1;

        if (isStartLine || isEndLine) {
          // Create a new range with updated line numbers
          const newRange = new vscode.Range(
            isStartLine ? new vscode.Position(newFrom - 1, 0) : rangeData.range.start,
            isEndLine ? new vscode.Position(newTo - 1, Number.MAX_SAFE_INTEGER) : rangeData.range.end
          );

          // Update the range
          fileData.ranges[i] = {
            artifactId,
            range: newRange
          };
        }
      }
    }
  }

  // Map of artifact ID to associated issues data
  private artifactIssues: Map<string, Array<{
    issueId: string,
    issueType: string,
    isOpen: boolean,
    title: string,
    iconPath?: string
  }>> = new Map();

  private lastClickTime: number = 0;
  private clickCooldown: number = 300; // ms to prevent double-click issues

  // Cache for icon SVG data
  private iconCache: Map<string, string> = new Map();

  // Track which artifact was last accessed from which issue
  private lastAccessedFrom: Map<string, string> = new Map();

  // Track the currently selected issue ID
  private currentlySelectedIssueId: string | null = null;

  // Map to track which artifacts are displayed for which files
  private activeArtifacts: Map<string, Set<string>> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Listen for editor changes to apply decorations
    vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this, context.subscriptions);

    // Apply decorations to all open editors when artifact data changes
    vscode.window.onDidChangeVisibleTextEditors(() => this.applyDecorationsToOpenEditors(), this, context.subscriptions);

    // Apply decorations to the active editor right away
    if (vscode.window.activeTextEditor) {
      this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }

    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection(this.onSelectionChanged.bind(this))
    );

    // Add click handler for gutter icons
    context.subscriptions.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        // When editors change, make sure decorations are applied to all
        this.applyDecorationsToOpenEditors();
      })
    );
  }

  /**
   * Handles clicks on artifact gutter icons
   */
  public handleArtifactClick(artifacts: Array<{ id: string, file: string, from: number, to: number }>): void {
    if (artifacts.length === 0) {
      return;
    }

    // If there's only one artifact, we need to check if it has multiple issues
    const artifactId = artifacts[0].id;
    const issues = this.artifactIssues.get(artifactId) || [];

    if (issues.length === 0) {
      // No issues found for this artifact
      vscode.window.showInformationMessage('No issues associated with this code.');
      return;
    }

    if (issues.length === 1) {
      // Only one issue, open it directly
      vscode.commands.executeCommand('extension.showIssueDetails', issues[0].issueId);
    } else {
      // Multiple issues, show quick pick
      this.showQuickPickForIssues(issues, artifacts[0]);
    }
  }

  /**
   * Shows a quick pick when multiple issues are associated with an artifact
   */
  private async showQuickPickForIssues(
    issues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string, iconPath?: string }>,
    artifact: { id: string, file: string, from: number, to: number }
  ): Promise<void> {
    const issueItems = issues.map(issue => ({
      label: issue.title || 'Unknown Issue',
      description: `${issue.issueType} (${issue.isOpen ? 'Open' : 'Closed'})`,
      issueId: issue.issueId
    }));

    // Sort items by open status (open issues first) and then by title
    issueItems.sort((a, b) => {
      const issueA = issues.find(i => i.issueId === a.issueId);
      const issueB = issues.find(i => i.issueId === b.issueId);

      if (issueA?.isOpen && !issueB?.isOpen) { return -1; }
      if (!issueA?.isOpen && issueB?.isOpen) { return 1; }
      return a.label.localeCompare(b.label);
    });

    const selected = await vscode.window.showQuickPick(issueItems, {
      placeHolder: 'Select an issue to view',
      title: `Issues for lines ${artifact.from}-${artifact.to}`
    });

    if (selected) {
      vscode.commands.executeCommand('extension.showIssueDetails', selected.issueId);
    }
  }

  /**
   * Handle selection changes (clicks) in the editor
   */
  private onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
    // Only handle selection changes triggered by mouse
    if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
      return;
    }

    // Implement click cooldown to prevent accidental double-triggering
    const now = Date.now();
    if (now - this.lastClickTime < this.clickCooldown) {
      return;
    }
    this.lastClickTime = now;

    const editor = event.textEditor;
    const selection = editor.selection;
    const cursorLine = selection.active.line;

    // Check if this line has an artifact decoration
    const uriString = editor.document.uri.toString();
    const artifactsAtLine = this.getArtifactsAtLine(uriString, cursorLine);

    if (artifactsAtLine.length > 0) {
      // Check if click is in the gutter area (where icons are shown)
      // This is an approximation - VS Code doesn't expose exact gutter info
      const gutterClick = selection.active.character === 0;

      // Only proceed if this was a click in the gutter area or we're specifically
      // targeting artifact icons
      if (gutterClick) {
        this.handleArtifactClick(artifactsAtLine);
      }
    }
  }

  /**
 * Sets the currently selected issue and forces a complete decoration refresh
 */
  public setCurrentIssue(issueId: string | null): void {
    // Skip if there's no change
    if (this.currentlySelectedIssueId === issueId) {
      return;
    }

    // Store old issue ID
    const oldIssueId = this.currentlySelectedIssueId;

    // Update the currently selected issue
    this.currentlySelectedIssueId = issueId;

    // Collect all affected file URIs from both old and new issues
    const affectedUris = new Set<string>();

    // Find all artifacts affected by the old issue
    if (oldIssueId) {
      for (const [artifactId, issues] of this.artifactIssues.entries()) {
        if (issues.some(issue => issue.issueId === oldIssueId)) {
          // Find all files containing this artifact
          for (const [uriString, fileData] of this.artifactRanges.entries()) {
            if (fileData.ranges.some(r => r.artifactId === artifactId)) {
              affectedUris.add(uriString);
            }
          }
        }
      }
    }

    // Find all artifacts affected by the new issue
    if (issueId) {
      for (const [artifactId, issues] of this.artifactIssues.entries()) {
        if (issues.some(issue => issue.issueId === issueId)) {
          // Find all files containing this artifact
          for (const [uriString, fileData] of this.artifactRanges.entries()) {
            if (fileData.ranges.some(r => r.artifactId === artifactId)) {
              affectedUris.add(uriString);
            }
          }
        }
      }
    }

    // Force complete decoration refresh for affected files
    this.forceCompleteDecorationsRefresh(Array.from(affectedUris));
  }

  /**
 * Force a complete decoration refresh by disposing and recreating all decorations
 */
  private forceCompleteDecorationsRefresh(affectedUris: string[]): void {

    // Save current active editor and visible editors
    const activeEditor = vscode.window.activeTextEditor;
    const visibleEditors = vscode.window.visibleTextEditors;

    for (const [key, decorationType] of this.decorationTypes.entries()) {
      decorationType.dispose();
    }

    // Clear the decorations map
    this.decorationTypes.clear();

    // For each affected URI, find the editor and force a refresh
    for (const uriString of affectedUris) {
      // Find any editor showing this document
      const editor = visibleEditors.find(e => e.document.uri.toString() === uriString);

      if (editor) {
        // Apply decorations to this editor
        this.applyDecorationsToEditor(editor);
      }
    }

    // 4. Finally, apply decorations to all visible editors to ensure everything is updated
    setTimeout(() => {
      this.applyDecorationsToOpenEditors();
    }, 50);
  }

  /**
   * Register an artifact to be highlighted in editors
   * @param artifactId Artifact ID
   * @param fileUri File URI string
   * @param from Starting line (1-based)
   * @param to Ending line (1-based)
   * @param issueData Associated issue data with icon path
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
      title: string,
      iconPath?: string
    }
  ): void {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const uriString = uri.toString();

      // Convert 1-based line numbers to 0-based
      const startLine = Math.max(0, from - 1);
      const endLine = Math.max(0, to - 1);

      // Check if this artifact range already exists (to avoid duplicates)
      let duplicateFound = false;

      if (this.artifactRanges.has(uriString)) {
        const fileRanges = this.artifactRanges.get(uriString)!;

        // Check for existing ranges with the same artifact ID
        duplicateFound = fileRanges.ranges.some(r =>
          r.artifactId === artifactId &&
          ((r.range.start.line === startLine) || (r.range.end.line === endLine))
        );
      }

      // Only add new ranges if no duplicates were found
      if (!duplicateFound) {
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
      }

      // Associate the issue with this artifact
      if (!this.artifactIssues.has(artifactId)) {
        this.artifactIssues.set(artifactId, []);
      }

      const artifactIssues = this.artifactIssues.get(artifactId)!;

      // Check if this issue is already associated to avoid duplicates
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
 * Remove an artifact registration and immediately update any open editors
 */
  public unregisterArtifact(artifactId: string): void {
    // Remove issue associations
    this.artifactIssues.delete(artifactId);

    // Remove from last accessed tracking (if you still have this)
    if (this.lastAccessedFrom) {
      this.lastAccessedFrom.delete(artifactId);
    }

    // Find all ranges for this artifact to clear them
    const rangesToClear = new Map<string, vscode.Range[]>();

    // Find and remove all ranges for this artifact
    for (const [uriString, fileData] of this.artifactRanges.entries()) {
      // Find ranges for this artifact
      const artifactRanges = fileData.ranges
        .filter(r => r.artifactId === artifactId)
        .map(r => r.range);

      if (artifactRanges.length > 0) {
        rangesToClear.set(uriString, artifactRanges);
      }

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

    // Clear all existing decoration types to force a refresh
    for (const [key, decorationType] of this.decorationTypes.entries()) {
      // Don't dispose the empty decoration type if it exists
      if (key !== 'empty') {
        decorationType.dispose();
        this.decorationTypes.delete(key);
      }
    }

    // Create an empty decoration type if needed
    if (!this.decorationTypes.has('empty')) {
      this.decorationTypes.set('empty', vscode.window.createTextEditorDecorationType({}));
    }

    // Get the empty decoration type
    const emptyDecoration = this.decorationTypes.get('empty')!;

    // Clear all decorations from each visible editor
    for (const editor of vscode.window.visibleTextEditors) {
      const uriString = editor.document.uri.toString();

      if (rangesToClear.has(uriString)) {
        const ranges = rangesToClear.get(uriString)!;

        // First clear the specific ranges
        editor.setDecorations(emptyDecoration, ranges);

        // Then force a refresh of all decorations
        this.applyDecorationsToEditor(editor);
      }
      this.forceDecorationsRefresh();
    }

    // Finally, apply all decorations again to ensure everything is updated
    setTimeout(() => {
      this.applyDecorationsToOpenEditors();
    }, 50); // Small delay to ensure the UI has time to process the clear command
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
  /**
 * Apply decorations to all open editors
 */
  public applyDecorationsToOpenEditors(): void {
    // First clear all decorations
    this.clearAllDecorations();

    // Small delay to ensure clear operation is processed
    setTimeout(() => {
      // Then reapply all decorations
      vscode.window.visibleTextEditors.forEach(editor => {
        this.applyDecorationsToEditor(editor);
      });
    }, 10);
  }

  /**
   * Clear all decorations from all editors without removing registrations
   */
  private clearAllDecorations(): void {
    // Create an empty decoration if needed
    if (!this.decorationTypes.has('empty')) {
      this.decorationTypes.set('empty', vscode.window.createTextEditorDecorationType({}));
    }

    const emptyDecoration = this.decorationTypes.get('empty')!;

    // For each editor, clear all decorations
    for (const editor of vscode.window.visibleTextEditors) {
      const uriString = editor.document.uri.toString();

      if (this.artifactRanges.has(uriString)) {
        const allRanges = this.artifactRanges.get(uriString)!.ranges.map(r => r.range);
        editor.setDecorations(emptyDecoration, allRanges);
      }
    }
  }

  /**
 * Emergency workaround to force VS Code to refresh decorations
 */
  private forceDecorationsRefresh(): void {
    // Save the active editor
    const activeEditor = vscode.window.activeTextEditor;

    // Get all visible text editors
    const visibleEditors = [...vscode.window.visibleTextEditors];

    // Force a selection change to trigger decoration refresh
    if (activeEditor) {
      const currentSelection = activeEditor.selection;
      const tempSelection = new vscode.Selection(
        currentSelection.start,
        currentSelection.start
      );

      // Change selection then change it back
      activeEditor.selection = tempSelection;

      // After a small delay, restore the original selection
      setTimeout(() => {
        if (activeEditor === vscode.window.activeTextEditor) {
          activeEditor.selection = currentSelection;
        }
      }, 10);
    }

    // Apply decorations to each editor
    setTimeout(() => {
      for (const editor of visibleEditors) {
        this.applyDecorationsToEditor(editor);
      }
    }, 20);
  }

  private applyDecorationsToEditor(editor: vscode.TextEditor): void {
    const uriString = editor.document.uri.toString();

    // Create a set to track active artifacts for this file
    const activeArtifactsForFile = new Set<string>();

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

      // Determine if the artifact should be visible
      if (this.shouldShowArtifact(artifactId, issues)) {
        // Determine which decoration to use
        const decorationType = this.getDecorationForArtifact(artifactId, issues);

        // Apply the decoration
        editor.setDecorations(decorationType, ranges);

        // Mark this artifact as active
        activeArtifactsForFile.add(artifactId);
      } else {
        // Create an empty decoration if needed
        if (!this.decorationTypes.has('empty')) {
          this.decorationTypes.set('empty', vscode.window.createTextEditorDecorationType({}));
        }

        // Clear existing decorations
        editor.setDecorations(this.decorationTypes.get('empty')!, ranges);
      }
    }

    // Update the active artifacts for this file
    this.activeArtifacts.set(uriString, activeArtifactsForFile);
  }

  /**
   * Determines if an artifact should be visible based on rules:
   * 1. If it's associated with an open issue, always show
   * 2. If it's associated with the currently selected issue, show
   * 3. Otherwise, don't show
   */
  private shouldShowArtifact(
    artifactId: string,
    issues: Array<{
      issueId: string,
      issueType: string,
      isOpen: boolean,
      title: string,
      iconPath?: string
    }>
  ): boolean {
    if (issues.length === 0) {
      return false;
    }

    // RULE 1: If any associated issue is OPEN, always show the artifact
    const hasOpenIssue = issues.some(issue => issue.isOpen);
    if (hasOpenIssue) {
      return true;
    }

    // RULE 2: If any associated issue is the currently selected issue, show the artifact
    const isCurrentlySelected = issues.some(issue => issue.issueId === this.currentlySelectedIssueId);
    return isCurrentlySelected;
  }

  /**
 * Create or get the decoration type for an artifact
 */
  private getDecorationForArtifact(
    artifactId: string,
    issues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string, iconPath?: string }>
  ): vscode.TextEditorDecorationType {
    // Initialize icon variables with defaults
    let iconPath: string | undefined;
    let iconColor: string = 'green'; // Default to green

    // Only show count if there are ACTUALLY multiple issues
    // Use a Set to get the unique count of issue IDs
    const uniqueIssueIds = new Set(issues.map(issue => issue.issueId));
    const issueCount = uniqueIssueIds.size > 1 ? uniqueIssueIds.size : 0;

    // Prioritization logic remains the same...
    const selectedIssue = issues.find(issue => issue.issueId === this.currentlySelectedIssueId);
    if (selectedIssue) {
      iconPath = selectedIssue.iconPath;
      iconColor = selectedIssue.isOpen ? 'green' : 'red';
    }
    else {
      const openIssues = issues.filter(issue => issue.isOpen);
      if (openIssues.length > 0) {
        iconPath = openIssues[0].iconPath;
        iconColor = 'green'; // Open issues are green
      }
      else if (issues.length > 0) {
        iconPath = issues[0].iconPath;
        iconColor = issues[0].isOpen ? 'green' : 'red';
      }
    }

    // Create a unique key for the decoration type
    const decorationKey = `${artifactId}-${iconPath || 'default'}-${iconColor}-${issueCount}`;

    // Return existing decoration type if we already have one
    if (this.decorationTypes.has(decorationKey)) {
      return this.decorationTypes.get(decorationKey)!;
    }

    // Create and use an SVG icon if available, fallback to default icons otherwise
    let svgIconPath: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined;

    if (iconPath) {
      // If we have the backend SVG path, create an SVG icon
      svgIconPath = this.createInlineIconUri(iconPath, iconColor);
    } else {
      // Fallback to default icons
      const extensionPath = this.context.extensionPath;
      const defaultIconName = this.getDefaultIconName(issues[0]?.issueType || 'Bug', iconColor);
      svgIconPath = vscode.Uri.file(path.join(extensionPath, 'resources', 'icons', defaultIconName));
    }

    // Create a new decoration type
    const decorationType = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Center,
      gutterIconPath: svgIconPath,
      gutterIconSize: '100%',
      after: issueCount > 0 ? {
        contentText: ` (${issueCount})`,
        color: new vscode.ThemeColor('editorLineNumber.foreground'),
        fontStyle: 'italic'
      } : undefined,
      // We won't use isWholeLine as it might interfere with editor functionality
      isWholeLine: false
    });

    // Store the decoration type
    this.decorationTypes.set(decorationKey, decorationType);

    return decorationType;
  }

  /**
   * Creates an inline SVG URI for the icon
   * This allows us to use SVG paths from the backend
   */
  private createInlineIconUri(svgPath: string, color: string): vscode.Uri {
    // Create a cache key
    const cacheKey = `${svgPath}-${color}`;

    // Check if we have a cached version
    if (this.iconCache.has(cacheKey)) {
      return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(this.iconCache.get(cacheKey)!)}`);
    }

    // Default fill color based on state
    const fillColor = color === 'green' ? '#00BA39' : '#FF0036';

    // Create an SVG with the provided path
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="24" height="24">
        <path d="${svgPath}" fill="${fillColor}" />
      </svg>
    `;

    // Cache the SVG
    this.iconCache.set(cacheKey, svgContent);

    // Create a data URI
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`);
  }

  /**
   * Select icon path and color based on available issues
   */
  private selectIconTypeAndColor(
    openIssues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string, iconPath?: string }>,
    allIssues: Array<{ issueId: string, issueType: string, isOpen: boolean, title: string, iconPath?: string }>
  ): [string | undefined, string] {
    // Default to Bug and green if available
    let iconPath: string | undefined;
    let iconColor = 'green';

    // If there are open issues, use the first open issue's type
    if (openIssues.length > 0) {
      iconPath = openIssues[0].iconPath;
      iconColor = 'green'; // Open issues are green
    }
    // Otherwise use the first issue of any state
    else if (allIssues.length > 0) {
      iconPath = allIssues[0].iconPath;
      iconColor = allIssues[0].isOpen ? 'green' : 'red';
    }

    return [iconPath, iconColor];
  }

  /**
   * Get the default icon file name for a given type and state
   * Used as fallback when no backend icon is available
   */
  private getDefaultIconName(type: string, color: string): string {
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
 * Simulates closing and reopening editors to force decoration refresh
 * This is a public method that can be called from outside the class
 */
  public async simulateEditorReopen(affectedUris: string[]): Promise<void> {
    // Save active editor state
    const activeEditor = vscode.window.activeTextEditor;
    let activeUri: vscode.Uri | undefined;
    let activeSelection: vscode.Selection | undefined;

    if (activeEditor) {
      activeUri = activeEditor.document.uri;
      activeSelection = activeEditor.selection;
    }

    // For each affected URI, try to reload the document
    for (const uriString of affectedUris) {
      try {
        const uri = vscode.Uri.parse(uriString);

        // Find if this document is open in an editor
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uriString);

        if (editor) {
          // Get document contents and metadata
          const document = editor.document;
          const viewState = editor.viewColumn;

          // Close the document
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

          // Reopen the document
          await vscode.window.showTextDocument(uri, { viewColumn: viewState });

          // Apply decorations to the newly opened document
          this.applyDecorationsToOpenEditors();
        }
      } catch (error) {
        console.error(`[ArtifactDecoratorManager] Error simulating editor reopen for ${uriString}:`, error);
      }
    }

    // Restore active editor if possible
    if (activeUri) {
      try {
        const document = await vscode.workspace.openTextDocument(activeUri);
        const editor = await vscode.window.showTextDocument(document);

        if (activeSelection) {
          editor.selection = activeSelection;
        }
      } catch (error) {
        console.error('[ArtifactDecoratorManager] Error restoring active editor:', error);
      }
    }
  }

  /**
 * Gets all artifacts at a specific line
 */
  public getArtifactsAtLine(uriString: string, line: number): Array<{ id: string, file: string, from: number, to: number }> {
    const result: Array<{ id: string, file: string, from: number, to: number }> = [];

    if (!this.artifactRanges.has(uriString)) {
      return result;
    }

    const fileData = this.artifactRanges.get(uriString)!;

    // Find all artifacts that have ranges containing this line
    for (const rangeData of fileData.ranges) {
      const range = rangeData.range;

      // Check if this line is the start or end of the range
      if (range.start.line === line || range.end.line === line) {
        const artifactId = rangeData.artifactId;

        // Get the 1-based line numbers
        const from = range.start.line + 1;
        const to = range.end.line + 1;

        // Add to result if not already included
        if (!result.some(a => a.id === artifactId)) {
          result.push({
            id: artifactId,
            file: uriString,
            from,
            to
          });
        }
      }
    }

    return result;
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