import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Snapshot, SnapshotFile } from '../models/snapshot';
import { SnapshotStorage } from '../storage/snapshotStorage';

// 定义文件类型组的接口
interface FileTypeGroup {
    label: string;
    types: string[];
}

// 定义选择类型的接口
interface TypeSelection {
    label: string;
    description: string;
    types: string[];
}

export async function createSnapshot(context: vscode.ExtensionContext): Promise<void> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        // 获取所有工作区文件和文件夹
        const allFiles = await vscode.workspace.findFiles('**/*');
        const uniqueDirs = new Set<string>();
        allFiles.forEach(file => {
            let dir = path.dirname(file.fsPath);
            while (dir !== workspaceRoot) {
                uniqueDirs.add(path.relative(workspaceRoot, dir));
                dir = path.dirname(dir);
            }
        });

        // 让用户选择要排除的文件和文件夹
        const items = [
            { label: '$(files) 备份所有文件', type: 'all', description: '备份工作区内的所有文件' },
            { label: '$(symbol-file) 按文件类型备份', type: 'byType', description: '选择要备份的文件类型' },
            { label: '$(file) 选择要排除的文件', type: 'file', description: '选择要排除的具体文件' },
            { label: '$(folder) 选择要排除的文件夹', type: 'folder', description: '选择要排除的整个文件夹' }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: '请选择备份方式（必选）',
            ignoreFocusOut: true
        });

        if (!selection) {
            // 用户取消了选择
            return;
        }

        let excludePatterns: string[] = [];
        if (selection.type === 'all') {
            // 使用最小的排除规则
            excludePatterns = [
                '**/node_modules/**',
                '**/.git/**',
                '**/.DS_Store',
                '**/.snapshots/**'
            ];
        } else if (selection.type === 'byType') {
            // 获取工作区中所有的文件类型
            const fileTypes = new Set<string>();
            allFiles.forEach(file => {
                const ext = path.extname(file.fsPath).toLowerCase();
                if (ext) fileTypes.add(ext);
            });
            
            // 预定义文件类型组
            const codeTypes = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.php', '.rb'];
            const configTypes = ['.json', '.yaml', '.yml', '.xml', '.toml', '.ini'];
            const docTypes = ['.md', '.txt', '.doc', '.docx', '.pdf'];
            const imageTypes = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
            const dataTypes = ['.sql', '.db', '.sqlite'];
            
            // 按照类型分组
            const typeGroups: FileTypeGroup[] = [
                {
                    label: '$(code) 代码文件',
                    types: codeTypes
                },
                {
                    label: '$(json) 配置文件',
                    types: configTypes
                },
                {
                    label: '$(markdown) 文档文件',
                    types: docTypes
                },
                {
                    label: '$(image) 图片文件',
                    types: imageTypes
                },
                {
                    label: '$(database) 数据文件',
                    types: dataTypes
                },
                {
                    label: '$(file-binary) 其他文件',
                    types: Array.from(fileTypes).filter(ext => 
                        ![...codeTypes, ...configTypes, ...docTypes, ...imageTypes, ...dataTypes].includes(ext)
                    )
                }
            ];
            
            const selectedTypes = await vscode.window.showQuickPick<TypeSelection>(
                typeGroups.filter(group => 
                    group.types.some(type => fileTypes.has(type))
                ).map(group => ({
                    label: group.label,
                    description: `(${group.types.filter(t => fileTypes.has(t)).join(', ')})`,
                    types: group.types
                })), {
                    canPickMany: true,
                    placeHolder: '选择要备份的文件类型（可多选）',
                    ignoreFocusOut: true
                }
            );
            
            if (selectedTypes && selectedTypes.length > 0) {
                const includedTypes = selectedTypes.flatMap(g => g.types);
                // 排除未选择的文件类型
                excludePatterns = Array.from(fileTypes)
                    .filter(ext => !includedTypes.includes(ext))
                    .map(ext => `**/*${ext}`);
            }
        } else if (selection.type === 'folder') {
            const folders = Array.from(uniqueDirs).map(dir => ({
                label: dir || '根目录',
                picked: false
            }));
            const selectedFolders = await vscode.window.showQuickPick(folders, {
                canPickMany: true,
                placeHolder: '选择要排除的文件夹（可多选）',
                ignoreFocusOut: true
            });
            if (selectedFolders) {
                excludePatterns = selectedFolders.map(f => 
                    f.label === '根目录' ? '**/*' : `**/${f.label}/**`
                );
            }
        } else if (selection.type === 'file') {
            const files = allFiles.map(f => ({
                label: path.relative(workspaceRoot, f.fsPath),
                picked: false
            }));
            const selectedFiles = await vscode.window.showQuickPick(files, {
                canPickMany: true,
                placeHolder: '选择要排除的文件（可多选）',
                ignoreFocusOut: true
            });
            if (selectedFiles) {
                excludePatterns = selectedFiles.map(f => f.label);
            }
        }

        // 获取用户输入的快照名称
        const inputName = await vscode.window.showInputBox({
            prompt: '请输入快照名称（必填）',
            placeHolder: '例如：重要功能完成',
            ignoreFocusOut: true,
            validateInput: text => {
                return text.trim() ? null : '快照名称不能为空';
            }
        });

        if (!inputName) {
            // 用户取消了输入
            return;
        }

        const snapshotName = inputName.trim();

        // 获取配置的排除模式
        const config = vscode.workspace.getConfiguration('codeSnapshot');
        const defaultExcludePatterns = config.get<string[]>('excludePatterns', []);
        const customExcludePatterns = config.get<string[]>('customExcludePatterns', []);
        
        // 合并所有排除模式
        const allExcludePatterns = [
            '**/.snapshots/**',
            ...defaultExcludePatterns,
            ...customExcludePatterns,
            ...excludePatterns
        ];
        
        // 构建 glob 模式
        const excludeGlob = `{${allExcludePatterns.join(',')}}`;
        
        // 添加文件大小限制
        const maxFileSize = config.get<number>('maxFileSize', 1024 * 1024); // 默认1MB
        
        // 获取所有工作区文件
        const files = await vscode.workspace.findFiles('**/*', excludeGlob);
        
        const snapshotFiles: SnapshotFile[] = [];
        
        // 读取文件内容
        for (const file of files) {
            // 检查文件大小
            const stat = await vscode.workspace.fs.stat(file);
            if (stat.size > maxFileSize) {
                continue;
            }
            
            const content = await vscode.workspace.fs.readFile(file);
            const relativePath = path.relative(workspaceRoot, file.fsPath).replace(/\\/g, '/');
            
            snapshotFiles.push({
                path: relativePath,
                content: Buffer.from(content).toString('base64'),
                lastModified: Date.now(),
                size: stat.size,
                type: path.extname(file.path),
                readonly: false,
                hash: await calculateFileHash(content)
            });
        }

        // 添加进度提示
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在创建快照...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            // ... 创建快照的代码 ...
            progress.report({ increment: 100 });
        });

        // 创建快照
        const snapshot: Snapshot = {
            id: uuidv4(),
            timestamp: Date.now(),
            name: snapshotName,
            files: snapshotFiles,
            workspaceRoot,
            fileCount: snapshotFiles.length,
            totalSize: snapshotFiles.reduce((sum, file) => sum + file.size, 0),
            lastModified: Date.now(),
            version: 1
        };

        // 保存快照
        const storage = new SnapshotStorage(context);
        await storage.saveSnapshot(snapshot);

        // 使用正确的刷新命令
        await vscode.commands.executeCommand('codeSnapshot.refreshTree');

        vscode.window.showInformationMessage(`快照"${snapshotName}"创建成功！`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`快照创建失败: ${error?.message || '未知错误'}`);
    }
}

// 生成默认快照名称
function generateDefaultName(): string {
    const now = new Date();
    const activeEditor = vscode.window.activeTextEditor;
    let prefix = '快照';
    
    // 如果有活动编辑器，使用文件名作为前缀
    if (activeEditor) {
        const fileName = path.basename(activeEditor.document.fileName);
        prefix = fileName.split('.')[0];
    }
    
    // 格式化时间
    const timeStr = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const dateStr = now.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
    });
    
    return `${prefix}_${dateStr}_${timeStr}`;
}

// 添加计算文件哈希的辅助函数
async function calculateFileHash(content: Uint8Array): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
} 