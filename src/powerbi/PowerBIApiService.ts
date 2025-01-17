import * as vscode from 'vscode';

import { Helper, UniqueId } from '../helpers/Helper';
import { ThisExtension } from '../ThisExtension';
import { iPowerBIGroup } from './GroupsAPI/_types';
import { ApiItemType } from '../vscode/treeviews/_types';
import { iPowerBIPipeline, iPowerBIPipelineOperation, iPowerBIPipelineStage, iPowerBIPipelineStageArtifacts } from './PipelinesAPI/_types';
import { ApiUrlPair } from './_types';
import { iPowerBIDatasetExecuteQueries, iPowerBIDatasetParameter } from './DatasetsAPI/_types';
import { iPowerBICapacity } from './CapacityAPI/_types';
import { iPowerBIGateway } from './GatewayAPI/_types';


import { fetch, getProxyAgent, RequestInit, Response, File, FormData } from '@env/fetch';

export abstract class PowerBIApiService {
	private static _isInitialized: boolean = false;
	private static _connectionTestRunning: boolean = false;
	private static _apiBaseUrl: string;
	private static _tenantId: string;
	private static _clientId: string;
	private static _authenticationProvider: string;
	private static _resourceId: string;
	private static _org: string = "myorg"
	private static _headers;
	private static _vscodeSession: vscode.AuthenticationSession;

	//#region Initialization
	static async initialize(
		// Default settings will be for Azure Global
		apiBaseUrl: string = "https://api.powerbi.com/",
		tenantId: string = undefined,
		clientId: string = undefined,
		authenticationProvider: string = "microsoft",
		resourceId: string = "https://analysis.windows.net/powerbi/api"
	): Promise<boolean> {
		try {
			ThisExtension.log("Initializing PowerBI API Service ...");

			vscode.authentication.onDidChangeSessions((event) => this._onDidChangeSessions(event));

			this._apiBaseUrl = Helper.trimChar(apiBaseUrl, '/');
			this._tenantId = tenantId;
			this._clientId = clientId;
			this._authenticationProvider = authenticationProvider;
			this._resourceId = resourceId;

			await this.refreshHeaders();

			ThisExtension.log(`Testing new PowerBI API (${apiBaseUrl}) settings for user '${this.SessionUser}' (${this.SessionUserId}) ...`);
			this._connectionTestRunning = true;
			let workspaceList = await this.getGroups();
			this._connectionTestRunning = false;
			if (workspaceList.length > 0) {
				ThisExtension.log("Power BI API Service initialized!");
				this._isInitialized = true;
				return true;
			}
			else {
				ThisExtension.log(JSON.stringify(workspaceList));
				throw new Error(`Invalid Configuration for PowerBI REST API: Cannot access '${apiBaseUrl}' with given credentials'!`);
			}
		} catch (error) {
			this._connectionTestRunning = false;
			ThisExtension.log("ERROR: " + error);
			vscode.window.showErrorMessage(error);
			return false;
		}
	}

	private static async refreshHeaders(): Promise<void> {
		this._vscodeSession = await this.getAADAccessToken([`${Helper.trimChar(this._resourceId, "/")}/.default`, "profile", "email"], this._tenantId, this._clientId);

		ThisExtension.log("Refreshing authentication headers ...");
		this._headers = {
			"Authorization": 'Bearer ' + this._vscodeSession.accessToken,
			"Content-Type": 'application/json',
			"Accept": 'application/json'
		}
	}

	private static async _onDidChangeSessions(event: vscode.AuthenticationSessionsChangeEvent) {
		if (event.provider.id === this._authenticationProvider) {
			ThisExtension.log("Session for provider '" + event.provider.label + "' changed - refreshing headers! ");

			await this.refreshHeaders();
			ThisExtension.refreshUI();
		}
	}

