import * as vscode from 'vscode';

import { iPowerBICapacityItem } from './iPowerBICapacityItem';
import { ApiItemType } from '../_types';
import { PowerBIApiTreeItem } from '../PowerBIApiTreeItem';
import { iPowerBICapacity } from '../../../powerbi/CapacityAPI/_types';
import { TreeProviderId } from '../../../ThisExtension';
import { UniqueId } from '../../../helpers/Helper';

export class PowerBICapacityTreeItem extends PowerBIApiTreeItem implements iPowerBICapacityItem {
	protected _capacity: iPowerBICapacity;

	constructor(
		id: string | UniqueId,
		name: string,
		itemType: ApiItemType,
		capacity: iPowerBICapacity,
		parent: PowerBIApiTreeItem,
		collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
	) {
		super(id, name, itemType, parent, collapsibleState);

		this._capacity = capacity;
		
		super.tooltip = this._tooltip;
		super.description = this._description;
		super.contextValue = this._contextValue;

		super.iconPath = {
			light: this.getIconPath("light"),
			dark: this.getIconPath("dark")
		};
	}

	get TreeProvider(): TreeProviderId {
		return "application/vnd.code.tree.powerbicapacities";
	}

	public async getChildren(element?: PowerBICapacityTreeItem): Promise<PowerBICapacityTreeItem[]> {
		await vscode.window.showErrorMessage("getChildren is not implemented! Please overwrite in derived class!");
		return undefined;
	}

	/* Overwritten properties from PowerBIApiTreeItem */
	get parent(): PowerBICapacityTreeItem {
		return this._parent as PowerBICapacityTreeItem;
	}

	/* iPowerBICapacityItem implementation */
	get capacity(): iPowerBICapacity {
		return this._capacity;
	}
}
