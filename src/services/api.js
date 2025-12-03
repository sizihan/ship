import axios from 'axios';

// 使用环境变量，如果不存在则使用默认值
// 开发环境: 使用 .env.development 中的 VITE_API_BASE_URL
// 生产环境: 使用 .env.production 中的 VITE_API_BASE_URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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
    console.log('API请求:', config.method?.toUpperCase(), config.url);
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
    console.log('API响应:', response.config?.url, response.status);
    return response;
  },
  (error) => {
    console.error('响应错误:', error.config?.url, error.message);
    if (error.response) {
      console.error('错误详情:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('请求已发送但没有收到响应:', error.request);
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