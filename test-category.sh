#!/bin/bash

# CFM-CLI Category 命令测试脚本

echo "=========================================="
echo "CFM-CLI Category 命令测试"
echo "=========================================="
echo ""

# 1. 测试帮助命令
echo "1. 测试帮助命令"
echo "----------------------------------------"
node dist/cli.js category --help
echo ""

# 2. 测试 list 子命令帮助
echo "2. 测试 list 子命令帮助"
echo "----------------------------------------"
node dist/cli.js category list --help
echo ""

# 3. 测试 create 子命令帮助
echo "3. 测试 create 子命令帮助"
echo "----------------------------------------"
node dist/cli.js category create --help
echo ""

# 4. 测试配置显示
echo "4. 测试配置显示"
echo "----------------------------------------"
node dist/cli.js config
echo ""

# 5. 测试 list 命令（需要后端服务运行）
echo "5. 测试 list 命令（如果后端服务未运行会失败）"
echo "----------------------------------------"
node dist/cli.js category list --api-url http://localhost:8020 || echo "后端服务未运行，跳过"
echo ""

# 6. 测试未登录时创建分类（应该失败）
echo "6. 测试未登录时创建分类（应该提示需要登录）"
echo "----------------------------------------"
node dist/cli.js logout 2>/dev/null
node dist/cli.js category create test-category "测试分类" --api-url http://localhost:8020 || echo "预期失败：需要登录"
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
