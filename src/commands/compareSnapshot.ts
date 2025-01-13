import * as vscode from 'vscode';
import { SnapshotStorage } from '../storage/snapshotStorage';
import * as path from 'path';
import * as fs from 'fs';

export async function compareSnapshot(context: vscode.ExtensionContext, snapshotId: string): Promise<void> {
    try {
        const storage = new SnapshotStorage(context);
        const snapshot = await storage.getSnapshotById(snapshotId);
        
        if (!snapshot) {
            throw new Error('快照不存在');
        }

        // 创建临时目录
        const tempDir = path.join(snapshot.workspaceRoot, '.vscode-snapshot-temp');
        if (!fs.existsSync(tempDir)) {
            await fs.promises.mkdir(tempDir, { recursive: true });
        }

        // 为每个文件创建比较
        for (const file of snapshot.files) {
            // 创建临时文件
            const tempFile = path.join(tempDir, file.path);
            const tempFileDir = path.dirname(tempFile);
            
            // 确保临时文件目录存在
            if (!fs.existsSync(tempFileDir)) {
                await fs.promises.mkdir(tempFileDir, { recursive: true });
            }

            // 写入快照内容到临时文件
            const content = Buffer.from(file.content, 'base64');
            await fs.promises.writeFile(tempFile, content);

            // 当前文件路径
            const currentFile = path.join(snapshot.workspaceRoot, file.path);
            
            // 打开差异对比
            await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(tempFile),
                vscode.Uri.file(currentFile),
                `快照对比 - ${file.path} (${new Date(snapshot.timestamp).toLocaleString('zh-CN')})`
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`快照对比失败: ${error?.message || '未知错误'}`);
    }
} 