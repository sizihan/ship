/**
 * 性能监控工具
 * 用于监控帧率和性能指标，确保达到30fps要求
 */
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fps = 0;
    this.frameTimes = [];
    this.maxFrameTimeHistory = 60; // 保留最近60帧的时间
    this.isMonitoring = false;
    
    // 性能统计
    this.stats = {
      minFps: Infinity,
      maxFps: 0,
      avgFps: 0,
      frameCount: 0,
      totalTime: 0
    };
  }

  /**
   * 开始监控
   */
  start() {
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.frameTimes = [];
    this.stats = {
      minFps: Infinity,
      maxFps: 0,
      avgFps: 0,
      frameCount: 0,
      totalTime: 0
    };
  }

  /**
   * 停止监控
   */
  stop() {
    this.isMonitoring = false;
  }

  /**
   * 记录一帧
   * @param {number} frameTime - 帧时间（毫秒）
   */
  recordFrame(frameTime) {
    if (!this.isMonitoring) return;

    this.frameCount++;
    this.frameTimes.push(frameTime);
    
    // 保持最近N帧的历史
    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift();
    }

    // 计算当前FPS
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;
    
    if (elapsed >= 1000) { // 每秒更新一次FPS
      const currentFps = this.frameCount / (elapsed / 1000);
      this.fps = currentFps;
      
      // 更新统计
      if (currentFps < this.stats.minFps) {
        this.stats.minFps = currentFps;
      }
      if (currentFps > this.stats.maxFps) {
        this.stats.maxFps = currentFps;
      }
      
      this.stats.totalTime += elapsed;
      this.stats.frameCount += this.frameCount;
      this.stats.avgFps = (this.stats.frameCount / (this.stats.totalTime / 1000));
      
      // 重置计数器
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      
      // 如果FPS低于30，输出警告
      if (currentFps < 30 && currentFps > 0) {
        console.warn(`性能警告: 当前FPS ${currentFps.toFixed(2)} < 30fps`);
      }
    }
  }

  /**
   * 获取当前FPS
   * @returns {number} 当前FPS
   */
  getFps() {
    return this.fps;
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计信息
   */
  getStats() {
    const avgFrameTime = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;
    
    return {
      ...this.stats,
      currentFps: this.fps,
      avgFrameTime: avgFrameTime,
      minFrameTime: this.frameTimes.length > 0 ? Math.min(...this.frameTimes) : 0,
      maxFrameTime: this.frameTimes.length > 0 ? Math.max(...this.frameTimes) : 0
    };
  }

  /**
   * 检查性能是否达标（>=30fps）
   * @returns {boolean} 是否达标
   */
  isPerformanceAcceptable() {
    return this.fps >= 30 || this.fps === 0;
  }
}

export default PerformanceMonitor;
