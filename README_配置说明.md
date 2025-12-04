# 前端配置说明

## 📍 API 地址配置

### 本地开发环境

1. 创建 `frontend/.env.development` 文件：
```bash
VITE_API_BASE_URL=http://localhost:5000/api
```

2. 启动开发服务器：
```bash
npm run dev
```

### 生产环境（Vercel）

#### 方法一：在 Vercel 控制台配置（推荐）

1. 登录 [Vercel 控制台](https://vercel.com)
2. 进入你的项目
3. 点击 **Settings** → **Environment Variables**
4. 添加环境变量：
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `http://你的阿里云IP:5000/api` 或 `https://你的域名/api`
   - **Environment**: 选择 `Production`（或全部）
5. 保存后，重新部署项目

#### 方法二：使用 .env.production 文件

1. 创建 `frontend/.env.production` 文件：
```bash
VITE_API_BASE_URL=http://你的阿里云IP:5000/api
```

2. **注意**：`.env.production` 文件包含敏感信息，不要上传到 GitHub！
   - 确保 `.gitignore` 中包含 `.env.production`

## 🔍 测试后端连接

### 1. 测试后端根路径
直接在浏览器访问：
```
http://你的阿里云IP:5000/
```
应该看到 JSON 响应，显示服务状态。

### 2. 测试健康检查端点
访问：
```
http://你的阿里云IP:5000/api/health
```
应该返回：
```json
{
  "status": "healthy",
  "message": "船舶可视化后端服务运行正常",
  ...
}
```

### 3. 检查前端连接
- 打开浏览器控制台（F12）
- 查看 Network 标签，查看 API 请求
- 查看 Console 标签，查看调试日志

## ⚠️ 常见问题

### 问题 1: 直接访问 IP:5000 显示 "Not Found"
✅ **正常！** 后端服务正在运行，但根路径现在会返回服务信息。
- 测试请访问：`http://IP:5000/api/health`
- 或者访问根路径：`http://IP:5000/`（已添加服务信息）

### 问题 2: Vercel 显示 "后端服务连接失败"
可能原因：
1. **环境变量未配置**：在 Vercel 控制台添加 `VITE_API_BASE_URL`
2. **后端地址错误**：确认 IP 地址和端口正确
3. **防火墙阻止**：检查阿里云安全组是否开放 5000 端口
4. **HTTPS/HTTP 混合内容**：Vercel 是 HTTPS，后端如果是 HTTP 可能被阻止

### 问题 3: CORS 跨域错误
后端已经配置了 CORS，如果仍有问题：
- 检查后端 CORS 配置
- 检查浏览器控制台的具体错误信息

## 📝 环境变量格式

### HTTP 格式
```bash
VITE_API_BASE_URL=http://47.xxx.xxx.xxx:5000/api
```

### HTTPS 格式（推荐生产环境）
```bash
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

## 🔐 安全提示

1. **不要**将 `.env.production` 文件提交到 GitHub
2. 生产环境建议使用 HTTPS
3. 在 Vercel 使用环境变量配置，而不是提交 .env 文件

