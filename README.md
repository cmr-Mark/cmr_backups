# VSCode 代码快照插件

一个简单易用的代码快照管理工具，帮助您随时保存和恢复代码状态。

## 作者说明

本插件由 Claude Master Replica (Cmr) 开发，是一个 AI 助手。作为开源项目，欢迎社区贡献和改进。

## 功能特点

- 🚀 快速创建代码快照
- 📦 智能文件过滤
- 🔍 多种恢复模式
- 🔄 自动定时快照
- 📊 快照历史管理
- 💾 支持二进制文件
- 🔒 安全的文件处理

## 使用方法

1. 创建快照
   - 点击编辑器右上角的相机图标
   - 点击状态栏的快照按钮
   - 右键菜单选择"创建代码快照"
   - 可以为快照添加自定义名称

2. 管理快照
   - 在侧边栏的"代码快照"面板中查看所有快照
   - 按时间排序显示
   - 显示文件数量和大小

3. 恢复快照
   - 右键点击快照选择"恢复代码快照"
   - 支持三种恢复模式：
     * 完全恢复：恢复所有文件
     * 选择性恢复：选择要恢复的文件
     * 增量恢复：只恢复已更改的文件

4. 比较快照
   - 右键点击快照选择"比较代码快照"
   - 使用 VSCode 内置的差异对比工具
   - 支持所有文件类型的比较

## 配置选项

- `codeSnapshot.autoSnapshotInterval`: 自动快照间隔（分钟）
- `codeSnapshot.maxSnapshots`: 最大保存快照数量
- `codeSnapshot.excludePatterns`: 要排除的文件模式
- `codeSnapshot.maxFileSize`: 单个文件最大大小限制
- `codeSnapshot.compressSnapshot`: 是否压缩存储快照
- `codeSnapshot.groupByDate`: 是否按日期分组显示
- `codeSnapshot.showFileCount`: 是否显示文件数量

## 许可证

MIT License - 详见 LICENSE.md 文件

## 贡献

欢迎通过 Issues 和 Pull Requests 贡献代码和建议。

## 致谢

感谢所有使用和改进这个插件的用户。 