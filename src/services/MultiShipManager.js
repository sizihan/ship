/**
 * 多船只数据管理器
 * 职责：管理所有船只的轨迹数据、位置插值、图标大小和颜色计算
 */
class MultiShipManager {
  constructor() {
    // 存储所有船只数据：Map<mmsi, {trajectory, startTime, endTime, vesselType, flagCtry, color, dest, iconSize}>
    this.ships = new Map();
    
    // 存储颜色缓存：Map<flagCtry, color>
    this.shipColors = new Map();
    
    // 默认颜色（当flag_ctry为空时使用）
    this.defaultColor = 'hsl(200, 70%, 50%)';
    
    // 10个好看的颜色列表（HSL格式）
    // 红色、橙色、黄色、绿色、青色、蓝色、紫色、粉色、棕色、青色
    this.colorPalette = [
      'hsl(0, 85%, 55%)',    // 红色 - 优先给中国
      'hsl(30, 85%, 55%)',   // 橙色
      'hsl(50, 85%, 55%)',   // 黄色
      'hsl(120, 85%, 55%)',  // 绿色
      'hsl(180, 85%, 55%)',  // 青色
      'hsl(210, 85%, 55%)',  // 蓝色
      'hsl(270, 85%, 55%)',  // 紫色
      'hsl(330, 85%, 55%)',  // 粉色
      'hsl(25, 75%, 50%)',   // 棕色
      'hsl(200, 85%, 55%)'   // 天蓝色
    ];
  }

  /**
   * 添加船只数据，分配颜色和图标大小（增强边界处理）
   * @param {string} mmsi - 船只MMSI
   * @param {Object} shipData - 船只数据 {data: [...], ...}
   */
  addShip(mmsi, shipData) {
    // 边界处理：验证输入参数
    if (!mmsi) {
      console.warn('addShip: MMSI为空');
      return;
    }

    if (!shipData || !shipData.data) {
      console.warn(`船只 ${mmsi} 数据对象无效`);
      return;
    }

    const trajectory = shipData.data || [];
    
    if (!Array.isArray(trajectory)) {
      console.warn(`船只 ${mmsi} 轨迹数据不是数组`);
      return;
    }

    if (trajectory.length === 0) {
      console.warn(`船只 ${mmsi} 没有轨迹数据`);
      return;
    }

    // 确保轨迹按时间排序
    let sortedTrajectory = [...trajectory];
    const hasTimeStamps = sortedTrajectory.some(point => point.postime);
    
    if (hasTimeStamps) {
      sortedTrajectory.sort((a, b) => {
        const timeA = this.parseTime(a.postime);
        const timeB = this.parseTime(b.postime);
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeA - timeB;
      });
    }

    // 获取第一个和最后一个点的信息
    const firstPoint = sortedTrajectory[0];
    const lastPoint = sortedTrajectory[sortedTrajectory.length - 1];

    // 计算开始和结束时间（边界处理：时间戳格式异常时使用null）
    let startTime = null;
    let endTime = null;
    
    try {
      if (firstPoint && firstPoint.postime) {
        const parsedStart = this.parseTime(firstPoint.postime);
        if (parsedStart && !isNaN(parsedStart.getTime())) {
          startTime = parsedStart;
        }
      }
      if (lastPoint && lastPoint.postime) {
        const parsedEnd = this.parseTime(lastPoint.postime);
        if (parsedEnd && !isNaN(parsedEnd.getTime())) {
          endTime = parsedEnd;
        }
      }
    } catch (e) {
      console.warn(`船只 ${mmsi} 时间戳解析失败:`, e);
    }

    // 获取船只属性（边界处理：缺失字段使用默认值）
    const vesselType = (firstPoint && firstPoint.vessel_type) ? String(firstPoint.vessel_type).trim() : '';
    let flagCtry = (firstPoint && firstPoint.flag_ctry) ? String(firstPoint.flag_ctry).trim() : '';
    // 清理flagCtry：移除无效值
    if (flagCtry === 'nan' || flagCtry === 'null' || flagCtry === 'undefined' || flagCtry === 'NaN') {
      flagCtry = '';
    }
    const dest = (firstPoint && firstPoint.dest) ? String(firstPoint.dest).trim() : '';

    // 计算图标大小和颜色（边界处理：无效值时使用默认颜色）
    const iconSize = this.calculateIconSize(vesselType);
    const color = this.getShipColor(flagCtry); // 获取颜色

    // 存储船只数据
    this.ships.set(mmsi, {
      trajectory: sortedTrajectory,
      startTime,
      endTime,
      vesselType,
      flagCtry,
      color,
      dest,
      iconSize
    });
  }

