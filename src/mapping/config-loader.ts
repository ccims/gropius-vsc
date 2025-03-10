import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'; 

// Interfaces for our configuration
interface GropiusWorkspaceConfig {
  version: string;
  rootFolders: {
    name: string;
    configPath: string;
  }[];
}

interface GropiusMapping {
  path: string;
  componentVersion?: string;
  project?: string;
  component?: string;
}

interface GropiusFolderConfig {
  mappings: GropiusMapping[];
}

// Function to find and load configuration files
async function loadConfigurations(): Promise<Map<string, GropiusMapping[]>> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return new Map();
  }

  const mappings = new Map<string, GropiusMapping[]>();
  
  // Try to load workspace config if it exists
  const workspaceConfig = await loadWorkspaceConfig(workspaceFolders[0].uri.fsPath);
  
  if (workspaceConfig) {
    // Load configs from paths specified in workspace config
    for (const folder of workspaceConfig.rootFolders) {
      const configPath = path.resolve(workspaceFolders[0].uri.fsPath, folder.configPath);
      try {
        const folderConfig = await loadFolderConfig(configPath);
        if (folderConfig) {
          const rootPath = path.dirname(configPath);
          mappings.set(rootPath, folderConfig.mappings);
        }
      } catch (error) {
        console.error(`Error loading config for ${folder.name}:`, error);
      }
    }
  } else {
    // No workspace config, look for .gropius.yaml in each workspace folder
    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, '.gropius.yaml');
      try {
        const folderConfig = await loadFolderConfig(configPath);
        if (folderConfig) {
          mappings.set(folder.uri.fsPath, folderConfig.mappings);
        }
      } catch (error) {
        console.error(`Error loading config for ${folder.name}:`, error);
      }
    }
  }
  
  return mappings;
}

async function loadWorkspaceConfig(workspacePath: string): Promise<GropiusWorkspaceConfig | null> {
  const configPath = path.join(workspacePath, '.gropius-workspace.yaml');
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return yaml.load(content) as GropiusWorkspaceConfig;
    }
  } catch (error) {
    console.error('Error loading workspace config:', error);
  }
  
  return null;
}

async function loadFolderConfig(configPath: string): Promise<GropiusFolderConfig | null> {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return yaml.load(content) as GropiusFolderConfig;
    }
  } catch (error) {
    console.error(`Error loading folder config at ${configPath}:`, error);
  }
  
  return null;
}