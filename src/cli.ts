#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { publishSkill, publishApp, validateSkill, validateApp, deleteSkillCommand, deleteAppCommand, loginUser, listCategoriesCommand, createCategoryCommand } from './commands';
import { loadConfig, saveConfig } from './config';

const program = new Command();

program
  .name('cfm')
  .description('CreatorFlow Marketplace CLI - 发布技能和应用到市场')
  .version('1.0.0');

// 技能命令组
const skillCmd = program
  .command('skill')
  .description('技能管理命令');

skillCmd
  .command('validate <path>')
  .description('验证技能包结构')
  .action(async (path: string) => {
    try {
      await validateSkill(path);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('publish <path>')
  .description('发布技能到市场')
  .option('-b, --bump <type>', '版本递增: patch, minor, major')
  .option('-v, --version <version>', '指定版本号')
  .option('-c, --changelog <text>', '更新日志')
  .option('--api-url <url>', 'API 服务器地址')
  .option('--api-key <key>', 'API Key')
  .action(async (path: string, options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url;
      const apiKey = options.apiKey || config.remote?.api_key;

      if (!apiUrl) {
        console.error(chalk.red('错误: 需要 --api-url 或在配置文件中设置 remote.api_url'));
        console.log(chalk.gray('配置文件位置: ~/.cfm/config.yaml 或 .cfm.yaml'));
        process.exit(1);
      }
      if (!apiKey) {
        console.error(chalk.red('错误: 未配置 API Key'));
        console.log(chalk.yellow('请先运行 "cfm login" 登录获取 API Key'));
        process.exit(1);
      }

      await publishSkill(path, { apiUrl, apiKey, ...options });
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('delete <id>')
  .description('从市场删除技能')
  .option('--api-url <url>', 'API 服务器地址')
  .action(async (id: string, options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url;
      const accessToken = config.remote?.access_token;

      if (!apiUrl) {
        console.error(chalk.red('错误: 需要 --api-url 或在配置文件中设置 remote.api_url'));
        process.exit(1);
      }
      if (!accessToken) {
        console.error(chalk.red('错误: 未登录'));
        console.log(chalk.yellow('请先运行 "cfm login" 登录'));
        process.exit(1);
      }

      await deleteSkillCommand(id, { apiUrl, accessToken });
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

// 应用命令组
const appCmd = program
  .command('app')
  .description('应用管理命令');

appCmd
  .command('validate <path>')
  .description('验证应用包结构')
  .action(async (path: string) => {
    try {
      await validateApp(path);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

appCmd
  .command('publish <path>')
  .description('发布应用到市场')
  .option('-b, --bump <type>', '版本递增: patch, minor, major')
  .option('-v, --version <version>', '指定版本号')
  .option('-c, --changelog <text>', '更新日志')
  .option('--api-url <url>', 'API 服务器地址')
  .option('--api-key <key>', 'API Key')
  .action(async (path: string, options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url;
      const apiKey = options.apiKey || config.remote?.api_key;

      if (!apiUrl) {
        console.error(chalk.red('错误: 需要 --api-url 或在配置文件中设置 remote.api_url'));
        console.log(chalk.gray('配置文件位置: ~/.cfm/config.yaml 或 .cfm.yaml'));
        process.exit(1);
      }
      if (!apiKey) {
        console.error(chalk.red('错误: 未配置 API Key'));
        console.log(chalk.yellow('请先运行 "cfm login" 登录获取 API Key'));
        process.exit(1);
      }

      await publishApp(path, { apiUrl, apiKey, ...options });
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

appCmd
  .command('delete <id>')
  .description('从市场删除应用')
  .option('--api-url <url>', 'API 服务器地址')
  .action(async (id: string, options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url;
      const accessToken = config.remote?.access_token;

      if (!apiUrl) {
        console.error(chalk.red('错误: 需要 --api-url 或在配置文件中设置 remote.api_url'));
        process.exit(1);
      }
      if (!accessToken) {
        console.error(chalk.red('错误: 未登录'));
        console.log(chalk.yellow('请先运行 "cfm login" 登录'));
        process.exit(1);
      }

      await deleteAppCommand(id, { apiUrl, accessToken });
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

// 登录命令
program
  .command('login')
  .description('登录并获取 API Key')
  .option('--api-url <url>', 'API 服务器地址')
  .option('-u, --username <username>', '用户名')
  .option('-p, --password <password>', '密码')
  .action(async (options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url || 'http://localhost:8020';

      let username = options.username;
      let password = options.password;

      // 如果未提供用户名或密码，交互式输入
      if (!username || !password) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const question = (prompt: string): Promise<string> => {
          return new Promise((resolve) => rl.question(prompt, resolve));
        };

        console.log(chalk.cyan('\n=== CreatorFlow Marketplace 登录 ===\n'));
        console.log(chalk.gray(`服务器: ${apiUrl}\n`));

        if (!username) {
          username = await question(chalk.white('用户名: '));
        }
        if (!password) {
          password = await question(chalk.white('密码: '));
        }

        rl.close();
        console.log();
      }

      await loginUser(apiUrl, username, password);
    } catch (error: any) {
      console.error(chalk.red(`\n登录失败: ${error.message}`));
      process.exit(1);
    }
  });

// 登出命令
program
  .command('logout')
  .description('清除已保存的 API Key')
  .action(() => {
    const config = loadConfig();
    if (config.remote) {
      delete config.remote.api_key;
      delete config.remote.access_token;
      saveConfig(config);
      console.log(chalk.green('已清除 API Key 和 Access Token'));
    } else {
      console.log(chalk.yellow('未配置 API Key'));
    }
  });

// 配置命令
program
  .command('config')
  .description('显示当前配置')
  .option('--set-url <url>', '设置 API 服务器地址')
  .action((options: any) => {
    const config = loadConfig();

    if (options.setUrl) {
      config.remote = config.remote || {};
      config.remote.api_url = options.setUrl;
      saveConfig(config);
      console.log(chalk.green(`已设置 API URL: ${options.setUrl}`));
      return;
    }

    console.log(chalk.cyan('\n当前配置:\n'));
    console.log(chalk.gray('  API URL:'), config.remote?.api_url || chalk.yellow('未设置'));
    console.log(chalk.gray('  API Key:'), config.remote?.api_key ? chalk.green('已设置') : chalk.yellow('未设置'));
    console.log(chalk.gray('  Access Token:'), config.remote?.access_token ? chalk.green('已设置') : chalk.yellow('未设置'));
    console.log();
  });

// 分类命令组
const categoryCmd = program
  .command('category')
  .description('分类管理命令');

categoryCmd
  .command('list')
  .description('列出所有分类')
  .option('--api-url <url>', 'API 服务器地址')
  .action(async (options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url || 'http://localhost:8020';

      await listCategoriesCommand(apiUrl);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

categoryCmd
  .command('create <slug> <name>')
  .description('创建新分类')
  .option('-i, --icon <emoji>', 'emoji 图标（如 📝）')
  .option('-p, --parent <slug>', '父分类标识')
  .option('-o, --order <number>', '排序顺序', '0')
  .option('--api-url <url>', 'API 服务器地址')
  .action(async (slug: string, name: string, options: any) => {
    try {
      const config = loadConfig();
      const apiUrl = options.apiUrl || config.remote?.api_url || 'http://localhost:8020';
      const accessToken = config.remote?.access_token;

      if (!accessToken) {
        console.error(chalk.red('错误: 未登录'));
        console.log(chalk.yellow('请先运行 "cfm login" 登录'));
        process.exit(1);
      }

      await createCategoryCommand({
        apiUrl,
        accessToken,
        slug,
        name,
        icon: options.icon,
        parentSlug: options.parent,
        sortOrder: parseInt(options.order, 10),
      });
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
