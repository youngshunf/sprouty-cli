import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import { createPackage } from './packager';
import { uploadPackage, deletePackage, login, listCategories, createCategory } from './api';
import { loadConfig, saveConfig } from './config';

// 版本号递增
function bumpVersion(current: string, type: 'patch' | 'minor' | 'major'): string {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`无效的版本号: ${current}`);
  }
  switch (type) {
    case 'major': return `${parts[0] + 1}.0.0`;
    case 'minor': return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch': return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

export interface PublishOptions {
  apiUrl: string;
  apiKey: string;
  bump?: string;
  version?: string;
  changelog?: string;
}

// ============================================================
// 登录
// ============================================================

export async function loginUser(apiUrl: string, username: string, password: string): Promise<void> {
  const spinner = ora('正在登录...').start();

  try {
    const result = await login({ apiUrl, username, password });
    spinner.succeed('登录成功');

    if (!result.llm_token) {
      console.log(chalk.yellow('\n警告: 未获取到 API Key，请联系管理员'));
      return;
    }

    // 保存配置
    const config = loadConfig();
    config.remote = config.remote || {};
    config.remote.api_url = apiUrl;
    config.remote.api_key = result.llm_token;
    config.remote.access_token = result.access_token;
    saveConfig(config);

    console.log();
    console.log(chalk.green(`✓ 欢迎回来, ${result.user.nickname || result.user.username}!`));
    console.log(chalk.green('✓ API Key 已保存到 ~/.cfm/config.yaml'));
    console.log();
    console.log(chalk.gray('现在您可以使用以下命令:'));
    console.log(chalk.gray('  cfm skill publish <path>  发布技能'));
    console.log(chalk.gray('  cfm app publish <path>    发布应用'));
    console.log();
  } catch (error: any) {
    spinner.fail('登录失败');
    throw error;
  }
}

// ============================================================
// 技能验证
// ============================================================

export interface SkillConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author_name?: string;
  category?: string;
  tags?: string[];
}

export async function validateSkill(skillPath: string): Promise<SkillConfig> {
  const absPath = path.resolve(skillPath);
  
  console.log(chalk.cyan('\n技能包验证\n'));
  console.log(chalk.gray('路径:'), absPath);
  console.log();

  // 检查目录存在
  if (!fs.existsSync(absPath)) {
    throw new Error(`目录不存在: ${absPath}`);
  }

  // 检查 config.yaml
  const configPath = path.join(absPath, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    throw new Error('缺少必需文件: config.yaml');
  }

  // 解析 config.yaml
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(configContent) as SkillConfig;

  // 验证必需字段
  const requiredFields = ['id', 'name', 'version', 'description'];
  for (const field of requiredFields) {
    if (!config[field as keyof SkillConfig]) {
      throw new Error(`config.yaml 缺少必需字段: ${field}`);
    }
  }

  // 验证 ID 格式
  if (!/^[a-z][a-z0-9-]*$/.test(config.id)) {
    throw new Error(`技能 ID 格式无效: ${config.id}（应为小写字母开头，只包含字母、数字和连字符）`);
  }

  // 检查 SKILL.md
  const skillMdPath = path.join(absPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error('缺少必需文件: SKILL.md');
  }

  // 检查图标（可选警告）
  const iconPath = path.join(absPath, 'icon.svg');
  if (!fs.existsSync(iconPath)) {
    console.log(chalk.yellow('⚠ 警告: 缺少图标文件 icon.svg'));
  }

  console.log(chalk.green('✓ 技能包验证通过'));
  console.log(chalk.green(`✓ 技能: ${config.name} (v${config.version})`));

  return config;
}

// ============================================================
// 应用验证
// ============================================================

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: {
    name?: string;
    email?: string;
  };
  marketplace?: {
    category?: string;
    tags?: string[];
    changelog?: string;
  };
  capabilities?: {
    skills?: string[];
  };
}

export async function validateApp(appPath: string): Promise<AppManifest> {
  const absPath = path.resolve(appPath);
  
  console.log(chalk.cyan('\n应用包验证\n'));
  console.log(chalk.gray('路径:'), absPath);
  console.log();

  // 检查目录存在
  if (!fs.existsSync(absPath)) {
    throw new Error(`目录不存在: ${absPath}`);
  }

  // 检查 manifest.json
  const manifestPath = path.join(absPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('缺少必需文件: manifest.json');
  }

  // 解析 manifest.json
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent) as AppManifest;

  // 验证必需字段
  const requiredFields = ['id', 'name', 'version', 'description'];
  for (const field of requiredFields) {
    if (!manifest[field as keyof AppManifest]) {
      throw new Error(`manifest.json 缺少必需字段: ${field}`);
    }
  }

  // 验证 ID 格式
  if (!/^[a-z]+\.[a-z][a-z0-9-]*$/.test(manifest.id)) {
    throw new Error(`应用 ID 格式无效: ${manifest.id}（应为 app.name 或 plugin.name 格式）`);
  }

  // 检查图标（可选警告）
  const iconPath = path.join(absPath, 'icon.svg');
  const assetsIconPath = path.join(absPath, 'assets', 'icon.svg');
  if (!fs.existsSync(iconPath) && !fs.existsSync(assetsIconPath)) {
    console.log(chalk.yellow('⚠ 警告: 缺少图标文件 icon.svg'));
  }

  console.log(chalk.green('✓ 应用包验证通过'));
  console.log(chalk.green(`✓ 应用: ${manifest.name} (v${manifest.version})`));
  if (manifest.marketplace?.category) {
    console.log(chalk.green(`✓ 分类: ${manifest.marketplace.category}`));
  }
  if (manifest.marketplace?.tags && manifest.marketplace.tags.length > 0) {
    console.log(chalk.green(`✓ 标签: ${manifest.marketplace.tags.join(', ')}`));
  }

  return manifest;
}