	private static async getAADAccessToken(scopes: string[], tenantId?: string, clientId?: string): Promise<vscode.AuthenticationSession> {
		//https://www.eliostruyf.com/microsoft-authentication-provider-visual-studio-code/

		if (!scopes.includes("offline_access")) {
			scopes.push("offline_access") // Required for the refresh token.
		}

		if (tenantId) {
			scopes.push("VSCODE_TENANT:" + tenantId);
		}

		if (clientId) {
			scopes.push("VSCODE_CLIENT_ID:" + clientId);
		}

		let session: vscode.AuthenticationSession = await vscode.authentication.getSession(this._authenticationProvider, scopes);

		return session;
	}

	public static get SessionUserEmail(): string {
		return Helper.trimChar(this._vscodeSession.account.label.split("-")[1], " ");
	}

	public static get SessionUser(): string {
		return this._vscodeSession.account.label;
	}

	public static get SessionUserId(): string {
		return this._vscodeSession.account.id;
	}

	public static get Org(): string {
		return this._org;
	}

	public static get isInitialized(): boolean {
		return this._isInitialized;
	}
	//#endregion

	//#region Helpers
	private static async logResponse(response: any): Promise<void> {
		if (typeof response == "string") {
			ThisExtension.log("Response: " + response);
		}
		else {
			ThisExtension.log("Response: " + JSON.stringify(response));
		}
	}

	private static handleApiException(error: Error, showErrorMessage: boolean = false, raise: boolean = false): void {
		ThisExtension.log("ERROR: " + error.name);
		ThisExtension.log("ERROR: " + error.message);
		if (error.stack) {
			ThisExtension.log("ERROR: " + error.stack);
		}

		if (showErrorMessage) {
			vscode.window.showErrorMessage(error.message);
		}

		if (raise) {
			throw error;
		}
	}

	private static getFullUrl(endpoint: string, params?: object): string {
		if (endpoint.startsWith('/') && !endpoint.startsWith("/v1.0")) {
			endpoint = Helper.joinPath(`v1.0/${PowerBIApiService.Org}`, endpoint);
		}

		let uri = vscode.Uri.parse(`${this._apiBaseUrl}/${Helper.trimChar(endpoint, '/')}`);
		if (endpoint.startsWith("https://")) {
			uri = vscode.Uri.parse(endpoint);
		}

		if (params) {
			let urlParams = []
			for (let kvp of Object.entries(params)) {
				urlParams.push(`${kvp[0]}=${kvp[1] as number | string | boolean}`)
			}
			uri = uri.with({ query: urlParams.join('&') })
		}

		return uri.toString(true);
	}

	static async get<T = any>(endpoint: string, params: object = null, raiseError: boolean = false, raw: boolean = false): Promise<T> {
		if (!this._isInitialized && !this._connectionTestRunning) {
			ThisExtension.log("API has not yet been initialized! Please connect first!");
		}
		else {
			endpoint = this.getFullUrl(endpoint, params);
			if (params) {
				ThisExtension.log("GET " + endpoint + " --> " + JSON.stringify(params));
			}
			else {
				ThisExtension.log("GET " + endpoint);
			}

			try {
				const config: RequestInit = {
					method: "GET",
					headers: this._headers,
					agent: getProxyAgent()
				};
				let response: Response = await fetch(endpoint, config);

				let resultText = await response.text();
				await this.logResponse(resultText);
				if (response.ok) {
					if (!resultText || resultText == "") {
						return { "value": { "status": response.status, "statusText": response.statusText } } as T;
					}
					if (raw) {
						return resultText as any as T;
					}
					else {
						return JSON.parse(resultText) as T;
					}
				}
				else {
					if (!resultText || resultText == "") {
						return { "error": { "status": response.status, "statusText": response.statusText } } as T;
					}
					if (raiseError) {
						throw new Error(resultText);
					}
					else {
						return { "error": { "message": resultText, "status": response.status, "statusText": response.statusText } } as T;
					}
				}

			} catch (error) {
				this.handleApiException(error, false, raiseError);

				return undefined;
			}
		}
	}

