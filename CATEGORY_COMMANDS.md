# CFM-CLI Category 命令实现文档

## 概述

已成功为 cfm-cli 添加了 `category` 命令组，支持分类的列表查看和创建功能。

## 实现的功能

### 1. 列出所有分类

```bash
cfm category list [--api-url <url>]
```

**功能说明**：
- 调用公开 API：`GET /api/v1/marketplace/client/categories`
- 无需认证即可访问
- 以表格形式显示所有分类信息（Slug、名称、图标、父分类）

**示例输出**：
```
分类列表

✔ 找到 5 个分类

  Slug                 名称            图标  父分类
  ------------------------------------------------------------
  content-creation     内容创作        📝    -
  video-editing        视频编辑        🎬    content-creation
  automation           自动化          🤖    -
  data-analysis        数据分析        📊    -
  productivity         生产力工具      ⚡    -
```

### 2. 创建新分类

```bash
cfm category create <slug> <name> [options]
```

**选项**：
- `-i, --icon <emoji>` - emoji 图标（如 📝）
- `-p, --parent <slug>` - 父分类标识
- `-o, --order <number>` - 排序顺序（默认 0）
- `--api-url <url>` - API 服务器地址

**功能说明**：
- 调用管理 API：`POST /api/v1/marketplace/categories`
- 需要 JWT 认证（通过 `cfm login` 获取）
- 支持创建顶级分类和子分类

**示例**：
```bash
# 创建顶级分类
cfm category create content-creation "内容创作" -i 📝

# 创建子分类
cfm category create video-editing "视频编辑" -i 🎬 -p content-creation -o 10

# 指定服务器
cfm category create automation "自动化" -i 🤖 --api-url http://localhost:8020
```

## 代码变更

### 1. 配置模块 (`src/config.ts`)

扩展了配置接口以支持 `access_token`：

```typescript
export interface Config {
  remote?: {
    api_url?: string;
    api_key?: string;      // LLM API Key（用于发布）
    access_token?: string; // JWT Token（用于管理操作）
  };
}
```

### 2. API 模块 (`src/api.ts`)

添加了两个新的 API 函数：

```typescript
// 获取分类列表（公开接口）
export async function listCategories(apiUrl: string): Promise<Category[]>

// 创建分类（需要认证）
export async function createCategory(options: CreateCategoryOptions): Promise<void>
```

### 3. 命令模块 (`src/commands.ts`)

添加了两个命令实现函数：

```typescript
// 列出所有分类
export async function listCategoriesCommand(apiUrl: string): Promise<void>

// 创建分类
export async function createCategoryCommand(options: {...}): Promise<void>
```

修改了 `loginUser` 函数以保存 `access_token`：

```typescript
config.remote.access_token = result.access_token;
```

### 4. CLI 入口 (`src/cli.ts`)

注册了 `category` 命令组及其子命令：

```typescript
const categoryCmd = program
  .command('category')
  .description('分类管理命令');

categoryCmd.command('list')...
categoryCmd.command('create <slug> <name>')...
```

更新了 `logout` 命令以清除 `access_token`。

更新了 `config` 命令以显示 `access_token` 状态。

## 认证机制

### List 命令
- 使用公开 API，无需认证
- 任何人都可以查看分类列表

### Create 命令
- 使用管理 API，需要 JWT 认证
- 必须先运行 `cfm login` 登录
- 使用 `Authorization: Bearer <access_token>` 头部

## 错误处理

实现了完善的错误处理：

1. **未登录错误**：
   ```
   错误: 未登录
   请先运行 "cfm login" 登录
   ```

2. **网络错误**：
   ```
   ✖ 获取分类列表失败
   错误: request to http://localhost:8020/api/v1/marketplace/client/categories failed
   ```

3. **API 错误**：
   ```
   ✖ 创建分类失败
   错误: 分类标识已存在
   ```

## 测试验证

### 功能测试步骤

1. **查看帮助**：
   ```bash
   cfm category --help
   cfm category list --help
   cfm category create --help
   ```

2. **列出分类**（无需登录）：
   ```bash
   cfm category list
   ```

3. **登录**：
   ```bash
   cfm login --api-url http://localhost:8020
   ```

4. **创建分类**：
   ```bash
   cfm category create test-category "测试分类" -i 🧪
   ```

5. **验证创建结果**：
   ```bash
   cfm category list
   ```

6. **创建子分类**：
   ```bash
   cfm category create test-sub "测试子分类" -p test-category
   ```

### 错误场景测试

1. **未登录时创建分类**：
   ```bash
   cfm logout
   cfm category create test "测试"
   # 应该提示需要登录
   ```

2. **创建重复的分类**：
   ```bash
   cfm category create test-category "测试分类"
   # 应该显示错误
   ```

3. **无效的父分类**：
   ```bash
   cfm category create test2 "测试2" -p non-existent
   # 应该显示错误
   ```

## 与后端 API 的对应关系

| CLI 命令 | 后端 API | 认证方式 |
|---------|---------|---------|
| `cfm category list` | `GET /api/v1/marketplace/client/categories` | 无需认证 |
| `cfm category create` | `POST /api/v1/marketplace/categories` | JWT Token |

## 与 Python CLI (fba) 的对比

cfm-cli 的实现参考了 clound-backend 中的 fba 命令：

| 功能 | fba (Python) | cfm (Node.js) |
|-----|-------------|--------------|
| 列出分类 | `fba category list` | `cfm category list` |
| 创建分类 | `fba category create` | `cfm category create` |
| 认证方式 | JWT Token | JWT Token |
| 配置存储 | `~/.fba/config.yaml` | `~/.cfm/config.yaml` |

## 后续改进建议

1. **添加更多分类管理命令**：
   - `cfm category update <slug>` - 更新分类信息
   - `cfm category delete <slug>` - 删除分类
   - `cfm category get <slug>` - 查看单个分类详情

2. **改进输出格式**：
   - 支持 JSON 输出格式（`--json` 选项）
   - 支持树形显示分类层级关系

3. **添加交互式创建**：
   - 如果未提供参数，进入交互式输入模式
   - 提供分类模板选择

4. **添加验证**：
   - 验证 slug 格式（小写字母、数字、连字符）
   - 验证父分类是否存在

## 总结

✅ 成功实现了 `cfm category list` 和 `cfm category create` 命令
✅ 扩展了配置系统以支持 JWT Token
✅ 实现了完善的错误处理和用户提示
✅ 保持了与现有命令的一致性
✅ 参考了 Python CLI 的实现模式

所有代码已经构建成功，可以立即使用。
