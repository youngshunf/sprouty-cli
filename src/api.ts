import fetch from 'node-fetch';
import FormData from 'form-data';

export interface UploadOptions {
  type: 'skill' | 'app';
  apiUrl: string;
  apiKey: string;
  packageBuffer: Buffer;
  version?: string;
  changelog?: string;
}

export interface UploadResult {
  id: string;
  version: string;
  package_url: string;
  file_hash: string;
  file_size: number;
}

/**
 * 上传包到服务器
 */
export async function uploadPackage(options: UploadOptions): Promise<UploadResult> {
  const { type, apiUrl, apiKey, packageBuffer, version, changelog } = options;

  // 构建 URL
  const endpoint = type === 'skill' 
    ? `${apiUrl}/api/v1/marketplace/publish/skill`
    : `${apiUrl}/api/v1/marketplace/publish/app`;

  // 构建表单数据
  const form = new FormData();
  form.append('file', packageBuffer, {
    filename: `package.zip`,
    contentType: 'application/zip',
  });
  
  if (version) {
    form.append('version', version);
  }
  if (changelog) {
    form.append('changelog', changelog);
  }

  // 发送请求
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      ...form.getHeaders(),
    },
    body: form,
  });

  // 解析响应
  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return result.data;
}

/**
 * 检查 API 连接
 */
export async function checkConnection(apiUrl: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/marketplace/client/skills?size=1`, {
      headers: { 'X-API-Key': apiKey },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface LoginOptions {
  apiUrl: string;
  username: string;
  password: string;
  captcha?: string;
  captchaKey?: string;
}

export interface LoginResult {
  access_token: string;
  llm_token: string | null;
  user: {
    id: number;
    username: string;
    nickname: string;
  };
}

/**
 * 用户登录
 */
export async function login(options: LoginOptions): Promise<LoginResult> {
  const { apiUrl, username, password, captcha, captchaKey } = options;

  const body: any = { username, password };
  if (captcha && captchaKey) {
    body.captcha = captcha;
    body.captcha_key = captchaKey;
  }

  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    access_token: result.data.access_token,
    llm_token: result.data.llm_token,
    user: result.data.user,
  };
}

/**
 * 获取验证码
 */
export async function getCaptcha(apiUrl: string): Promise<{ image: string; captcha_key: string } | null> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/captcha`);
    const result = await response.json() as any;
    if (result.code === 200 && result.data) {
      return {
        image: result.data.image,
        captcha_key: result.data.captcha_key,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// 删除相关接口
// ============================================================

export interface DeleteOptions {
  type: 'skill' | 'app';
  apiUrl: string;
  accessToken: string;
  id: string; // skill_id 或 app_id（字符串标识符）
}

/**
 * 通过标识符查询数据库 pk
 */
async function getPackagePk(apiUrl: string, type: 'skill' | 'app', id: string): Promise<number> {
  const endpoint = type === 'skill'
    ? `${apiUrl}/api/v1/marketplace/client/skills/${id}`
    : `${apiUrl}/api/v1/marketplace/client/apps/${id}`;

  const response = await fetch(endpoint);
  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return result.data.id;
}

/**
 * 删除技能或应用
 */
export async function deletePackage(options: DeleteOptions): Promise<void> {
  const { type, apiUrl, accessToken, id } = options;

  // 先通过标识符查询数据库 pk
  const pk = await getPackagePk(apiUrl, type, id);

  const endpoint = type === 'skill'
    ? `${apiUrl}/api/v1/marketplace/skills/${pk}`
    : `${apiUrl}/api/v1/marketplace/apps/${pk}`;

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
}

// ============================================================
// Category 相关接口
// ============================================================

export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  parent_slug: string | null;
  sort_order: number;
  created_time: string;
  updated_time: string | null;
}

export interface CreateCategoryOptions {
  apiUrl: string;
  accessToken: string;  // JWT token
  slug: string;
  name: string;
  icon?: string;
  parent_slug?: string;
  sort_order?: number;
}

/**
 * 获取分类列表（公开接口）
 */
export async function listCategories(apiUrl: string): Promise<Category[]> {
  const response = await fetch(`${apiUrl}/api/v1/marketplace/client/categories`);
  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return result.data;
}

/**
 * 创建分类（需要认证）
 */
export async function createCategory(options: CreateCategoryOptions): Promise<void> {
  const { apiUrl, accessToken, ...body } = options;

  const response = await fetch(`${apiUrl}/api/v1/marketplace/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json() as any;

  if (!response.ok || result.code !== 200) {
    const errorMsg = result.msg || result.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
}
