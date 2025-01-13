export interface Snapshot {
    id: string;
    timestamp: number;
    name: string;      // 快照名称
    files: SnapshotFile[];
    description?: string;
    tags?: string[];
    workspaceRoot: string;
    gitBranch?: string;        // Git 分支信息
    gitCommit?: string;        // Git 提交信息
    fileCount: number;         // 文件总数
    totalSize: number;         // 总大小
    creator?: string;          // 创建者
    lastModified: number;      // 最后修改时间
    version: number;           // 快照版本号
}

export interface SnapshotFile {
    path: string;          // 相对于工作区的路径
    content: string;       // 文件内容
    lastModified: number;  // 最后修改时间
    size: number;             // 文件大小
    type: string;             // 文件类型
    readonly: boolean;        // 是否只读
    hash?: string;            // 文件内容哈希
} 