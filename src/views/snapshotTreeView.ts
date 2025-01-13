import * as vscode from 'vscode';
import { SnapshotStorage } from '../storage/snapshotStorage';
import { Snapshot } from '../models/snapshot';

export class SnapshotTreeView implements vscode.TreeDataProvider<SnapshotTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SnapshotTreeItem | undefined | null | void> = new vscode.EventEmitter<SnapshotTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SnapshotTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private treeView: vscode.TreeView<SnapshotTreeItem>;

    constructor(private context: vscode.ExtensionContext) {
        this.treeView = vscode.window.createTreeView('codeSnapshotExplorer', {
            treeDataProvider: this
        });

        // 监听文件系统变化
        const watcher = vscode.workspace.createFileSystemWatcher('**/.snapshots/*.json');
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidChange(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        context.subscriptions.push(watcher);
    }

    refresh(): void {
        console.log('Refreshing snapshot tree view');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SnapshotTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SnapshotTreeItem): Promise<SnapshotTreeItem[]> {
        if (element) {
            return [];
        }

        try {
            const storage = new SnapshotStorage(this.context);
            const snapshots = await storage.getAllSnapshots();
            console.log('Found snapshots:', snapshots.length);
            // 按时间排序
            snapshots.sort((a, b) => b.timestamp - a.timestamp);
            return snapshots.map(snapshot => new SnapshotTreeItem(snapshot));
        } catch (error) {
            console.error('Error getting snapshots:', error);
            return [];
        }
    }

    private groupSnapshots(snapshots: Snapshot[]): Map<string, Snapshot[]> {
        const groups = new Map<string, Snapshot[]>();
        const today = new Date().toLocaleDateString('zh-CN');
        
        snapshots.forEach(snapshot => {
            const date = new Date(snapshot.timestamp).toLocaleDateString('zh-CN');
            const groupName = date === today ? '今天' : date;
            
            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName)?.push(snapshot);
        });
        
        return groups;
    }

    private sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
        return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    }

    dispose() {
        this._onDidChangeTreeData.dispose();
        this.treeView.dispose();
    }
}

class SnapshotTreeItem extends vscode.TreeItem {
    constructor(public readonly snapshot: Snapshot) {
        super(
            `${snapshot.name} (${new Date(snapshot.timestamp).toLocaleString('zh-CN')})`,
            vscode.TreeItemCollapsibleState.None
        );

        this.iconPath = new vscode.ThemeIcon('history');
        
        this.description = `${snapshot.files.length} 个文件 - ${formatFileSize(snapshot.totalSize)}`;

        this.tooltip = `名称: ${snapshot.name}
创建时间: ${new Date(snapshot.timestamp).toLocaleString('zh-CN')}
描述: ${snapshot.description || '无'}
标签: ${snapshot.tags?.join(', ') || '无'}
文件数量: ${snapshot.files.length}`;
        
        this.contextValue = 'snapshot';

        this.id = snapshot.id;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
} 