	static async post<T = any>(endpoint: string, body: object, raiseError: boolean = false): Promise<T> {
		endpoint = this.getFullUrl(endpoint);
		ThisExtension.log("POST " + endpoint + " --> " + (JSON.stringify(body) ?? "{}"));

		try {
			const config: RequestInit = {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify(body),
				agent: getProxyAgent()
			};
			let response: Response = await fetch(endpoint, config);

			let resultText = await response.text();
			await this.logResponse(resultText);
			if (response.ok) {
				if (!resultText || resultText == "") {
					return { "value": { "status": response.status, "statusText": response.statusText } } as T;
				}
				return JSON.parse(resultText) as T;
			}
			else {
				if (!resultText || resultText == "") {
					return { "error": { "status": response.status, "statusText": response.statusText } } as T;
				}
				if (raiseError) {
					throw new Error(resultText);
				}
				else {
					return { "error": { "message": resultText, "status": response.status, "statusText": response.statusText } } as T;
				}
			}
		} catch (error) {
			this.handleApiException(error, false, raiseError);

			return undefined;
		}
	}


	static async postFile(endpoint: string, uri: vscode.Uri, raiseError: boolean = false): Promise<any> {
		/*
		endpoint = this.getFullUrl(endpoint);
		ThisExtension.log("POST " + endpoint + " --> (File)" + uri);

		try {
			let data: FormData = new FormData();
			data.append('file', uri.fsPath, uri.path.split('/').pop());

			const formData = new FormData()
			const binary = await vscode.workspace.fs.readFile(uri);
			const uploadFile = new File([binary], uri.path.split('/').pop(), { type: "multipart/form-data" })

			//formData.append('file-upload', uploadFile, uploadFile.name);

			let headers = this._headers;
			delete headers["Content-Type"];

			const config: RequestInit = {
				method: "POST",
				headers: headers,
				body: data,
				agent: getProxyAgent()
			};
			let response: Response = await fetch(endpoint, config);

			let resultText = await response.text();
			await this.logResponse(resultText);
			if (response.ok) {
				if (!resultText || resultText == "") {
					return { "value": { "status": response.status, "statusText": response.statusText } };
				}
				return JSON.parse(resultText);
			}
			else {
				if (!resultText || resultText == "") {
					return { "error": { "status": response.status, "statusText": response.statusText } };
				}
				throw new Error(resultText);
			}
		} catch (error) {
			this.handleApiException(error, false, raiseError);

			return undefined;
		}
		*/
	}

	static async put<T = any>(endpoint: string, body: object, raiseError: boolean = false): Promise<T> {
		endpoint = this.getFullUrl(endpoint);
		ThisExtension.log("PUT " + endpoint + " --> " + (JSON.stringify(body) ?? "{}"));

		try {
			const config: RequestInit = {
				method: "PUT",
				headers: this._headers,
				body: JSON.stringify(body),
				agent: getProxyAgent()
			};
			let response: Response = await fetch(endpoint, config);

			let resultText = await response.text();
			await this.logResponse(resultText);
			if (response.ok) {
				if (!resultText || resultText == "") {
					return { "value": { "status": response.status, "statusText": response.statusText } } as T;
				}
				return JSON.parse(resultText) as T;
			}
			else {
				if (!resultText || resultText == "") {
					return { "error": { "status": response.status, "statusText": response.statusText } } as T;
				}
				if (raiseError) {
					throw new Error(resultText);
				}
				else {
					return { "error": { "message": resultText, "status": response.status, "statusText": response.statusText } } as T;
				}
			}
		} catch (error) {
			this.handleApiException(error, false, raiseError);

			return undefined;
		}
	}

