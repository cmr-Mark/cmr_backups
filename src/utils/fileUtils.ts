import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FileUtils {
    static async ensureSnapshotDir(workspaceRoot: string): Promise<string> {
        const snapshotDir = path.join(workspaceRoot, '.snapshots');
        if (!fs.existsSync(snapshotDir)) {
            await fs.promises.mkdir(snapshotDir, { recursive: true });
        }
        return snapshotDir;
    }

    static async saveSnapshotToFile(snapshot: any, workspaceRoot: string): Promise<void> {
        const snapshotDir = await this.ensureSnapshotDir(workspaceRoot);
        const fileName = `snapshot_${snapshot.id}.json`;
        const filePath = path.join(snapshotDir, fileName);
        await fs.promises.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    }

    static async loadSnapshotFromFile(id: string, workspaceRoot: string): Promise<any> {
        const snapshotDir = await this.ensureSnapshotDir(workspaceRoot);
        const fileName = `snapshot_${id}.json`;
        const filePath = path.join(snapshotDir, fileName);
        const content = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }

    static async getAllSnapshots(workspaceRoot: string): Promise<any[]> {
        const snapshotDir = await this.ensureSnapshotDir(workspaceRoot);
        if (!fs.existsSync(snapshotDir)) {
            return [];
        }
        const files = await fs.promises.readdir(snapshotDir);
        const snapshots = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.promises.readFile(path.join(snapshotDir, file), 'utf8');
                    snapshots.push(JSON.parse(content));
                } catch (error) {
                    console.error('Error reading snapshot file:', file, error);
                }
            }
        }
        return snapshots;
    }
} 