import * as vscode from 'vscode';
import * as fspath from 'path';
import { WorkspaceItemType } from './_types';
import { iPowerBIWorkspaceItem } from './iPowerBIWorkspaceItem';
import { ThisExtension } from '../../../ThisExtension';
import { unique_id } from '../../../helpers/Helper';

export class PowerBIWorkspaceTreeItem extends vscode.TreeItem implements iPowerBIWorkspaceItem {
	protected _name: string;
	protected _group: string;
	protected _item_type: WorkspaceItemType;
	protected _id: unique_id;

	constructor(
		name: string,
		group: string,
		item_type: WorkspaceItemType,
		id: unique_id,
		collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
	) {
		super(name, collapsibleState);

		this._name = name;
		this._group = group;
		this._item_type = item_type;
		this._id = id;

		super.label = this.name;
		super.tooltip = this._tooltip;
		super.description = this._description;
		super.contextValue = this._contextValue;

		super.iconPath = {
			light: this.getIconPath("light"),
			dark: this.getIconPath("dark")
		};
	}

	protected getIconPath(theme: string): string {
		return fspath.join(ThisExtension.rootPath, 'resources', theme, this.item_type.toLowerCase() + '.png');
	}	

	readonly command = null;
	/*
	readonly command = {
		command: 'PowerBIWorkspaceItem.click', title: "Open File", arguments: [this]
	};
	*/

	// tooltip shown when hovering over the item
	get _tooltip(): string {
		return this.name;
	}

	// description is show next to the label
	get _description(): string {
		return this._id.toString();
	}

	// used in package.json to filter commands via viewItem == CANSTART
	get _contextValue(): string {
		return this.item_type;
	}
	
	public async getChildren(): Promise<PowerBIWorkspaceTreeItem[]> {
		await vscode.window.showErrorMessage("getChildren is not implemented! Please overwrite in derived class!");
		return undefined;
	}

	/* iDatabrickWorkspaceItem implementatin */
	get name(): string {
		return this._name;
	}

	get group(): string {
		return this._group;
	}

	get item_type(): WorkspaceItemType {
		return this._item_type;
	}

	get uid(): unique_id {
		return this._id;
	}

	public CopyPathToClipboard(): void {
		vscode.env.clipboard.writeText(this._name);
	}
}