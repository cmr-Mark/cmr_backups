import * as vscode from 'vscode';
import * as path from 'path';
import { SnapshotStorage } from '../storage/snapshotStorage';
import { Snapshot, SnapshotFile } from '../models/snapshot';
import * as fs from 'fs';

export async function restoreSnapshot(context: vscode.ExtensionContext, snapshotId: string): Promise<void> {
    try {
        console.log('Restoring snapshot with ID:', snapshotId);
        const storage = new SnapshotStorage(context);
        const snapshot = await storage.getSnapshotById(snapshotId);
        
        if (!snapshot) {
            console.error('Snapshot not found:', snapshotId);
            throw new Error('快照不存在');
        }

        // 检查工作区
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!currentWorkspace) {
            throw new Error('未打开工作区');
        }

        // 检查工作区是否匹配
        if (currentWorkspace !== snapshot.workspaceRoot) {
            const result = await vscode.window.showWarningMessage(
                '当前工作区与快照工作区不匹配，是否继续恢复？',
                { modal: true },
                '继续恢复',
                '取消'
            );
            if (result !== '继续恢复') {
                return;
            }
        }

        // 检查未保存的更改
        const hasUnsavedChanges = vscode.workspace.textDocuments.some(doc => doc.isDirty);
        if (hasUnsavedChanges) {
            const result = await vscode.window.showWarningMessage(
                '存在未保存的更改，恢复快照将丢失这些更改。是否继续？',
                { modal: true },
                '保存并继续',
                '直接继续',
                '取消'
            );

            if (result === '取消') {
                return;
            }
            if (result === '保存并继续') {
                await vscode.workspace.saveAll();
            }
        }

        // 选择恢复模式
        const restoreMode = await vscode.window.showQuickPick(
            [
                {
                    label: '完全恢复',
                    description: '恢复所有文件',
                    detail: '将完全恢复快照中的所有文件',
                    mode: 'full'
                },
                {
                    label: '选择性恢复',
                    description: '选择要恢复的文件',
                    detail: '让您选择要恢复的特定文件',
                    mode: 'selective'
                },
                {
                    label: '增量恢复',
                    description: '只恢复已更改的文件',
                    detail: '只恢复与当前版本不同的文件',
                    mode: 'incremental'
                }
            ],
            {
                placeHolder: '请选择恢复模式'
            }
        );

        if (!restoreMode) {
            return;
        }

        // 创建恢复点
        await createRestorePoint(context, currentWorkspace);

        // 根据不同模式恢复
        switch (restoreMode.mode) {
            case 'full':
                await restoreAllFiles(snapshot);
                break;
            case 'selective':
                await restoreSelectedFiles(snapshot);
                break;
            case 'incremental':
                await restoreIncrementalFiles(snapshot);
                break;
        }

        // 刷新快照树视图
        await vscode.commands.executeCommand('codeSnapshot.refreshTree');

        vscode.window.showInformationMessage('快照恢复成功！');
    } catch (error: any) {
        vscode.window.showErrorMessage(`快照恢复失败: ${error?.message || '未知错误'}`);
    }
}

// 创建恢复点
async function createRestorePoint(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    try {
        // 获取所有工作区文件
        const config = vscode.workspace.getConfiguration('codeSnapshot');
        const excludePatterns = config.get<string[]>('excludePatterns', []);
        const excludeGlob = `{${excludePatterns.join(',')}}`;
        const files = await vscode.workspace.findFiles('**/*', excludeGlob);

        const snapshotFiles: SnapshotFile[] = [];
        
        // 读取文件内容
        for (const file of files) {
            const content = await vscode.workspace.fs.readFile(file);
            const relativePath = path.relative(workspaceRoot, file.fsPath);
            const stat = await vscode.workspace.fs.stat(file);
            
            snapshotFiles.push({
                path: relativePath,
                content: Buffer.from(content).toString('utf8'),
                lastModified: Date.now(),
                size: stat.size,
                type: path.extname(file.fsPath),
                readonly: false,
                hash: await calculateFileHash(content)
            });
        }

        const restorePoint: Snapshot = {
            id: 'restore_point_' + Date.now(),
            timestamp: Date.now(),
            name: '恢复点_' + new Date().toLocaleString('zh-CN'),
            files: snapshotFiles,
            workspaceRoot,
            fileCount: snapshotFiles.length,
            totalSize: snapshotFiles.reduce((sum, file) => sum + file.size, 0),
            lastModified: Date.now(),
            version: 1
        };

        const storage = new SnapshotStorage(context);
        await storage.saveSnapshot(restorePoint);
        console.log('Restore point created with', snapshotFiles.length, 'files');
    } catch (error) {
        console.error('Error creating restore point:', error);
        throw new Error('创建恢复点失败: ' + error);
    }
}

