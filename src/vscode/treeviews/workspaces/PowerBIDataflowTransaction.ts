import * as vscode from 'vscode';

import { PowerBIWorkspaceTreeItem } from './PowerBIWorkspaceTreeItem';
import { iPowerBIDatasetParameter, iPowerBIDatasetRefresh } from '../../../powerbi/DatasetsAPI/_types';
import { Helper, UniqueId } from '../../../helpers/Helper';
import { PowerBICommandBuilder, PowerBIQuickPickItem } from '../../../powerbi/CommandBuilder';
import { ThisExtension } from '../../../ThisExtension';
import { PowerBIApiService } from '../../../powerbi/PowerBIApiService';
import { PowerBIDataset } from './PowerBIDataset';
import { PowerBIDatasetRefreshes } from './PowerBIDatasetRefreshes';
import { iPowerBIDataflowTransaction } from '../../../powerbi/DataflowsAPI/_types';
import { PowerBIDataflowTransactions } from './PowerBIDataflowTransactions';
import { PowerBIDataflow } from './PowerBIDataflow';

// https://vshaxe.github.io/vscode-extern/vscode/TreeItem.html
export class PowerBIDataflowTransaction extends PowerBIWorkspaceTreeItem {

	constructor(
		definition: iPowerBIDataflowTransaction,
		group: UniqueId,
		parent: PowerBIDataflowTransactions
	) {
		super(definition.id, group, "TRANSACTION", definition.id, parent, vscode.TreeItemCollapsibleState.None);

		this.definition = definition;

		super.id = definition.id;
		super.label = this._label;
		super.description = this._description;
		super.tooltip = this._tooltip;
		super.contextValue = this._contextValue;
		super.iconPath = {
			light: this.getIconPath("light"),
			dark: this.getIconPath("dark")
		};
	}

	get _label(): string {
		let dateToShow: Date = this.definition.startTime;

		return `${new Date(dateToShow).toISOString().substr(0, 19).replace('T', ' ')}`;
	}

	// description is show next to the label
	get _description(): string {
		return this.definition.status + " - " + this.definition.refreshType;
	}

	protected getIconPath(theme: string): vscode.Uri {
		let status: string = this.definition.status;

		return vscode.Uri.joinPath(ThisExtension.rootUri, 'resources', theme, status + '.png');
	}

	/* Overwritten properties from PowerBIApiTreeItem */
	get _contextValue(): string {
		let orig: string = super._contextValue;

		let actions: string[] = []

		if(this.definition.status == "Unknown")
		{
			actions.push("CANCEL")
		}

		return orig + actions.join(",") + ",";
	}
	get definition(): iPowerBIDataflowTransaction {
		return super.definition as iPowerBIDataflowTransaction;
	}

	private set definition(value: iPowerBIDataflowTransaction) {
		super.definition = value;
	}

	get dataflow(): PowerBIDataflow {
		return (this.parent as PowerBIDataflowTransactions).dataflow;
	}

	// Parameter-specific funtions
	public async cancel(): Promise<void> {
		ThisExtension.setStatusBar("Cancelling dataflow-refresh ...", true);
		PowerBIApiService.post(this.apiPath + "/cancel", null);
		ThisExtension.setStatusBar("Dataflow-refresh cancelled!");
	}
}