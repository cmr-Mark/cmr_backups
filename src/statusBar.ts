import * as vscode from 'vscode';

export class SnapshotStatusBar {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'codeSnapshot.createSnapshot';
        this.statusBarItem.text = "$(history) 快照";
        this.statusBarItem.tooltip = "创建代码快照";
        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
} 