  /**
   * 批量添加船只数据（增强边界处理）
   * @param {Object} shipGroups - 船只分组数据 {mmsi: {data: [...], ...}}
   */
  initializeShips(shipGroups) {
    // 清空现有数据
    this.ships.clear();
    this.shipColors.clear();

    if (!shipGroups || typeof shipGroups !== 'object') {
      console.warn('MultiShipManager: 无效的船只数据');
      return;
    }

    // 第一步：收集所有国家代码，统计国家数量
    const countrySet = new Set();
    for (const [mmsi, shipData] of Object.entries(shipGroups)) {
      if (!shipData || !shipData.data || !Array.isArray(shipData.data) || shipData.data.length === 0) {
        continue;
      }
      
      // 获取第一个点的国家代码
      const firstPoint = shipData.data[0];
      if (firstPoint && firstPoint.flag_ctry) {
        let flagCtry = String(firstPoint.flag_ctry).trim();
        // 清理无效值
        if (flagCtry === 'nan' || flagCtry === 'null' || flagCtry === 'undefined' || flagCtry === 'NaN') {
          flagCtry = '';
        }
        if (flagCtry && flagCtry !== '') {
          countrySet.add(flagCtry);
        }
      }
    }

    // 第二步：为国家分配颜色（使用固定的10个好看颜色）
    const countries = Array.from(countrySet);
    const countryCount = countries.length;
    
    if (countryCount > 0) {
      // 优先给中国（CN）分配红色
      const chinaIndex = countries.findIndex(c => c === 'CN' || c === 'CHN' || c === 'China');
      if (chinaIndex !== -1) {
        // 将中国移到数组第一位
        const china = countries.splice(chinaIndex, 1)[0];
        countries.unshift(china);
      }
      
      // 打乱剩余国家的顺序（除了中国），实现随机分配
      const otherCountries = countries.slice(1);
      for (let i = otherCountries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherCountries[i], otherCountries[j]] = [otherCountries[j], otherCountries[i]];
      }
      const shuffledCountries = [countries[0], ...otherCountries];
      
      // 分配颜色：中国优先红色，其他随机
      shuffledCountries.forEach((country, index) => {
        // 如果颜色不够用，循环使用
        const colorIndex = index % this.colorPalette.length;
        const color = this.colorPalette[colorIndex];
        this.shipColors.set(country, color);
      });
      
      console.log(`MultiShipManager: 检测到 ${countryCount} 个国家，已分配颜色:`);
      shuffledCountries.forEach((country, index) => {
        console.log(`  ${country}: ${this.shipColors.get(country)}`);
      });
    } else {
      console.log('MultiShipManager: 未检测到国家代码，将使用默认颜色');
    }

    let validShips = 0;
    let invalidShips = 0;

    // 第三步：添加所有船只
    for (const [mmsi, shipData] of Object.entries(shipGroups)) {
      if (!shipData || !shipData.data) {
        console.warn(`船只 ${mmsi} 数据无效，跳过`);
        invalidShips++;
        continue;
      }

      // 边界处理：空轨迹数据
      if (!Array.isArray(shipData.data) || shipData.data.length === 0) {
        console.warn(`船只 ${mmsi} 轨迹数据为空，跳过`);
        invalidShips++;
        continue;
      }

      try {
        this.addShip(mmsi, shipData);
        validShips++;
      } catch (e) {
        console.error(`添加船只 ${mmsi} 失败:`, e);
        invalidShips++;
      }
    }

    console.log(`MultiShipManager初始化完成: ${validShips}艘船有效, ${invalidShips}艘船无效`);
    
