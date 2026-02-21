import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// 排除的文件和目录
const EXCLUDED_PATTERNS = new Set([
  '.git',
  '.gitignore',
  '.DS_Store',
  '__pycache__',
  '.pyc',
  '.env',
  '.venv',
  'node_modules',
  '.idea',
  '.vscode',
  'dist',
  'build',
]);

/**
 * 创建 ZIP 包
 */
export async function createPackage(dirPath: string): Promise<Buffer> {
  const absPath = path.resolve(dirPath);
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    
    passthrough.on('data', (chunk) => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(passthrough);

    // 递归添加文件
    addFilesToArchive(archive, absPath, '');

    archive.finalize();
  });
}

/**
 * 递归添加文件到归档
 */
function addFilesToArchive(archive: archiver.Archiver, basePath: string, relativePath: string): void {
  const currentPath = path.join(basePath, relativePath);
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    // 检查是否应该排除
    if (shouldExclude(entry.name)) {
      continue;
    }

    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
    const entryFullPath = path.join(basePath, entryRelativePath);

    if (entry.isDirectory()) {
      addFilesToArchive(archive, basePath, entryRelativePath);
    } else if (entry.isFile()) {
      archive.file(entryFullPath, { name: entryRelativePath });
    }
  }
}

/**
 * 判断是否应该排除
 */
function shouldExclude(name: string): boolean {
  if (EXCLUDED_PATTERNS.has(name)) {
    return true;
  }
  // 检查通配符模式
  if (name.endsWith('.egg-info') || name.endsWith('.pyc')) {
    return true;
  }
  return false;
}
