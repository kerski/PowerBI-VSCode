import * as vscode from 'vscode';
import { Helper } from '../../helpers/Helper';

export class PowerBINotebookContext {
	apiRootPath: string;
	uri: vscode.Uri;
	private variables: { [key: string]: string } = {};

	constructor(apiRootPath: string) {
		this.apiRootPath = apiRootPath;
	}

	public setVariable(name: string, value: string): void {
		if (["DATASET", "DATASET_PATH", "API_ROOT_PATH"].includes(name.toUpperCase())) {
			this.apiRootPath = value;
		}
		else {
			this.variables[name.toUpperCase()] = value;
		}
	}

	public getVariable(name: string): string {
		if (["DATASET", "DATASET_PATH", "API_ROOT_PATH"].includes(name.toUpperCase())) {
			return this.apiRootPath;
		}
		return this.variables[name.toUpperCase()];
	}

	//#region static methods to track the context of the notebook
	private static _context: Map<string, PowerBINotebookContext> = new Map<string, PowerBINotebookContext>();


	static loadFromMetadata(metadata?: { [key: string]: any }): { [key: string]: any } {

		if (metadata == undefined) {
			metadata = {};
		}
		let newContext: PowerBINotebookContext = PowerBINotebookContext.generateFromOriginalMetadata(metadata);
		let guid = Helper.newGuid(); // we always generate a new guid for the current session

		PowerBINotebookContext.set(guid, newContext);

		metadata.guid = guid;
		// remove context so it is not used unintentionally
		metadata.context = undefined;

		// we only return the guid as metadata
		return metadata;
	}

	static saveToMetadata(metadata: { [key: string]: any }): { [key: string]: any } {
		if (metadata?.guid) {
			metadata.context = PowerBINotebookContext.get(metadata.guid);
			metadata.guid = undefined;
		}

		// we only return the context as metadata
		return metadata;
	}

	static generateFromOriginalMetadata(metadata?: { [key: string]: any }): PowerBINotebookContext {
		let newContext = new PowerBINotebookContext('/');

		if (metadata?.context) {
			if (metadata.context.apiRootPath) {
				newContext.apiRootPath = metadata.context.apiRootPath;
			}
			if (metadata.context.uri) {
				newContext.uri = metadata.context.uri;
			}
			if (metadata.context.variables) {
				newContext.variables = metadata.context.variables;
			}
		}

		return newContext;
	}

	static set(guid: string, context: PowerBINotebookContext): void {
		PowerBINotebookContext._context[guid] = context;
	}

	static get(guid: string): PowerBINotebookContext {
		return PowerBINotebookContext._context[guid];
	}
	//#endregion
}