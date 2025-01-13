import * as vscode from 'vscode';
import { createSnapshot } from './commands/createSnapshot';
import { restoreSnapshot } from './commands/restoreSnapshot';
import { compareSnapshot } from './commands/compareSnapshot';
import { SnapshotTreeView } from './views/snapshotTreeView';
import { SnapshotStatusBar } from './statusBar';
import { SnapshotStorage } from './storage/snapshotStorage';
import { Snapshot } from './models/snapshot';

let autoSnapshotInterval: NodeJS.Timer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Snapshot is now active!');

    // 初始化视图
    const treeView = new SnapshotTreeView(context);
    context.subscriptions.push(treeView);

    // 注册刷新命令
    const refreshCommand = vscode.commands.registerCommand('codeSnapshot.refreshTree', () => {
        treeView.refresh();
    });
    context.subscriptions.push(refreshCommand);

    // 注册创建快照命令
    const createSnapshotCommand = vscode.commands.registerCommand('codeSnapshot.createSnapshot', async () => {
        console.log('Trying to create snapshot...');
        try {
            await createSnapshot(context);
            // 使用新的刷新命令
            await vscode.commands.executeCommand('codeSnapshot.refreshTree');
            console.log('Snapshot created successfully');
        } catch (error) {
            console.error('Create snapshot error:', error);
            vscode.window.showErrorMessage(`创建快照失败: ${error}`);
        }
    });

    // 注册恢复快照命令
    const restoreSnapshotCommand = vscode.commands.registerCommand('codeSnapshot.restoreSnapshot', async (item: any) => {
        console.log('Trying to restore snapshot:', item);
        try {
            if (item && item.snapshot) {
                await restoreSnapshot(context, item.snapshot.id);
                vscode.window.showInformationMessage('快照恢复成功！');
            } else {
                // 如果没有传入快照数据，让用户选择一个快照
                const storage = new SnapshotStorage(context);
                const snapshots = await storage.getAllSnapshots();
                if (snapshots.length === 0) {
                    throw new Error('没有可用的快照');
                }
                
                const items = snapshots.map((s: Snapshot) => ({
                    label: s.name,
                    description: new Date(s.timestamp).toLocaleString('zh-CN'),
                    snapshot: s
                }));
                
                type QuickPickItem = {
                    label: string;
                    description: string;
                    snapshot: Snapshot;
                };
                
                const selected = await vscode.window.showQuickPick<QuickPickItem>(items, {
                    placeHolder: '选择要恢复的快照'
                });
                
                if (selected) {
                    await restoreSnapshot(context, selected.snapshot.id);
                    vscode.window.showInformationMessage('快照恢复成功！');
                }
            }
        } catch (error) {
            console.error('Restore snapshot error:', error);
            vscode.window.showErrorMessage(`恢复快照失败: ${error}`);
        }
    });

    // 注册比较快照命令
    const compareSnapshotCommand = vscode.commands.registerCommand('codeSnapshot.compareSnapshot', async (item: any) => {
        console.log('Trying to compare snapshot:', item);
        try {
            if (item && item.snapshot) {
                await compareSnapshot(context, item.snapshot.id);
            } else {
                // 如果没有传入快照数据，让用户选择一个快照
                const storage = new SnapshotStorage(context);
                const snapshots = await storage.getAllSnapshots();
                if (snapshots.length === 0) {
                    throw new Error('没有可用的快照');
                }
                
                const items = snapshots.map((s: Snapshot) => ({
                    label: s.name,
                    description: new Date(s.timestamp).toLocaleString('zh-CN'),
                    snapshot: s
                }));
                
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: '选择要比较的快照'
                });
                
                if (selected) {
                    await compareSnapshot(context, selected.snapshot.id);
                }
            }
        } catch (error) {
            console.error('Compare snapshot error:', error);
            vscode.window.showErrorMessage(`比较快照失败: ${error}`);
        }
    });

    // 注册删除快照命令
    const deleteSnapshotCommand = vscode.commands.registerCommand('codeSnapshot.deleteSnapshot', async (item: any) => {
        console.log('Trying to delete snapshot:', item);
        try {
            if (item && item.snapshot) {
                const result = await vscode.window.showWarningMessage(
                    `确定要删除快照"${item.snapshot.name}"吗？此操作不可恢复。`,
                    {
                        modal: true,
                        detail: `创建时间: ${new Date(item.snapshot.timestamp).toLocaleString('zh-CN')}\n文件数量: ${item.snapshot.files.length}`,
                    },
                    { title: '删除', isCloseAffordance: false }
                );

                if (result) {
                    const storage = new SnapshotStorage(context);
                    await storage.deleteSnapshot(item.snapshot.id);
                    await vscode.commands.executeCommand('codeSnapshot.refreshTree');
                    vscode.window.showInformationMessage('快照已删除！');
                }
            }
        } catch (error) {
            console.error('Delete snapshot error:', error);
            vscode.window.showErrorMessage(`删除快照失败: ${error}`);
        }
    });

    console.log('Commands registered');

    // 添加命令到订阅列表
    context.subscriptions.push(createSnapshotCommand);
    context.subscriptions.push(compareSnapshotCommand);
    context.subscriptions.push(restoreSnapshotCommand);
    context.subscriptions.push(deleteSnapshotCommand);

    // 添加状态栏按钮
    const statusBar = new SnapshotStatusBar();
    context.subscriptions.push(statusBar);

    // 设置自动快照
    setupAutoSnapshot(context);
}

function setupAutoSnapshot(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('codeSnapshot');
    const interval = config.get<number>('autoSnapshotInterval', 30);
    
    if (autoSnapshotInterval) {
        clearInterval(autoSnapshotInterval);
    }

    if (interval > 0) {
        autoSnapshotInterval = setInterval(() => {
            createSnapshot(context);
        }, interval * 60 * 1000);
    }
}

export function deactivate() {
    if (autoSnapshotInterval) {
        clearInterval(autoSnapshotInterval);
    }
} 