// 添加计算文件哈希的辅助函数
async function calculateFileHash(content: Uint8Array): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

// 完全恢复所有文件
async function restoreAllFiles(snapshot: Snapshot): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在恢复快照...",
        cancellable: false
    }, async (progress) => {
        const total = snapshot.files.length;
        for (let i = 0; i < snapshot.files.length; i++) {
            const file = snapshot.files[i];
            progress.report({ 
                increment: (100 / total), 
                message: `(${i + 1}/${total}) ${file.path}` 
            });
            await restoreFile(snapshot.workspaceRoot, file);
        }
    });
}

// 选择性恢复文件
async function restoreSelectedFiles(snapshot: Snapshot): Promise<void> {
    const items = snapshot.files.map(file => ({
        label: file.path,
        description: `${formatFileSize(file.size)}`,
        picked: true,
        file
    }));

    const selectedItems = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: '选择要恢复的文件'
    });

    if (!selectedItems) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在恢复所选文件...",
        cancellable: false
    }, async (progress) => {
        const total = selectedItems.length;
        for (let i = 0; i < selectedItems.length; i++) {
            const file = selectedItems[i].file;
            progress.report({ 
                increment: (100 / total), 
                message: `(${i + 1}/${total}) ${file.path}` 
            });
            await restoreFile(snapshot.workspaceRoot, file);
        }
    });
}

// 增量恢复文件
async function restoreIncrementalFiles(snapshot: Snapshot): Promise<void> {
    const changedFiles: SnapshotFile[] = [];

    for (const file of snapshot.files) {
        const currentPath = vscode.Uri.file(path.join(snapshot.workspaceRoot, file.path));
        try {
            const currentContent = await vscode.workspace.fs.readFile(currentPath);
            const currentStr = Buffer.from(currentContent).toString('utf-8');
            if (currentStr !== file.content) {
                changedFiles.push(file);
            }
        } catch {
            // 文件不存在，添加到变更列表
            changedFiles.push(file);
        }
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在恢复变更文件...",
        cancellable: false
    }, async (progress) => {
        const total = changedFiles.length;
        for (let i = 0; i < changedFiles.length; i++) {
            const file = changedFiles[i];
            progress.report({ 
                increment: (100 / total), 
                message: `(${i + 1}/${total}) ${file.path}` 
            });
            await restoreFile(snapshot.workspaceRoot, file);
        }
    });
}

// 恢复单个文件
async function restoreFile(workspaceRoot: string, file: SnapshotFile): Promise<void> {
    const filePath = vscode.Uri.file(path.join(workspaceRoot, file.path));
    
    // 确保目录存在
    const dirPath = path.dirname(filePath.fsPath);
    await fs.promises.mkdir(dirPath, { recursive: true });
    
    // 处理二进制文件
    try {
        const content = Buffer.from(file.content, 'base64');
        await fs.promises.writeFile(filePath.fsPath, content);
    } catch (error) {
        console.error('Error writing file:', filePath.fsPath, error);
        throw new Error(`无法写入文件 ${file.path}`);
    }

    // 刷新 VS Code 的文件系统
    await vscode.workspace.fs.stat(filePath);
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
} 