// ============================================================
// 技能发布
// ============================================================

export async function publishSkill(skillPath: string, options: PublishOptions): Promise<void> {
  console.log(chalk.cyan('\n技能发布\n'));
  console.log(chalk.gray('路径:'), path.resolve(skillPath));
  console.log(chalk.gray('服务器:'), options.apiUrl);
  console.log();

  // 1. 验证
  const spinner = ora('验证技能包...').start();
  let config: SkillConfig;
  try {
    config = await validateSkill(skillPath);
    spinner.succeed('技能包验证通过');
  } catch (error: any) {
    spinner.fail('技能包验证失败');
    throw error;
  }

  // 2. 版本处理（bump 或指定版本号，写回本地 config.yaml）
  if (options.bump || options.version) {
    const absPath = path.resolve(skillPath);
    const configPath = path.join(absPath, 'config.yaml');
    const oldVersion = config.version;
    const newVersion = options.version || bumpVersion(config.version, options.bump as 'patch' | 'minor' | 'major');

    let configContent = fs.readFileSync(configPath, 'utf-8');
    configContent = configContent.replace(/^version:\s*.+$/m, `version: ${newVersion}`);

    // 更新 changelog
    if (options.changelog) {
      const changelogEntry = `\n## v${newVersion}\n${options.changelog}\n`;
      // 在 changelog 字段后追加，如果没有 changelog 字段则创建
      if (configContent.match(/^changelog:\s*[|>-]/m)) {
        // 已有 changelog 块，在其后追加
        configContent = configContent.replace(/^(changelog:\s*[|>-].*?)(\n\n|\n(?=[a-z_]+:)|$)/ms, `$1${changelogEntry}$2`);
      } else {
        // 没有 changelog 字段，在文件末尾添加
        configContent += `\nchangelog: |${changelogEntry}`;
      }
      console.log(chalk.green(`✓ Changelog 已更新`));
    }

    fs.writeFileSync(configPath, configContent, 'utf-8');

    config.version = newVersion;
    console.log(chalk.green(`✓ 版本更新: ${oldVersion} → ${newVersion}`));
  }

  // 3. 打包
  spinner.start('打包技能...');
  const packageBuffer = await createPackage(skillPath);
  spinner.succeed(`打包完成: ${(packageBuffer.length / 1024).toFixed(1)} KB`);

  // 4. 上传
  spinner.start('上传到服务器...');
  try {
    const result = await uploadPackage({
      type: 'skill',
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      packageBuffer,
      changelog: options.changelog,
    });
    spinner.succeed('上传完成');

    console.log();
    console.log(chalk.green('✓ 技能发布成功!'));
    console.log(chalk.green(`✓ 技能 ID: ${result.id}`));
    console.log(chalk.green(`✓ 版本: ${result.version}`));
    console.log(chalk.green(`✓ 下载地址: ${result.package_url}`));
  } catch (error: any) {
    spinner.fail('上传失败');
    throw error;
  }
}

// ============================================================
// 应用发布
// ============================================================

export async function publishApp(appPath: string, options: PublishOptions): Promise<void> {
  console.log(chalk.cyan('\n应用发布\n'));
  console.log(chalk.gray('路径:'), path.resolve(appPath));
  console.log(chalk.gray('服务器:'), options.apiUrl);
  console.log();

  // 1. 验证
  const spinner = ora('验证应用包...').start();
  let manifest: AppManifest;
  try {
    manifest = await validateApp(appPath);
    spinner.succeed('应用包验证通过');
  } catch (error: any) {
    spinner.fail('应用包验证失败');
    throw error;
  }

  // 2. 版本处理（bump 或指定版本号，写回本地 manifest.json）
  if (options.bump || options.version) {
    const absPath = path.resolve(appPath);
    const manifestPath = path.join(absPath, 'manifest.json');
    const oldVersion = manifest.version;
    const newVersion = options.version || bumpVersion(manifest.version, options.bump as 'patch' | 'minor' | 'major');

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifestContent.version = newVersion;

    // 更新 changelog
    if (options.changelog) {
      const changelogEntry = `## v${newVersion}\n${options.changelog}\n\n`;
      if (!manifestContent.marketplace) {
        manifestContent.marketplace = {};
      }
      const existingChangelog = manifestContent.marketplace.changelog || '';
      manifestContent.marketplace.changelog = changelogEntry + existingChangelog;
      console.log(chalk.green(`✓ Changelog 已更新`));
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2) + '\n', 'utf-8');

    manifest.version = newVersion;
    console.log(chalk.green(`✓ 版本更新: ${oldVersion} → ${newVersion}`));
  }

  // 3. 打包
  spinner.start('打包应用...');
  const packageBuffer = await createPackage(appPath);
  spinner.succeed(`打包完成: ${(packageBuffer.length / 1024).toFixed(1)} KB`);

  // 4. 上传
  spinner.start('上传到服务器...');
  try {
    const result = await uploadPackage({
      type: 'app',
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      packageBuffer,
      changelog: options.changelog,
    });
    spinner.succeed('上传完成');

    console.log();
    console.log(chalk.green('✓ 应用发布成功!'));
    console.log(chalk.green(`✓ 应用 ID: ${result.id}`));
    console.log(chalk.green(`✓ 版本: ${result.version}`));
    console.log(chalk.green(`✓ 下载地址: ${result.package_url}`));
  } catch (error: any) {
    spinner.fail('上传失败');
    throw error;
  }
}

