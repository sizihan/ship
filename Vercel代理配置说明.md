# Vercel 代理配置说明

## ✅ 已完成的配置

### 1. Vercel 代理配置 (`vercel.json`)

```json
{
  "rewrites": [
    {
      "source": "/api/backend/:path*",
      "destination": "http://8.148.177.179:5000/api/:path*"
    }
  ]
}
```

**工作原理：**
- 当前端访问 `/api/backend/health` 时
- Vercel 会自动将请求转发到 `http://8.148.177.179:5000/api/health`
- 这样前端使用 HTTPS，但通过 Vercel 服务器访问 HTTP 后端，避免混合内容问题

### 2. 前端代码配置 (`src/services/api.js`)

```javascript
// 生产环境使用相对路径，通过 Vercel 代理
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '/api/backend' : 'http://localhost:5000/api');
```

**工作原理：**
- **开发环境** (`npm run dev`): 直接连接 `http://localhost:5000/api`
- **生产环境** (Vercel): 使用相对路径 `/api/backend`，由 Vercel 代理转发

## 🔄 请求流程

### 开发环境
```
前端 (localhost:3000) 
  → http://localhost:5000/api/health
  → 本地后端
```

### 生产环境（Vercel）
```
前端 (https://ship-steel.vercel.app/)
  → /api/backend/health (相对路径)
  → Vercel 代理服务器
  → http://8.148.177.179:5000/api/health
  → 阿里云后端
```

## 🚀 部署步骤

### 1. 提交代码到 GitHub

```bash
cd frontend
git add .
git commit -m "配置 Vercel 代理解决混合内容问题"
git push origin main
```

### 2. Vercel 自动部署

- Vercel 会自动检测到 GitHub 推送
- 自动重新构建和部署
- 部署完成后，代理配置会自动生效

### 3. 验证连接

1. 打开 https://ship-steel.vercel.app/
2. 按 F12 打开开发者工具
3. 查看 Console，应该看到：
   ```
   🔧 API 配置信息:
     - API_BASE_URL: /api/backend
     - 当前环境: production
   ```
4. 查看 Network 标签，API 请求应该成功

## 📝 重要提示

### ✅ 优势

1. **解决混合内容问题**: HTTPS 前端通过 Vercel 代理访问 HTTP 后端
2. **无需修改后端**: 后端保持 HTTP 即可
3. **配置简单**: 只需一个 `vercel.json` 文件
4. **自动部署**: Vercel 自动处理代理配置

### ⚠️ 注意事项

1. **后端 IP 变更**: 如果后端 IP 改变，需要修改 `vercel.json` 中的 `destination`
2. **环境变量**: 如果后端地址经常变化，可以考虑使用环境变量（但 Vercel rewrites 不支持环境变量）
3. **CORS 配置**: 后端已经配置了 CORS，允许所有来源（`CORS(app)`）

## 🔧 如果后端 IP 改变

修改 `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/backend/:path*",
      "destination": "http://新IP:5000/api/:path*"
    }
  ]
}
```

然后提交并推送到 GitHub，Vercel 会自动重新部署。

## 🎯 测试清单

- [ ] `vercel.json` 文件存在且配置正确
- [ ] 前端代码已修改为使用相对路径
- [ ] 代码已推送到 GitHub
- [ ] Vercel 自动部署完成
- [ ] 浏览器控制台显示 API_BASE_URL 为 `/api/backend`
- [ ] API 请求成功，不再有混合内容错误

## 📞 故障排查

### 如果仍然看到混合内容错误

1. 确认代码已推送并部署完成
2. 清除浏览器缓存并强制刷新 (Ctrl+F5)
3. 检查浏览器控制台的 API_BASE_URL 是否为 `/api/backend`

### 如果看到 404 错误

1. 检查 `vercel.json` 配置是否正确
2. 确认后端服务正在运行: `http://8.148.177.179:5000/api/health`
3. 检查后端 IP 地址是否正确

### 如果看到网络错误

1. 检查后端服务是否正常运行
2. 检查阿里云安全组是否开放 5000 端口
3. 检查后端日志是否有错误

