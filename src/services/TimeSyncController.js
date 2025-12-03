/**
 * 统一时间轴管理器
 * 职责：统一管理所有船只的时间轴，过滤未到时间/已结束的船只
 */
class TimeSyncController {
  constructor() {
    this.globalStartTime = null; // 全局最早开始时间
    this.globalEndTime = null; // 全局最晚结束时间
    this.currentTime = null; // 当前播放时间
    this.isPlaying = false; // 播放状态
    this.speed = 1; // 播放速度倍数
    this.baseTimeRatio = 300; // 基础时间比例（现实1秒=船舶移动5分钟=300秒）
    this.mode = 'multi'; // 模式：'multi' | 'single'
    this.selectedShipId = null; // 单船只模式下选中的船只MMSI
    
    // 存储所有船只的时间信息：Map<mmsi, {startTime, endTime}>
    this.ships = new Map();
  }

  /**
   * 初始化所有船只，计算全局时间范围（增强边界处理）
   * @param {Object} shipGroups - 船只分组数据 {mmsi: {data: [...], ...}}
   * @param {Object} globalTimeRange - 全局时间范围 {start_time: string, end_time: string}
   */
  initializeShips(shipGroups, globalTimeRange = null) {
    // 清空现有数据
    this.ships.clear();
    
    // 边界处理：验证输入
    if (!shipGroups || typeof shipGroups !== 'object') {
      console.warn('TimeSyncController: 无效的船只数据');
      return;
    }
    
    // 初始化所有船只的时间范围
    let validShips = 0;
    for (const [mmsi, shipGroup] of Object.entries(shipGroups)) {
      if (!shipGroup || !shipGroup.data) {
        continue;
      }

      const trajectory = shipGroup.data || [];
      
      if (!Array.isArray(trajectory) || trajectory.length === 0) {
        continue;
      }

      // 查找有有效时间戳的点（边界处理：时间戳格式异常）
      const validPoints = trajectory.filter(point => {
        if (!point || !point.postime) return false;
        try {
          const time = this.parseTime(point.postime);
          return time !== null && !isNaN(time.getTime());
        } catch (e) {
          return false;
        }
      });

      if (validPoints.length === 0) {
        console.warn(`船只 ${mmsi} 没有有效的时间戳数据`);
        continue;
      }

      // 计算船只的开始和结束时间（边界处理：处理时间计算异常）
      try {
        const times = validPoints
          .map(point => this.parseTime(point.postime))
          .filter(t => t !== null && !isNaN(t.getTime()));
        
        if (times.length === 0) {
          continue;
        }

        let startTime = new Date(Math.min(...times));
        let endTime = new Date(Math.max(...times));

        // 验证时间有效性
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          console.warn(`船只 ${mmsi} 时间范围无效`);
          continue;
        }

        // 验证时间范围合理性
        if (startTime > endTime) {
          console.warn(`船只 ${mmsi} 开始时间晚于结束时间，交换它们`);
          [startTime, endTime] = [endTime, startTime];
        }

        this.ships.set(mmsi, {
          startTime,
          endTime
        });
        validShips++;
      } catch (e) {
        console.error(`船只 ${mmsi} 时间范围计算失败:`, e);
      }
    }
    
    console.log(`TimeSyncController: 成功初始化 ${validShips} 艘船的时间范围`);

    // 设置全局时间范围
    if (globalTimeRange && globalTimeRange.start_time && globalTimeRange.end_time) {
      this.globalStartTime = new Date(globalTimeRange.start_time);
      this.globalEndTime = new Date(globalTimeRange.end_time);
    } else {
      // 如果没有提供全局时间范围，从所有船只中计算
      if (this.ships.size > 0) {
        const allStartTimes = Array.from(this.ships.values()).map(s => s.startTime);
        const allEndTimes = Array.from(this.ships.values()).map(s => s.endTime);
        this.globalStartTime = new Date(Math.min(...allStartTimes));
        this.globalEndTime = new Date(Math.max(...allEndTimes));
      }
    }

