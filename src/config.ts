import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as os from 'os';

export interface Config {
  remote?: {
    api_url?: string;
    api_key?: string;      // LLM API Key（用于发布）
    access_token?: string; // JWT Token（用于管理操作）
  };
}

/**
 * 加载配置文件
 * 优先级: .cfm.yaml (当前目录) > ~/.cfm/config.yaml
 */
export function loadConfig(): Config {
  const configPaths = [
    path.join(process.cwd(), '.cfm.yaml'),
    path.join(os.homedir(), '.cfm', 'config.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.load(content) as Config;
        return config || {};
      } catch (error) {
        // 忽略解析错误
      }
    }
  }

  return {};
}

/**
 * 保存配置到用户目录
 */
export function saveConfig(config: Config): void {
  const configDir = path.join(os.homedir(), '.cfm');
  const configPath = path.join(configDir, 'config.yaml');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const content = yaml.dump(config);
  fs.writeFileSync(configPath, content, 'utf-8');
}
