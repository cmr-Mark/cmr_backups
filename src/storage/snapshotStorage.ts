import * as vscode from 'vscode';
import { Snapshot } from '../models/snapshot';
import { FileUtils } from '../utils/fileUtils';
import * as fs from 'fs';
import * as path from 'path';

export class SnapshotStorage {
    constructor(private context: vscode.ExtensionContext) {}

    async saveSnapshot(snapshot: Snapshot): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder open');
        }
        await FileUtils.saveSnapshotToFile(snapshot, workspaceRoot);
    }

    async getAllSnapshots(): Promise<Snapshot[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            return [];
        }
        return FileUtils.getAllSnapshots(workspaceRoot);
    }

    async getSnapshotById(id: string): Promise<Snapshot | undefined> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            return undefined;
        }
        try {
            return await FileUtils.loadSnapshotFromFile(id, workspaceRoot);
        } catch {
            return undefined;
        }
    }

    async deleteSnapshot(id: string): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            return;
        }
        const snapshotDir = await FileUtils.ensureSnapshotDir(workspaceRoot);
        const fileName = `snapshot_${id}.json`;
        const filePath = path.join(snapshotDir, fileName);
        try {
            await fs.promises.unlink(filePath);
        } catch {
            // 如果文件不存在，忽略错误
        }
    }

    async cleanupOldSnapshots(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        const config = vscode.workspace.getConfiguration('codeSnapshot');
        const maxSnapshots = config.get<number>('maxSnapshots', 50);
        
        const snapshots = await this.getAllSnapshots();
        if (snapshots.length > maxSnapshots) {
            const sortedSnapshots = snapshots.sort((a, b) => b.timestamp - a.timestamp);
            const toDelete = sortedSnapshots.slice(maxSnapshots);
            
            // 删除多余的快照文件
            for (const snapshot of toDelete) {
                await this.deleteSnapshot(snapshot.id);
            }
        }
    }

    async searchSnapshots(query: string): Promise<Snapshot[]> {
        const snapshots = await this.getAllSnapshots();
        return snapshots.filter(s => 
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.description?.toLowerCase().includes(query.toLowerCase()) ||
            s.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
    }
} 