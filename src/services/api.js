import axios from 'axios';

// 使用环境变量，如果不存在则使用默认值
// 开发环境: 使用 .env.development 中的 VITE_API_BASE_URL（本地开发）
// 生产环境: 强制使用相对路径通过 Vercel 代理访问后端（解决混合内容问题）
// 
// 工作原理：
// - 开发环境: 直接连接本地后端 http://localhost:5000/api
// - 生产环境: 强制使用相对路径 /api/backend，通过 vercel.json 中的 rewrites 代理到后端
// 注意: 生产环境强制使用代理路径，忽略环境变量中的绝对路径，避免混合内容问题
const API_BASE_URL = import.meta.env.PROD 
  ? '/api/backend'  // 生产环境强制使用 Vercel 代理
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

// 打印 API 配置信息（开发和生产环境都打印，方便调试）
console.log('🔧 API 配置信息:');
console.log('  - API_BASE_URL:', API_BASE_URL);
console.log('  - 环境变量 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '(未设置)');
console.log('  - 当前环境:', import.meta.env.MODE);
console.log('  - 是否为生产环境:', import.meta.env.PROD);
console.log('  - 当前域名:', window.location.origin);

// 创建axios实例，添加更多配置
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const fullUrl = config.baseURL + config.url;
    console.log('📤 API请求:', config.method?.toUpperCase(), fullUrl);
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    const fullUrl = response.config.baseURL + response.config.url;
    console.log('✅ API响应成功:', fullUrl, response.status);
    return response;
  },
  (error) => {
    const fullUrl = error.config ? (error.config.baseURL + error.config.url) : '未知URL';
    console.error('❌ API响应错误:', fullUrl);
    console.error('   错误消息:', error.message);
    
    if (error.response) {
      // 服务器返回了响应，但状态码不是 2xx
      console.error('   状态码:', error.response.status);
      console.error('   响应数据:', error.response.data);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('   ⚠️ 请求已发送但没有收到响应');
      console.error('   可能的原因:');
      console.error('     1. 后端服务未运行');
      console.error('     2. 网络连接问题');
      console.error('     3. 防火墙阻止');
      console.error('     4. CORS 跨域问题');
      console.error('     5. 混合内容问题 (HTTPS 访问 HTTP)');
      
      // 检查是否是混合内容问题
      const currentProtocol = window.location.protocol;
      const apiProtocol = error.config?.baseURL?.split(':')[0];
      if (currentProtocol === 'https:' && apiProtocol === 'http') {
        console.error('   🚨 检测到混合内容问题!');
        console.error('     HTTPS 页面无法访问 HTTP API');
        console.error('     解决方案: 后端需要使用 HTTPS 或使用代理');
      }
    } else {
      console.error('   请求配置错误:', error.message);
    }
    return Promise.reject(error);
  }
);

export const shipAPI = {
  // 上传CSV文件
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // 上传文件时不要设置Content-Type，让浏览器自动处理
    return apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`文件上传进度: ${percentCompleted}%`);
      }
    });
  },
  
  // 获取CSV文件列表
  getFiles: () => {
    return apiClient.get('/files');
  },
  
  // 读取CSV数据
  getCSVData: (filename) => {
    return apiClient.get(`/data/${filename}`);
  },
  
  // 健康检查
  healthCheck: () => {
    return apiClient.get('/health');
  },
  


};