// ============================================================
// 删除技能/应用
// ============================================================

export interface DeleteCommandOptions {
  apiUrl: string;
  accessToken: string;
}

/**
 * 删除技能
 */
export async function deleteSkillCommand(skillId: string, options: DeleteCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n删除技能\n'));
  console.log(chalk.gray('技能 ID:'), skillId);
  console.log(chalk.gray('服务器:'), options.apiUrl);
  console.log();

  const spinner = ora('正在删除技能...').start();

  try {
    await deletePackage({
      type: 'skill',
      apiUrl: options.apiUrl,
      accessToken: options.accessToken,
      id: skillId,
    });
    spinner.succeed('技能删除成功');

    console.log();
    console.log(chalk.green(`✓ 已删除技能: ${skillId}`));
    console.log();
  } catch (error: any) {
    spinner.fail('删除失败');
    throw error;
  }
}

/**
 * 删除应用
 */
export async function deleteAppCommand(appId: string, options: DeleteCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n删除应用\n'));
  console.log(chalk.gray('应用 ID:'), appId);
  console.log(chalk.gray('服务器:'), options.apiUrl);
  console.log();

  const spinner = ora('正在删除应用...').start();

  try {
    await deletePackage({
      type: 'app',
      apiUrl: options.apiUrl,
      accessToken: options.accessToken,
      id: appId,
    });
    spinner.succeed('应用删除成功');

    console.log();
    console.log(chalk.green(`✓ 已删除应用: ${appId}`));
    console.log();
  } catch (error: any) {
    spinner.fail('删除失败');
    throw error;
  }
}

// ============================================================
// 分类管理
// ============================================================

/**
 * 列出所有分类
 */
export async function listCategoriesCommand(apiUrl: string): Promise<void> {
  console.log(chalk.cyan('\n分类列表\n'));

  const spinner = ora('获取分类列表...').start();

  try {
    const categories = await listCategories(apiUrl);
    spinner.succeed(`找到 ${categories.length} 个分类`);

    if (categories.length === 0) {
      console.log(chalk.yellow('暂无分类'));
      return;
    }

    console.log();
    console.log(chalk.gray('  Slug                 名称            图标  父分类'));
    console.log(chalk.gray('  ' + '-'.repeat(60)));

    for (const cat of categories) {
      const icon = cat.icon || '-';
      const parent = cat.parent_slug || '-';
      console.log(`  ${cat.slug.padEnd(20)} ${cat.name.padEnd(15)} ${icon.padEnd(5)} ${parent}`);
    }
    console.log();
  } catch (error: any) {
    spinner.fail('获取分类列表失败');
    throw error;
  }
}

/**
 * 创建分类
 */
export async function createCategoryCommand(options: {
  apiUrl: string;
  accessToken: string;
  slug: string;
  name: string;
  icon?: string;
  parentSlug?: string;
  sortOrder?: number;
}): Promise<void> {
  console.log(chalk.cyan('\n创建分类\n'));
  console.log(chalk.gray('标识:'), options.slug);
  console.log(chalk.gray('名称:'), options.name);
  if (options.icon) {
    console.log(chalk.gray('图标:'), options.icon);
  }
  if (options.parentSlug) {
    console.log(chalk.gray('父分类:'), options.parentSlug);
  }
  console.log();

  const spinner = ora('创建分类...').start();

  try {
    await createCategory({
      apiUrl: options.apiUrl,
      accessToken: options.accessToken,
      slug: options.slug,
      name: options.name,
      icon: options.icon,
      parent_slug: options.parentSlug,
      sort_order: options.sortOrder || 0,
    });

    spinner.succeed('分类创建成功');
    console.log();
    console.log(chalk.green(`✓ 标识: ${options.slug}`));
    console.log(chalk.green(`✓ 名称: ${options.name}`));
    console.log();
  } catch (error: any) {
    spinner.fail('创建分类失败');
    throw error;
  }
}