	static async patch<T = any>(endpoint: string, body: object, raiseError: boolean = false): Promise<T> {
		endpoint = this.getFullUrl(endpoint);
		ThisExtension.log("PATCH " + endpoint + " --> " + (JSON.stringify(body) ?? "{}"));

		try {
			const config: RequestInit = {
				method: "PATCH",
				headers: this._headers,
				body: JSON.stringify(body),
				agent: getProxyAgent()
			};
			let response: Response = await fetch(endpoint, config);

			let resultText = await response.text();
			await this.logResponse(resultText);
			if (response.ok) {
				if (!resultText || resultText == "") {
					return { "value": { "status": response.status, "statusText": response.statusText } } as T;
				}
				return JSON.parse(resultText) as T;
			}
			else {
				if (!resultText || resultText == "") {
					return { "error": { "status": response.status, "statusText": response.statusText } } as T;
				}
				if (raiseError) {
					throw new Error(resultText);
				}
				else {
					return { "error": { "message": resultText, "status": response.status, "statusText": response.statusText } } as T;
				}
			}
		} catch (error) {
			this.handleApiException(error, false, raiseError);

			return undefined;
		}
	}

	static async delete<T = any>(endpoint: string, body: object, raiseError: boolean = false): Promise<T> {
		endpoint = this.getFullUrl(endpoint);
		ThisExtension.log("DELETE " + endpoint + " --> " + (JSON.stringify(body) ?? "{}"));

		try {
			const config: RequestInit = {
				method: "DELETE",
				headers: this._headers,
				body: JSON.stringify(body),
				agent: getProxyAgent()
			};
			let response: Response = await fetch(endpoint, config);

			let resultText = await response.text();
			await this.logResponse(resultText);
			if (response.ok) {
				if (!resultText || resultText == "") {
					return undefined;
				}
				return JSON.parse(resultText) as T;
			}
			else {
				if (!resultText || resultText == "") {
					return { "error": { "status": response.status, "statusText": response.statusText } } as T;
				}
				if (raiseError) {
					throw new Error(resultText);
				}
				else {
					return { "error": { "message": resultText, "status": response.status, "statusText": response.statusText } } as T;
				}
			}
		} catch (error) {
			this.handleApiException(error, false, raiseError);

			return undefined;
		}
	}

	private static getUrl(groupId: string | UniqueId = undefined, itemType: ApiItemType = undefined): string {
		let group: string = "";
		if (groupId != null && groupId != undefined) {
			group = `/groups/${groupId.toString()}`;
		}

		let type = "";
		if (itemType != null && itemType != undefined) {
			type = `/${itemType.toString().toLowerCase()}`;
		}

		return `v1.0/${this.Org}${group}${type}`;
	}

	static getUrl2(apiItems: ApiUrlPair[]): string {
		let urlParts: string[] = [];

		for (let apiItem of apiItems) {
			if (apiItem.itemType == "GROUP" && !apiItem.itemId) {
				// skip GROUP item if no ID is specified -> use personal workspace
				continue;
			}
			urlParts.push(apiItem.itemType.toLowerCase());
			if (apiItem.itemId) {
				// can be empty, e.g. if we want to list all datasets of a workspace, we do not have a datasetId 
				urlParts.push(apiItem.itemId.toString())
			}
		}

		return `v1.0/${this.Org}/${urlParts.join("/")}`;
	}

	// legacy, should not be used anymore -> please use getItemList instead!
	static async getWorkspaceItemList<T>(groupId: string | UniqueId = undefined, itemType: ApiItemType = undefined, sortBy: string = "name"): Promise<T[]> {
		let endpoint = this.getUrl(groupId, itemType);

		let body = {};

		let response = await this.get(endpoint, { params: body });

		let result = response.data;
		let items = result.value as T[];

		if (items == undefined) {
			return [];
		}
		Helper.sortArrayByProperty(items, sortBy);
		return items;
	}

	static async getItemList<T>(endpoint: string, body: any = {}, sortBy: string = "name"): Promise<T[]> {
		let response = await this.get(endpoint, body);

		let items = response.value as T[];

		if (items == undefined) {
			return [];
		}
		if (sortBy) {
			Helper.sortArrayByProperty(items, sortBy);
		}
		return items;
	}