    if (invalidShips > 0) {
      console.warn(`警告: ${invalidShips}艘船的数据无效或被跳过`);
    }
  }

  /**
   * 解析时间字符串为Date对象（增强边界处理）
   * @param {string|Date} timeStr - 时间字符串或Date对象
   * @returns {Date|null} Date对象或null
   */
  parseTime(timeStr) {
    if (!timeStr) return null;
    
    // 如果已经是Date对象
    if (timeStr instanceof Date) {
      return isNaN(timeStr.getTime()) ? null : timeStr;
    }

    // 边界处理：处理各种异常情况
    if (typeof timeStr !== 'string') {
      try {
        timeStr = String(timeStr);
      } catch (e) {
        return null;
      }
    }

    // 尝试解析ISO格式字符串
    try {
      // 处理常见的无效值
      const trimmed = String(timeStr).trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'NaN') {
        return null;
      }

      const date = new Date(timeStr);
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // 检查日期是否在合理范围内（1900年到2100年）
      const year = date.getFullYear();
      if (year < 1900 || year > 2100) {
        console.warn(`时间戳年份异常: ${year}, 原始值: ${timeStr}`);
        return null;
      }
      
      return date;
    } catch (e) {
      console.warn(`时间戳解析失败: ${timeStr}`, e);
      return null;
    }
  }

  /**
   * 获取指定时间点的船只位置（支持插值）
   * @param {string} mmsi - 船只MMSI
   * @param {Date|string} currentTime - 当前时间
   * @returns {Object|null} 船只位置信息 {lng, lat, hdg, cog, ...} 或null
   */
  getShipPositionAtTime(mmsi, currentTime) {
    const shipData = this.ships.get(mmsi);
    if (!shipData) {
      return null;
    }

    const trajectory = shipData.trajectory;
    if (trajectory.length === 0) {
      return null;
    }

    // 解析当前时间
    const time = currentTime instanceof Date ? currentTime : this.parseTime(currentTime);
    if (!time) {
      // 如果没有时间，返回第一个点，并根据下一个点计算方向
      const position = this.formatPosition(trajectory[0]);
      if (trajectory.length > 1) {
        const calculatedDirection = this.calculateDirection(trajectory[0], trajectory[1]);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }

    // 如果时间在轨迹范围外，返回边界点
    if (shipData.startTime && time < shipData.startTime) {
      return this.formatPosition(trajectory[0]);
    }
    if (shipData.endTime && time > shipData.endTime) {
      return this.formatPosition(trajectory[trajectory.length - 1]);
    }

    // 如果轨迹只有1个点，直接返回（无法计算方向）
    if (trajectory.length === 1) {
      return this.formatPosition(trajectory[0]);
    }

    // 二分查找找到currentTime所在的时间段
    let left = 0;
    let right = trajectory.length - 1;

    // 如果时间在第一点之前，返回第一个点，并根据下一个点计算方向
    const firstTime = this.parseTime(trajectory[0].postime);
    if (firstTime && time < firstTime) {
      const position = this.formatPosition(trajectory[0]);
      // 完全忽略数据中的方向，根据下一个点计算方向
      if (trajectory.length > 1) {
        const calculatedDirection = this.calculateDirection(trajectory[0], trajectory[1]);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }

    // 如果时间在最后一点之后，返回最后一个点，并根据前一个点计算方向
    const lastTime = this.parseTime(trajectory[right].postime);
    if (lastTime && time > lastTime) {
      const position = this.formatPosition(trajectory[right]);
      // 完全忽略数据中的方向，根据前一个点计算方向
      if (trajectory.length > 1) {
        const calculatedDirection = this.calculateDirection(trajectory[right - 1], trajectory[right]);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }

    // 二分查找
    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2);
      const midTime = this.parseTime(trajectory[mid].postime);
      
      if (!midTime) {
        // 如果没有时间戳，使用索引作为近似
        left = mid;
        continue;
      }

      if (midTime <= time) {
        left = mid;
      } else {
        right = mid;
      }
    }

    // 找到相邻的两个点
    const point1 = trajectory[left];
    const point2 = trajectory[right];

    const time1 = this.parseTime(point1.postime);
    const time2 = this.parseTime(point2.postime);

    // 如果两个点都没有时间戳，返回第一个点，并根据第二个点计算方向
    if (!time1 && !time2) {
      const position = this.formatPosition(point1);
      const calculatedDirection = this.calculateDirection(point1, point2);
      position.hdg = calculatedDirection;
      position.cog = calculatedDirection;
      return position;
    }

    // 如果只有一个点有时间戳，返回该点，并根据另一个点计算方向
    if (!time1) {
      const position = this.formatPosition(point2);
      // 如果有下一个点，使用下一个点计算方向
      if (right < trajectory.length - 1) {
        const nextPoint = trajectory[right + 1];
        const calculatedDirection = this.calculateDirection(point2, nextPoint);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      } else {
        // 使用point1计算方向
        const calculatedDirection = this.calculateDirection(point1, point2);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }
    if (!time2) {
      const position = this.formatPosition(point1);
      // 如果有下一个点（point2），使用它计算方向
      const calculatedDirection = this.calculateDirection(point1, point2);
      position.hdg = calculatedDirection;
      position.cog = calculatedDirection;
      return position;
    }

    // 如果时间正好等于某个点的时间，返回该点，并根据相邻点计算方向
    if (time.getTime() === time1.getTime()) {
      const position = this.formatPosition(point1);
      // 完全忽略数据中的方向，根据相邻点计算方向
      if (right < trajectory.length - 1) {
        // 如果有下一个点，计算方向
        const nextPoint = trajectory[right + 1];
        const calculatedDirection = this.calculateDirection(point1, nextPoint);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      } else if (left > 0) {
        // 如果没有下一个点，使用前一个点计算方向
        const prevPoint = trajectory[left - 1];
        const calculatedDirection = this.calculateDirection(prevPoint, point1);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      } else {
        // 如果只有一个点，使用point2计算方向
        const calculatedDirection = this.calculateDirection(point1, point2);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }
    if (time.getTime() === time2.getTime()) {
      const position = this.formatPosition(point2);
      // 完全忽略数据中的方向，根据相邻点计算方向
      if (right < trajectory.length - 1) {
        // 如果有下一个点，计算方向
        const nextPoint = trajectory[right + 1];
        const calculatedDirection = this.calculateDirection(point2, nextPoint);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      } else {
        // 使用前一个点（point1）计算方向
        const calculatedDirection = this.calculateDirection(point1, point2);
        position.hdg = calculatedDirection;
        position.cog = calculatedDirection;
      }
      return position;
    }

    // 计算插值进度
    const timeDiff = time2 - time1;
    const elapsed = time - time1;
    const progress = timeDiff > 0 ? elapsed / timeDiff : 0;

    // 限制进度在0-1之间
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // 插值位置、航向等
    return this.interpolatePosition(point1, point2, clampedProgress);
  }

  /**
   * 根据两个点的经纬度计算方向角（方位角）
   * @param {Object} point1 - 起点 {lng, lat} 或 {lon, lat}
   * @param {Object} point2 - 终点 {lng, lat} 或 {lon, lat}
   * @returns {number} 方向角（0-360度，0度=北，顺时针为正）
   */
  calculateDirection(point1, point2) {
    if (!point1 || !point2) {
      return 0;
    }

    const lng1 = point1.lon || point1.lng || 0;
    const lat1 = point1.lat || 0;
    const lng2 = point2.lon || point2.lng || 0;
    const lat2 = point2.lat || 0;

    // 如果两点相同，返回0
    if (lng1 === lng2 && lat1 === lat2) {
      return 0;
    }

    // 转换为弧度
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const deltaLng = (lng2 - lng1) * Math.PI / 180;

    // 使用球面三角公式计算方位角
    // atan2(y, x) 返回从x轴正方向到点(x,y)的角度
    // 这里计算从point1到point2的方向
    const y = Math.sin(deltaLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLng);
    
    // 计算方位角（弧度）
    let bearing = Math.atan2(y, x);
    
    // 转换为度数
    bearing = bearing * 180 / Math.PI;
    
    // 转换为0-360度范围（0度=北，顺时针为正）
    bearing = (bearing + 360) % 360;
    
    // 确保返回有效数字
    if (isNaN(bearing) || !isFinite(bearing)) {
      return 0;
    }
    
    return bearing;
  }

  /**
   * 位置插值
   * @param {Object} point1 - 第一个点
   * @param {Object} point2 - 第二个点
   * @param {number} progress - 插值进度 (0-1)
   * @returns {Object} 插值后的位置信息
   */
  interpolatePosition(point1, point2, progress) {
    if (!point1 || !point2) {
      return point1 || point2 || null;
    }

    progress = Math.max(0, Math.min(1, progress));

    // 插值经纬度
    const lng = (point1.lon || point1.lng || 0) + ((point2.lon || point2.lng || 0) - (point1.lon || point1.lng || 0)) * progress;
    const lat = (point1.lat || 0) + ((point2.lat || 0) - (point1.lat || 0)) * progress;

    // 完全忽略数据中的hdg和cog，只根据两个关键点之间的连线方向计算
    const finalHeading = this.calculateDirection(point1, point2);
    
    // 确保方向是有效数字
    const heading = (typeof finalHeading === 'number' && isFinite(finalHeading)) ? finalHeading : 0;

    return {
      lng: parseFloat(lng.toFixed(6)),
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat(lng.toFixed(6)), // 兼容性
      hdg: heading,
      cog: heading,
      timestamp: point1.postime || point1.timestamp,
      speed: point1.speed || point2.speed || 0,
      rot: point1.rot || 0,
      draught: point1.draught || point2.draught || null,
      status: point1.status || point2.status || null,
      dest: point1.dest || point2.dest || null,
      eta: point1.eta || point2.eta || null,
      vessel_type: point1.vessel_type || point2.vessel_type || null,
      flag_ctry: point1.flag_ctry || point2.flag_ctry || null
    };
  }

  /**
   * 角度插值（处理角度环绕问题，例如359度到1度的插值应该是0度，而不是180度）
   * @param {number} angle1 - 第一个角度
   * @param {number} angle2 - 第二个角度
   * @param {number} progress - 插值进度
   * @returns {number} 插值后的角度
   */
  interpolateAngle(angle1, angle2, progress) {
    // 规范化角度到0-360
    const normalize = (angle) => {
      angle = angle % 360;
      return angle < 0 ? angle + 360 : angle;
    };

    angle1 = normalize(angle1);
    angle2 = normalize(angle2);

    // 计算两个角度之间的最短路径
    let diff = angle2 - angle1;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }

    // 插值
    const result = angle1 + diff * progress;
    return normalize(result);
  }

  /**
   * 格式化位置信息
   * @param {Object} point - 轨迹点
   * @returns {Object} 格式化后的位置信息
   * 注意：hdg和cog在这里设置为0，实际方向会在调用处根据相邻点计算
   */
  formatPosition(point) {
    if (!point) return null;

    return {
      lng: point.lon || point.lng || 0,
      lat: point.lat || 0,
      lon: point.lon || point.lng || 0, // 兼容性
      hdg: 0, // 不使用数据中的hdg，方向会在调用处根据相邻点计算
      cog: 0, // 不使用数据中的cog，方向会在调用处根据相邻点计算
      timestamp: point.postime || point.timestamp,
      speed: point.speed || 0,
      rot: point.rot || 0,
      draught: point.draught || null,
      status: point.status || null,
      dest: point.dest || null,
      eta: point.eta || null,
      vessel_type: point.vessel_type || null,
      flag_ctry: point.flag_ctry || null
    };
  }

  /**
   * 获取当前时间可见的船只列表
   * @param {Date|string} currentTime - 当前时间
   * @param {string} mode - 模式：'multi' | 'single'
   * @param {string|null} selectedShipId - 单船只模式下选中的船只MMSI
   * @returns {Array<string>} 可见船只的MMSI列表
   */
  getAllVisibleShipsAtTime(currentTime, mode = 'multi', selectedShipId = null) {
    // 单船只模式：只返回选中的船只
    if (mode === 'single' && selectedShipId) {
      const shipData = this.ships.get(selectedShipId);
      if (shipData) {
        const time = currentTime instanceof Date ? currentTime : this.parseTime(currentTime);
        if (time && shipData.startTime && shipData.endTime) {
          if (time >= shipData.startTime && time <= shipData.endTime) {
            return [selectedShipId];
          }
        } else {
          // 如果没有时间戳，返回选中的船只
          return [selectedShipId];
        }
      }
      return [];
    }

    // 多船只模式：返回所有可见船只
    const visibleShips = [];
    const time = currentTime instanceof Date ? currentTime : this.parseTime(currentTime);

    for (const [mmsi, shipData] of this.ships.entries()) {
      // 如果没有时间戳，始终可见
      if (!shipData.startTime || !shipData.endTime || !time) {
        visibleShips.push(mmsi);
        continue;
      }

      // 检查时间范围
      if (time >= shipData.startTime && time <= shipData.endTime) {
        visibleShips.push(mmsi);
      }
    }

    return visibleShips;
  }

  /**
   * 根据国家代码获取颜色
   * @param {string} flagCtry - 国旗国家代码
   * @returns {string} HSL颜色字符串
   */
  getShipColor(flagCtry) {
    // 如果flag_ctry为空，使用默认颜色
    if (!flagCtry || flagCtry.trim() === '') {
      return this.defaultColor;
    }

    // 如果已经缓存了颜色，直接返回（颜色在initializeShips时已分配）
    if (this.shipColors.has(flagCtry)) {
      return this.shipColors.get(flagCtry);
    }

    // 如果颜色未分配（可能是新添加的船只），使用哈希值生成颜色
    // 这种情况应该很少发生，因为颜色在initializeShips时已分配
    const hash = this.hashString(flagCtry);
    const hue = hash % 360;
    const color = `hsl(${hue}, 80%, 55%)`;
    
    // 缓存颜色
    this.shipColors.set(flagCtry, color);
    
    return color;
  }

  /**
   * 字符串哈希函数
   * @param {string} str - 输入字符串
   * @returns {number} 哈希值
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 根据vessel_type计算图标大小
   * @param {string|number} vesselType - 船舶类型（五位数，后四位为0）
   * @returns {number} 图标大小（像素）
   */
  calculateIconSize(vesselType) {
    // vessel_type是五位数，后四位为0，例如：70000, 80000
    const typeNum = parseInt(vesselType) || 50000;
    
    if (typeNum >= 70000) {
      return 36; // 大图标
    } else if (typeNum >= 50000) {
      return 30; // 中图标
    } else {
      return 24; // 小图标
    }
  }

  /**
   * 获取船只信息
   * @param {string} mmsi - 船只MMSI
   * @returns {Object|null} 船只信息
   */
  getShip(mmsi) {
    return this.ships.get(mmsi) || null;
  }

  /**
   * 获取所有船只的MMSI列表
   * @returns {Array<string>} MMSI列表
   */
  getAllShipIds() {
    return Array.from(this.ships.keys());
  }

  /**
   * 获取所有船只的经纬度边界（最值）
   * @returns {Object|null} 边界对象 {minLng, maxLng, minLat, maxLat, centerLng, centerLat} 或null
   */
  getAllShipsBounds() {
    if (this.ships.size === 0) {
      return null;
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    // 遍历所有船只的轨迹点，找到最值
    for (const [mmsi, shipData] of this.ships.entries()) {
      const trajectory = shipData.trajectory;
      if (!trajectory || trajectory.length === 0) {
        continue;
      }

      for (const point of trajectory) {
        const lng = point.lon || point.lng;
        const lat = point.lat;

        if (lng !== null && lng !== undefined && !isNaN(lng)) {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }

        if (lat !== null && lat !== undefined && !isNaN(lat)) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }

    // 如果没有有效数据，返回null
    if (minLng === Infinity || maxLng === -Infinity || minLat === Infinity || maxLat === -Infinity) {
      return null;
    }

    // 计算中心点
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    return {
      minLng,
      maxLng,
      minLat,
      maxLat,
      centerLng,
      centerLat,
      lngDiff: maxLng - minLng,
      latDiff: maxLat - minLat
    };
  }

  /**
   * 获取单个船只的经纬度边界
   * @param {string} mmsi - 船只MMSI
   * @returns {Object|null} 边界对象或null
   */
  getShipBounds(mmsi) {
    const shipData = this.ships.get(mmsi);
    if (!shipData || !shipData.trajectory || shipData.trajectory.length === 0) {
      return null;
    }

    const trajectory = shipData.trajectory;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const point of trajectory) {
      const lng = point.lon || point.lng;
      const lat = point.lat;

      if (lng !== null && lng !== undefined && !isNaN(lng)) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }

      if (lat !== null && lat !== undefined && !isNaN(lat)) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    if (minLng === Infinity || maxLng === -Infinity || minLat === Infinity || maxLat === -Infinity) {
      return null;
    }

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    return {
      minLng,
      maxLng,
      minLat,
      maxLat,
      centerLng,
      centerLat,
      lngDiff: maxLng - minLng,
      latDiff: maxLat - minLat
    };
  }
}

export default MultiShipManager;
