import { json } from 'stream/consumers';
import * as vscode from 'vscode';

export class MappingToGropius {

    workspaceFolders;
    finalJsonFile!: { components: [JSON]; relations: [JSON]; issueRelations: [JSON]; };

    constructor(

    ) {
        this.workspaceFolders = vscode.workspace.workspaceFolders;

    }

    async runMapping(): Promise<void> {
        /*
        Debugging: Founded files in Workspace.
        */
        if (this.workspaceFolders){
            this.workspaceFolders.forEach(folder => {
                vscode.window.showInformationMessage(`Workspace ${folder.uri.fsPath}`);
            });
        } else {
            console.log("Something went wrong! There is no workspace available.");
        }
        
        const configFiles = await this.findGropiusfiles();

        for (const file of configFiles) {
            try{
                const nextFile = await vscode.workspace.fs.readFile(file);
                this.filterGropiusConfig(JSON.parse(nextFile.toString()));
                

            } catch (error) {
                console.error(`It wasn´t possible to read file ${file.fsPath} :`, error);
            }
        }


    }

    /*
    TODO: Richtiges File Format für die Gropius files oder config files oder wie auch immer.
    Description: Extracts all gropius config files in the workspace.
    */

    private async findGropiusfiles(): Promise<vscode.Uri[]> {

        // Searches for all gropius files
        const configFiles = await vscode.workspace.findFiles('**//*.json');

        return configFiles;
    }

    /*
    Gets a gropius config file and returns the essential areas of the file.
    */

    private filterGropiusConfig (file: any) {

        const components = file.components ?? [];
        const relations = file.relations ?? [];
        const issueRelations = file.issueRelations ?? [];

        this.finalJsonFile.components.push(components);
        this.finalJsonFile.relations.push(relations);
        this.finalJsonFile.relations.push(issueRelations);

    }
}