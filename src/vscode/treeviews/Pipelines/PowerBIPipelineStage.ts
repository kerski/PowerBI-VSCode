import * as vscode from 'vscode';


import { Helper, UniqueId } from '../../../helpers/Helper';
import { iPowerBIPipelineStage, iPowerBIPipelineStageArtifacts, resolveOrder, resolveOrderShort } from '../../../powerbi/PipelinesAPI/_types';
import { ThisExtension } from '../../../ThisExtension';
import { PowerBIPipelineTreeItem } from './PowerBIPipelineTreeItem';
import { PowerBIApiService } from '../../../powerbi/PowerBIApiService';
import { PowerBICommandBuilder, PowerBICommandInput } from '../../../powerbi/CommandBuilder';
import { PowerBIPipelineStageArtifact } from './PowerBIPipelineStageArtifact';
import { PowerBIPipelineStageArtifacts } from './PowerBIPipelineStageArtifacts';
import { ArtifactType } from '../../../powerbi/SwaggerAPI';
import { PowerBIPipeline } from './PowerBIPipeline';

// https://vshaxe.github.io/vscode-extern/vscode/TreeItem.html
export class PowerBIPipelineStage extends PowerBIPipelineTreeItem {

	constructor(
		definition: iPowerBIPipelineStage,
		pipelineId: UniqueId,
		parent: PowerBIPipelineTreeItem
	) {
		super(definition.order.toString(), "PIPELINESTAGE", pipelineId, parent, vscode.TreeItemCollapsibleState.Collapsed);

		this.definition = definition;
		super.label = this._Label;
		super.id = definition.order.toString() + "/" + definition.workspaceId;

		super.tooltip = this._tooltip;
		super.description = null;

		super.iconPath = {
			light: this.getIconPath("light"),
			dark: this.getIconPath("dark")
		};
		super.contextValue = this._contextValue;
	}

	protected getIconPath(theme: string): vscode.Uri {
		let stage: string = `_${resolveOrderShort(this.definition.order)}`;

		return vscode.Uri.joinPath(ThisExtension.rootUri, 'resources', theme, this.itemType.toLowerCase() + stage + '.png');
	}

	/* Overwritten properties from PowerBIApiTreeItem */
	get _Label(): string {
		let ret: string = resolveOrder(this.definition.order);

		return ret + ": " + this.definition.workspaceName;
	}

	get _contextValue(): string {
		let orig: string = super._contextValue;

		let actions: string[] = [
			"DELETE"
		];

		if (this.definition.order <= 1) {
			actions.push("DEPLOY");
		}

		if (this.definition.workspaceId) {
			actions.push("UNASSIGN");
		}
		else
		{
			actions.push("ASSIGN");
		}

		return orig + actions.join(",") + ",";
	}

	get definition(): iPowerBIPipelineStage {
		return super.definition as iPowerBIPipelineStage;
	}

	set definition(value: iPowerBIPipelineStage) {
		super.definition = value;
	}

	get apiUrlPart(): string {
		return this.definition.order.toString();
	}

	async getChildren(element?: PowerBIPipelineTreeItem): Promise<PowerBIPipelineTreeItem[]> {
		PowerBICommandBuilder.pushQuickPickItem(this);

		let children: PowerBIPipelineTreeItem[] = [];
		let artifacts: iPowerBIPipelineStageArtifacts = await PowerBIApiService.getPipelineStageArtifacts(this.getParentByType<PowerBIPipeline>("PIPELINE").uid, this.definition.order);

		if (artifacts.dashboards.length > 0) {
			children.push(new PowerBIPipelineStageArtifacts(this.uid, this.definition.order, "PIPELINESTAGEDASHBOARDS", artifacts.dashboards, this));
		}
		if (artifacts.dataflows.length > 0) {
			children.push(new PowerBIPipelineStageArtifacts(this.uid, this.definition.order, "PIPELINESTAGEDATAFLOWS", artifacts.dataflows, this));
		}
		if (artifacts.datamarts.length > 0) {
			children.push(new PowerBIPipelineStageArtifacts(this.uid, this.definition.order, "PIPELINESTAGEDATAMARTS", artifacts.datamarts, this));
		}
		if (artifacts.datasets.length > 0) {
			children.push(new PowerBIPipelineStageArtifacts(this.uid, this.definition.order, "PIPELINESTAGEDATASETS", artifacts.datasets, this));
		}
		if (artifacts.reports.length > 0) {
			children.push(new PowerBIPipelineStageArtifacts(this.uid, this.definition.order, "PIPELINESTAGEREPORTS", artifacts.reports, this));
		}

		return children;
	}

	// Pipelinestage-specific funtions
	public static async deployToNextStage(stage: PowerBIPipelineStage, settings: object = undefined): Promise<void> {
		const apiUrl =  Helper.joinPath(stage.getParentByType("PIPELINE").apiPath, "deployAll");

		const body = {
			"sourceStageOrder": stage.definition.order,
			"options": {
				"allowCreateArtifact": true,
				"allowOverwriteArtifact": true,
				"allowOverwriteTargetArtifactLabel": true,
				"allowPurgeData": true,
				"allowSkipTilesWithMissingPrerequisites": true,
				"allowTakeOver": true
			}
		}
		PowerBIApiService.post(apiUrl, body);

		ThisExtension.TreeViewPipelines.refresh(stage.parent, false);
	}

	public static async assignWorkspace(stage: PowerBIPipelineStage, settings: object = undefined): Promise<void> {
		const apiUrl = Helper.joinPath(stage.apiPath, "assignWorkspace");
		if (settings == undefined) // prompt user for inputs
		{
			PowerBICommandBuilder.execute<any>(apiUrl, "POST",
				[
					new PowerBICommandInput("Workspace", "WORKSPACE_SELECTOR", "workspaceId", false, "The workspace ID.")
				]);
		}
		else {
			PowerBIApiService.post(apiUrl, settings);
		}

		ThisExtension.TreeViewPipelines.refresh(stage.parent, false);
	}

	public static async unassignWorkspace(stage: PowerBIPipelineStage): Promise<void> {
		const apiUrl =  Helper.joinPath(stage.apiPath, "unassignWorkspace");

		PowerBIApiService.post(apiUrl, null);

		ThisExtension.TreeViewPipelines.refresh(stage.parent, false);
	}
}