	static async getItemList2<T>(
		items: ApiUrlPair[],
		sortBy: string = "name"): Promise<T[]> {

		let endpoint = this.getUrl2(items);

		let body = {};

		let response = await this.get(endpoint, { params: body });

		let listItems = response.value as T[];

		if (items == undefined) {
			return [];
		}
		Helper.sortArrayByProperty(listItems, sortBy);
		return listItems;
	}
	//#endregion

	//#region Groups/Workspaces API
	static async getGroups(): Promise<iPowerBIGroup[]> {
		let items: iPowerBIGroup[] = await this.getItemList<iPowerBIGroup>(`v1.0/${PowerBIApiService.Org}/groups`);

		return items;
	}


	//#endregion

	//#region Datasets API
	static async getDatasetParameters(groupId: string | UniqueId, datasetId: string | UniqueId): Promise<iPowerBIDatasetParameter[]> {
		let items: iPowerBIDatasetParameter[] = await this.getItemList2<iPowerBIDatasetParameter>([
			{ itemType: "GROUPS", itemId: groupId },
			{ itemType: "DATASETS", itemId: datasetId },
			{ itemType: "DATASETPARAMETERS" }
		]);

		return items;
	}

	static async executeQueries(apiPath, daxQuery: string): Promise<iPowerBIDatasetExecuteQueries> {
		let endpoint: string = apiPath + "/executeQueries";

		try {
			let body: any = {
				queries: [
					{
						query: daxQuery
					}
				]
			}

			let result: iPowerBIDatasetExecuteQueries = await this.post<iPowerBIDatasetExecuteQueries>(endpoint, body);

			return result;
		} catch (error) {
			this.handleApiException(error);

			return undefined;
		}
	}
	//#endregion

	//#region Reports API
	//#endregion

	//#region Dashboards API
	//#endregion

	//#region Dataflows API
	//#endregion


	//#region Capacities API
	static async getCapacities(): Promise<iPowerBICapacity[]> {

		let items: iPowerBICapacity[] = await this.getItemList<iPowerBICapacity>(`v1.0/${PowerBIApiService.Org}/capacities`, {}, "displayName");

		return items;
	}


	//#endregion


	//#region Gateways API
	static async getGateways(): Promise<iPowerBIGateway[]> {
		let items: iPowerBIGateway[] = await this.getItemList<iPowerBIGateway>(`v1.0/${PowerBIApiService.Org}/gateways`);

		return items;
	}


	//#endregion


	//#region Pipelines API
	static async getPipelines(): Promise<iPowerBIPipeline[]> {
		let items: iPowerBIPipeline[] = await this.getItemList<iPowerBIPipeline>(`v1.0/${PowerBIApiService.Org}/pipelines`, undefined, "displayName");

		return items;
	}

	static async getPipelineStages(pipelineId: string | UniqueId): Promise<iPowerBIPipelineStage[]> {
		let jsonResult = await this.get(`v1.0/${this.Org}/pipelines/${pipelineId}/stages`);
		let items: iPowerBIPipelineStage[] = jsonResult.value;

		return items;
	}

	static async getPipelineOperations(pipelineId: string | UniqueId): Promise<iPowerBIPipelineOperation[]> {
		let jsonResult = await this.get(`v1.0/${this.Org}/pipelines/${pipelineId}/operations`);
		let items: iPowerBIPipelineOperation[] = jsonResult.value;

		return items;
	}

	static async getPipelineStageArtifacts(pipelineId: string | UniqueId, order: number): Promise<iPowerBIPipelineStageArtifacts> {
		let jsonResult = await this.get<iPowerBIPipelineStageArtifacts>(`v1.0/${this.Org}/pipelines/${pipelineId}/stages/${order}/artifacts`);

		return jsonResult;
	}
	//#endregion
}