    // 初始化当前时间
    if (this.globalStartTime) {
      this.currentTime = new Date(this.globalStartTime);
    }

    console.log(`TimeSyncController初始化完成: ${this.ships.size}艘船, 时间范围: ${this.globalStartTime} ~ ${this.globalEndTime}`);
  }

  /**
   * 解析时间字符串为Date对象
   * @param {string|Date} timeStr - 时间字符串或Date对象
   * @returns {Date|null} Date对象或null
   */
  parseTime(timeStr) {
    if (!timeStr) return null;
    
    // 如果已经是Date对象
    if (timeStr instanceof Date) {
      return isNaN(timeStr.getTime()) ? null : timeStr;
    }

    // 尝试解析ISO格式字符串
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      // 解析失败
    }

    return null;
  }

  /**
   * 获取指定时间点活跃的船只列表（排除未开始和已结束的）
   * @param {Date|string} currentTime - 当前时间
   * @returns {Array<string>} 活跃船只的MMSI列表
   */
  getActiveShipsAtTime(currentTime) {
    const activeShips = [];
    
    // 解析当前时间
    const time = currentTime instanceof Date ? currentTime : this.parseTime(currentTime);
    if (!time) {
      return activeShips;
    }

    for (const [mmsi, shipData] of this.ships.entries()) {
      // 船只未开始：不显示
      if (time < shipData.startTime) {
        continue;
      }
      
      // 船只已结束：消失（不显示）
      if (time > shipData.endTime) {
        continue;
      }
      
      // 在时间范围内的船只：显示
      activeShips.push(mmsi);
    }

    return activeShips;
  }

  /**
   * 更新时间，触发船只状态更新
   * @param {Date|string} newTime - 新时间
   */
  updateTime(newTime) {
    const time = newTime instanceof Date ? newTime : this.parseTime(newTime);
    if (time) {
      this.currentTime = time;
      
      // 确保时间在有效范围内
      if (this.globalStartTime && time < this.globalStartTime) {
        this.currentTime = new Date(this.globalStartTime);
      } else if (this.globalEndTime && time > this.globalEndTime) {
        this.currentTime = new Date(this.globalEndTime);
      }
    }
  }

  /**
   * 切换模式
   * @param {string} mode - 模式：'multi' | 'single'
   * @param {string|null} selectedShipId - 单船只模式下选中的船只MMSI
   */
  setMode(mode, selectedShipId = null) {
    this.mode = mode;
    this.selectedShipId = selectedShipId;
  }

  /**
   * 设置播放状态
   * @param {boolean} isPlaying - 是否播放
   */
  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
  }

  /**
   * 设置播放速度
   * @param {number} speed - 播放速度倍数
   */
  setSpeed(speed) {
    this.speed = speed;
  }

  /**
   * 重置到开始时间
   */
  reset() {
    if (this.globalStartTime) {
      this.currentTime = new Date(this.globalStartTime);
    }
    this.isPlaying = false;
  }

  /**
   * 获取当前时间
   * @returns {Date|null}
   */
  getCurrentTime() {
    return this.currentTime;
  }

  /**
   * 获取全局时间范围
   * @returns {Object} {startTime: Date, endTime: Date}
   */
  getGlobalTimeRange() {
    return {
      startTime: this.globalStartTime,
      endTime: this.globalEndTime
    };
  }

  /**
   * 检查是否到达结束时间
   * @returns {boolean}
   */
  isAtEnd() {
    if (!this.currentTime || !this.globalEndTime) {
      return false;
    }
    return this.currentTime >= this.globalEndTime;
  }

  /**
   * 检查是否在开始时间
   * @returns {boolean}
   */
  isAtStart() {
    if (!this.currentTime || !this.globalStartTime) {
      return false;
    }
    return this.currentTime <= this.globalStartTime;
  }
}

export default TimeSyncController;
