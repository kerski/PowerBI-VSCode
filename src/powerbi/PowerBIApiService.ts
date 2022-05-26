import * as vscode from 'vscode';
import * as fs from 'fs';

import { Helper } from '../helpers/Helper';
import { ThisExtension } from '../ThisExtension';
import { iPowerBIWorkspaceItem } from '../vscode/treeviews/workspaces/iPowerBIWorkspaceItem';
import { iPowerBIGroup } from './GroupsAPI/_types';
import { iPowerBIDataset } from './DatasetsAPI/_types';


export abstract class PowerBIApiService {
	private static _apiService: any;
	private static _isInitialized: boolean = false;
	private static _connectionTestRunning: boolean = false;
	
	//#region Initialization
	static async initialize(apiRootUrl: string = "https://api.powerbi.com/"): Promise<boolean> {
		try {
			ThisExtension.log("Initializing PowerBI API Service ...");
			const axios = require('axios');
			const httpsAgent = require('https-agent');

			// Set config defaults when creating the instance
			this._apiService = axios.create({
				httpsAgent: new httpsAgent({  
					rejectUnauthorized: ThisExtension.rejectUnauthorizedSSL
				}),
				baseURL: Helper.trimChar(apiRootUrl, '/') + '/',
				proxy: ThisExtension.useProxy
			});

			// https://github.com/microsoft/vscode-azure-account/blob/main/sample/src/extension.ts

			const { useIdentityPlugin, VisualStudioCodeCredential } = require("@azure/identity");

			// The plugin is the package's default export, so you may import and use it
			// as any name you like, and simply pass it to `useIdentityPlugin`.
			const { vsCodePlugin } = require("@azure/identity-vscode");

			useIdentityPlugin(vsCodePlugin);

			let credential = new VisualStudioCodeCredential();

			let accessToken = await credential.getToken("https://analysis.windows.net/powerbi/api/.default");
			
			this._apiService.defaults.headers.common['Authorization'] = "Bearer " + accessToken.token;
			this._apiService.defaults.headers.common['Content-Type'] = 'application/json';
			this._apiService.defaults.headers.common['Accept'] = 'application/json';

			ThisExtension.log(`Testing new PowerBI API (${apiRootUrl}) settings ()...`);
			this._connectionTestRunning = true;
			let workspaceList = await this.getGroups();
			this._connectionTestRunning = false;
			if (workspaceList.length > 0) {
				ThisExtension.log("PowerBI API Service initialized!");
				this._isInitialized = true;
				return true;
			}
			else {
				ThisExtension.log(JSON.stringify(workspaceList));
				throw new Error(`Invalid Configuration for PowerBI REST API: Cannot access '${apiRootUrl}' with given credentials'!`);
			}
		} catch (error) {
			this._connectionTestRunning = false;
			ThisExtension.log("ERROR: " + error);
			vscode.window.showErrorMessage(error);
			return false;
		}
	}

	public static get isInitialized(): boolean {
		return this._isInitialized;
	}
	//#endregion

	//#region Helpers
	private static logResponse(response: any): void {
		ThisExtension.log("Response: ");
		ThisExtension.log(JSON.stringify(response.data));
	}

	private static async get(endpoint: string, params: object = null): Promise<any> {
		if (!this._isInitialized && !this._connectionTestRunning) {
			ThisExtension.log("API has not yet been initialized! Please connect first!");
		}
		else {
			ThisExtension.log("GET " + endpoint);
			ThisExtension.log("Params:" + JSON.stringify(params));

			let response: any = "Request not yet executed!";
			try {
				response = await this._apiService.get(endpoint, params);
				this.logResponse(response);
			} catch (error) {
				let errResponse = error.response;

				let errorMessage = errResponse.data.message;
				if (!errorMessage) {
					errorMessage = errResponse.headers["x-powerbi-reason-phrase"];
				}

				ThisExtension.log("ERROR: " + error.message);
				ThisExtension.log("ERROR: " + errorMessage);
				ThisExtension.log("ERROR: " + JSON.stringify(errResponse.data));

				vscode.window.showErrorMessage(errorMessage);

				return undefined;
			}

			return response;
		}
	}

	private static async post(endpoint: string, body: object): Promise<any> {
		ThisExtension.log("POST " + endpoint);
		ThisExtension.log("Body:" + JSON.stringify(body));

		let response: any = "Request not yet executed!";
		try {
			response = await this._apiService.post(endpoint, body);
			this.logResponse(response);
		} catch (error) {
			let errResponse = error.response;

			let errorMessage = errResponse.data.message;
			if (!errorMessage) {
				errorMessage = errResponse.headers["x-powerbi-reason-phrase"];
			}

			ThisExtension.log("ERROR: " + error.message);
			ThisExtension.log("ERROR: " + errorMessage);
			ThisExtension.log("ERROR: " + JSON.stringify(errResponse.data));

			vscode.window.showErrorMessage(errorMessage);

			return undefined;
		}

		return response;
	}

	private static async patch(endpoint: string, body: object): Promise<any> {
		ThisExtension.log("PATCH " + endpoint);
		ThisExtension.log("Body:" + JSON.stringify(body));

		let response: any = "Request not yet executed!";
		try {
			response = await this._apiService.patch(endpoint, body);
			this.logResponse(response);
		} catch (error) {
			let errResponse = error.response;

			let errorMessage = errResponse.data.message;
			if (!errorMessage) {
				errorMessage = errResponse.headers["x-powerbi-reason-phrase"];
			}

			ThisExtension.log("ERROR: " + error.message);
			ThisExtension.log("ERROR: " + errorMessage);
			ThisExtension.log("ERROR: " + JSON.stringify(errResponse.data));

			vscode.window.showErrorMessage(errorMessage);

			return undefined;
		}

		return response;
	}

	private static async delete(endpoint: string, body: object): Promise<any> {
		ThisExtension.log("DELETE " + endpoint);
		ThisExtension.log("Body:" + JSON.stringify(body));

		let response: any = "Request not yet executed!";
		try {
			response = await this._apiService.delete(endpoint, body);
			this.logResponse(response);
		} catch (error) {
			let errResponse = error.response;

			let errorMessage = errResponse.data.message;
			if (!errorMessage) {
				errorMessage = errResponse.headers["x-powerbi-reason-phrase"];
			}

			ThisExtension.log("ERROR: " + error.message);
			ThisExtension.log("ERROR: " + errorMessage);
			ThisExtension.log("ERROR: " + JSON.stringify(errResponse.data));

			vscode.window.showErrorMessage(errorMessage);

			return undefined;
		}

		return response;
	}
	//#endregion

	//#region Groups/Workspaces API
	static async getGroups(): Promise<iPowerBIGroup[]> {
		let endpoint = 'v1.0/myorg/groups';
		let body = { };

		let response = await this.get(endpoint, { params: body });

		let result = response.data;
		let items = result.value as iPowerBIGroup[];

		if (items == undefined) {
			return [];
		}
		Helper.sortArrayByProperty(items, "name");
		return items;
	}
	//#endregion

	//#region Datasets API
	static async getDatasets(groupId: string = undefined): Promise<iPowerBIDataset[]> {
		let endpoint = 'v1.0/myorg/datasets';
		if(!(groupId == undefined || groupId == null))
		{
			endpoint = `v1.0/myorg/groups/${groupId}/datasets`;
		}
		
		let body = { };

		let response = await this.get(endpoint, { params: body });

		let result = response.data;
		let items = result.value as iPowerBIDataset[];

		if (items == undefined) {
			return [];
		}
		Helper.sortArrayByProperty(items, "name");
		return items;
	}
	//#endregion
}