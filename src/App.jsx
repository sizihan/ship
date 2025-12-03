import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import AMapComponent from './components/AMapComponent';
import ShipInfoModal from './components/ShipInfoModal';
import Sidebar from './components/Sidebar';
import BottomControls from './components/BottomControls';
import { shipAPI } from './services/api';
import TimeSyncController from './services/TimeSyncController';
import MultiShipManager from './services/MultiShipManager';
import PerformanceMonitor from './utils/PerformanceMonitor';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [csvData, setCsvData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1); // 倍速，1x表示现实1秒=船舶移动5分钟
  const [currentTrajectory, setCurrentTrajectory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [showTrajectoryPoints, setShowTrajectoryPoints] = useState(true);
  const [showTrajectoryLine, setShowTrajectoryLine] = useState(true);
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'
  const [allShipsData, setAllShipsData] = useState({}); // 存储所有船只的数据
  const [selectedShipId, setSelectedShipId] = useState(null); // 当前选中的船只ID
  const [currentMode, setCurrentMode] = useState('multi'); // 模式：'multi' | 'single'
  const [currentTime, setCurrentTime] = useState(null); // 当前播放时间
  const [globalTimeRange, setGlobalTimeRange] = useState(null); // 全局时间范围
  const [showTrajectory, setShowTrajectory] = useState(false); // 是否显示轨迹（默认隐藏）
  const [selectedShipInfo, setSelectedShipInfo] = useState(null); // 选中船只的详细信息
  const [isShipInfoModalOpen, setIsShipInfoModalOpen] = useState(false); // 船只信息弹窗是否打开
  const [searchQuery, setSearchQuery] = useState(''); // 船舶搜索查询
  const [showShipSearch, setShowShipSearch] = useState(false); // 控制船舶搜索框的显示
  const [showSpeedControl, setShowSpeedControl] = useState(false); // 控制倍速调整条的显示
  const fileInputRef = useRef(null); // 文件输入框引用
  
  const animationRef = useRef(null);
  const animationFrameRef = useRef(null); // 用于requestAnimationFrame
  const mapRef = useRef(null);
  const lastAnimationTimeRef = useRef(null); // 记录上次动画时间
  const currentAnimationIndexRef = useRef(0); // 当前动画索引（支持在两个点之间停止）
  const segmentStartTimeRef = useRef(null); // 当前段落的开始时间
  const segmentStartIndexRef = useRef(0); // 当前段落的开始索引
  
  // 核心服务实例
  const timeSyncControllerRef = useRef(null);
  const multiShipManagerRef = useRef(null);
  const mapInstanceRef = useRef(null); // 地图实例引用
  const performanceMonitorRef = useRef(null); // 性能监控器（保留用于内部使用，但不显示UI）
  
  // 组件挂载时检查后端连接
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        setApiStatus('checking');
        console.log('检查后端API连接...');
        const response = await shipAPI.healthCheck();
        console.log('API连接成功:', response.data);
        setApiStatus('connected');
      } catch (error) {
        console.error('API连接失败:', error);
        setApiStatus('disconnected');
      }
    };
    
    checkApiConnection();
  }, []);

  // 获取地图实例（用于向后兼容）
  useEffect(() => {
    const checkMapReady = () => {
      if (window.getMap) {
        const map = window.getMap();
        if (map) {
          mapInstanceRef.current = map;
        }
      }
    };

    // 定期检查地图是否已初始化
    const interval = setInterval(() => {
      checkMapReady();
    }, 100);

    // 立即检查一次
    checkMapReady();

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * 调整地图视角到指定边界
   * @param {Object|null} bounds - 边界对象 {minLng, maxLng, minLat, maxLat, centerLng, centerLat, lngDiff, latDiff}，null表示所有船只
   */
  const adjustMapViewToBounds = useCallback((bounds) => {
    if (!mapInstanceRef.current || !window.getMap) {
      console.warn('地图未初始化');
      return;
    }

    const map = window.getMap();
    if (!map) {
      console.warn('无法获取地图实例');
      return;
    }

    // 如果没有提供边界，计算所有船只的边界
    if (!bounds) {
      if (!multiShipManagerRef.current) {
        console.warn('MultiShipManager未初始化');
        return;
      }
      bounds = multiShipManagerRef.current.getAllShipsBounds();
      if (!bounds) {
        console.warn('无法计算船只边界');
        return;
      }
    }

    // 计算地图容器的宽高比
    const mapContainer = map.getContainer();
    if (!mapContainer) {
      console.warn('无法获取地图容器');
      return;
    }

    const mapWidth = mapContainer.clientWidth || window.innerWidth;
    const mapHeight = mapContainer.clientHeight || window.innerHeight;
    const mapAspectRatio = mapWidth / mapHeight;

    // 计算船舶数据的经纬度比例
    const shipAspectRatio = bounds.lngDiff / bounds.latDiff;

    // 确保边界差值不为0（避免除零错误）
    if (bounds.lngDiff <= 0 || bounds.latDiff <= 0) {
      console.warn('边界差值无效，无法调整视角');
      map.setCenter([bounds.centerLng, bounds.centerLat]);
      return;
    }

    // 计算边界框（直接使用实际的边界）
    const boundsArray = [
      [bounds.minLng, bounds.minLat],
      [bounds.maxLng, bounds.maxLat]
    ];

    // 设置中心点
    map.setCenter([bounds.centerLng, bounds.centerLat]);

    // 手动计算合适的缩放级别，使轨迹占据地图的绝大部分空间（约90-95%）
    // 高德地图缩放级别计算：需要根据经纬度差值和地图容器大小来计算
    // 注意：mapWidth 和 mapHeight 已在上面声明
    
    // 计算需要的显示跨度（只比实际跨度大一点点，让轨迹占据约95%的空间）
    const paddingRatio = 5; // 轨迹占据95%的空间，边距只占5%
    const targetLngDiff = bounds.lngDiff / paddingRatio;
    const targetLatDiff = bounds.latDiff / paddingRatio;
    
    // 根据地图宽高比调整目标跨度
    let adjustedLngDiff = targetLngDiff;
    let adjustedLatDiff = targetLatDiff;
    
    if (mapAspectRatio > shipAspectRatio) {
      // 地图更宽，以纬度为准
      adjustedLngDiff = targetLatDiff * mapAspectRatio;
    } else {
      // 地图更高，以经度为准
      adjustedLatDiff = targetLngDiff / mapAspectRatio;
    }
    
    // 计算缩放级别
    // 高德地图：每个缩放级别，视野缩小约2倍
    // 粗略公式：zoom ≈ log2(360 / lngDiff) 或 log2(180 / latDiff)
    const zoomLng = Math.log2(360 / adjustedLngDiff);
    const zoomLat = Math.log2(180 / adjustedLatDiff);
    const estimatedZoom = Math.min(zoomLng, zoomLat);
    
    // 限制缩放级别在合理范围内（3-18）
    const finalZoom = Math.max(3, Math.min(18, Math.floor(estimatedZoom)));
    
    // 设置缩放级别
    map.setZoom(finalZoom);
    
    // 使用setFitView作为最终调整，使用极小边距确保轨迹占据最大空间
    try {
      map.setFitView(boundsArray, false, [5, 5, 5, 5]);
    } catch (error) {
      // 如果setFitView失败，至少我们已经设置了中心点和缩放级别
      console.warn('setFitView失败，但已设置中心点和缩放级别:', error);
    }
  }, []);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    // 重置状态
    setUploadStatus('');
    setCsvData(null);
    setCurrentTrajectory([]);
    setIsPlaying(false);

    // 自动上传文件
    try {
      setUploadStatus('uploading');
      const response = await shipAPI.uploadCSV(file);
      setUploadStatus('success');
      console.log('文件上传响应:', response.data);
      
      // 自动加载CSV数据
      await loadCSVData(response.data.filename);
    } catch (error) {
      setUploadStatus('error');
      console.error('上传错误:', error);
    }

    // 重置文件输入框，允许再次选择同一个文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    // 触发文件选择对话框
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  


  const loadCSVData = async (filename) => {
    try {
      console.log('开始加载CSV数据:', filename);
      const response = await shipAPI.getCSVData(filename);
      console.log('获取到CSV数据响应状态:', response.status);
      console.log('响应数据结构:', Object.keys(response.data || {}));
      
      setCsvData(response.data);
      
      // 初始化核心服务
      if (!timeSyncControllerRef.current) {
        timeSyncControllerRef.current = new TimeSyncController();
      }
      if (!multiShipManagerRef.current) {
        multiShipManagerRef.current = new MultiShipManager();
      }
      
      // 处理轨迹点数据 - 同时支持单船只和多船只数据结构
      let trajectoryData = null;
      const shipsData = {};
      
      // 优先从ship_groups获取数据（如果有多个船只）
      if (response.data && response.data.ship_groups && Object.keys(response.data.ship_groups).length > 0) {
        console.log(`发现多船只数据，共${Object.keys(response.data.ship_groups).length}艘船`);
        
        // 处理所有船只数据
        Object.keys(response.data.ship_groups).forEach(shipId => {
          const shipData = response.data.ship_groups[shipId];
          if (shipData && shipData.data) {
            shipsData[shipId] = shipData;
          }
        });
        
        // 设置所有船只数据
        setAllShipsData(shipsData);
        
        // 初始化MultiShipManager
        multiShipManagerRef.current.initializeShips(shipsData);
        
        // 初始化TimeSyncController
        timeSyncControllerRef.current.initializeShips(shipsData, response.data.global_time_range);
        
        // 设置全局时间范围
        if (response.data.global_time_range) {
          setGlobalTimeRange(response.data.global_time_range);
        }
        
        // 获取时间范围
        const timeRange = timeSyncControllerRef.current.getGlobalTimeRange();
        if (timeRange.startTime) {
          setCurrentTime(new Date(timeRange.startTime));
        }

        // 上传成功后，自动调整视角到所有船只的总览
        setTimeout(() => {
          adjustMapViewToBounds(null);
        }, 500);
        
        // 默认使用第一艘船的数据（向后兼容）
        const firstShipId = Object.keys(shipsData)[0];
        setSelectedShipId(firstShipId);
        trajectoryData = shipsData[firstShipId].data;
      } else if (response.data && response.data.data) {
        console.log('使用单列数据格式');
        trajectoryData = response.data.data;
        setAllShipsData({});
        setSelectedShipId(null);
      }
      
      if (!trajectoryData) {
        console.error('无法找到轨迹数据！响应中没有data或ship_groups字段');
        alert('无法找到轨迹数据，请检查文件格式是否正确');
        return;
      }
      
      if (trajectoryData) {
        console.log('原始轨迹点数量:', trajectoryData.length);
        // 处理轨迹点，标准化字段
        const trajectory = trajectoryData.map(point => {
          // 确保经度字段存在 - 只使用lon格式
          const lng = point.lon || null;
          const lat = point.lat || null;
          
          // 添加时间戳信息
          let timestamp = null;
          if (point.standard_timestamp) {
            timestamp = point.standard_timestamp;
          } else if (point.timestamp) {
            timestamp = point.timestamp;
          } else if (point.time) {
            timestamp = point.time;
          }
          
          // 确保航向、速度、转向速度和新增字段
          // 船首方向(hdg)和实际移动方向(cog)
          const hdg = point.heading || point.hdg || null;
          const cog = point.cog || point.direction || null;
          const speed = point.speed || null;
          const rot = point.rot || null; // 转向速度
          const draught = point.draught || null; // 吃水
          const status = point.status || null; // 船舶状态
          const dest = point.dest || null; // 目的地
          const eta = point.eta || null; // 预计到达时间
          const legStartPostime = point.leg_start_postime || null; // 航段出发时间
          const arrivalTime = point.arrival_time || null; // 实际到达时间
          
          return { 
            lng, 
            lat, 
            timestamp,
            hdg,  // 船首方向
            cog,  // 实际移动方向(轨迹方向)
            speed,
            rot,  // 转向速度
            draught,  // 吃水
            status,  // 船舶状态
            dest,  // 目的地
            eta,  // 预计到达时间
            leg_start_postime: legStartPostime,  // 航段出发时间
            arrival_time: arrivalTime,  // 实际到达时间
            ...point 
          };
        }).filter(point => point.lng && point.lat && !isNaN(point.lng) && !isNaN(point.lat));
        
        console.log('处理后的轨迹点数量:', trajectory.length);
        
        setCurrentTrajectory(trajectory);
        setCurrentIndex(0);
        
        // 设置时间范围
        if (trajectory.length > 0) {
          setTimeRange([0, trajectory.length - 1]);
          setSelectedTimeIndex(0);
        }
        
        // 如果是多船只模式，使用新的统一时间轴系统
        if (Object.keys(shipsData).length > 0 && timeSyncControllerRef.current && multiShipManagerRef.current) {
          // 更新所有船只位置到起始时间
          const startTime = timeSyncControllerRef.current.getCurrentTime();
          if (startTime) {
            updateAllShipsPositions(startTime);
          }
        } else {
          // 向后兼容：单船只模式，使用原有逻辑
          // 通知地图组件更新轨迹，包含显示选项
          if (window.updateShipTrajectory && trajectory && Array.isArray(trajectory)) {
            console.log('调用地图更新轨迹函数，轨迹点数量:', trajectory.length);
            window.updateShipTrajectory(trajectory, {
              showPoints: showTrajectoryPoints,
              showLine: showTrajectoryLine
            });
          } else {
            if (!window.updateShipTrajectory) {
              console.error('window.updateShipTrajectory函数不存在!');
            } else if (!trajectory || !Array.isArray(trajectory)) {
              console.warn('轨迹数据无效，无法更新地图轨迹');
            }
          }
          
          // 更新船舶位置到起点
          if (trajectory && Array.isArray(trajectory) && trajectory.length > 0 && window.updateShipPosition) {
            console.log('更新船舶位置到起点:', trajectory[0].lng || trajectory[0].lon, trajectory[0].lat);
            window.updateShipPosition(trajectory[0]);
          } else {
            console.error('无法更新船舶位置: 轨迹为空或window.updateShipPosition函数不存在');
          }
        }
      }
      
      console.log('CSV数据:', response.data);
    } catch (error) {
      console.error('读取CSV数据错误:', error);
    }
  };

  /**
   * 批量更新所有船只位置（性能优化版本）
   * @param {Date} currentTime - 当前时间
   * @param {string} mode - 可选，模式：'multi' | 'single'，如果不提供则使用 currentMode
   * @param {string} selectedId - 可选，选中的船舶ID，如果不提供则使用 selectedShipId
   */
  const updateAllShipsPositions = useCallback((currentTime, mode = null, selectedId = null) => {
    if (!timeSyncControllerRef.current || !multiShipManagerRef.current) {
      console.warn('核心服务未初始化');
      return;
    }

    if (!mapInstanceRef.current || !window.ShipMarkersManager) {
      console.warn('地图或标记管理器未初始化');
      return;
    }

    // 使用传入的参数，如果没有则使用状态值
    const actualMode = mode !== null ? mode : currentMode;
    const actualSelectedId = selectedId !== null ? selectedId : selectedShipId;

    const startTime = performance.now();

    // 获取当前时间活跃的船只列表（时间过滤）
    const activeShips = timeSyncControllerRef.current.getActiveShipsAtTime(currentTime);
    
    // 边界处理：如果没有活跃船只，清除所有标记
    if (activeShips.length === 0) {
      if (window.ShipMarkersManager) {
        window.ShipMarkersManager.updateAllMarkers({}, actualMode, actualSelectedId);
      }
      return;
    }
    
    // 批量计算所有活跃船只的位置（优化：减少循环次数）
    const shipPositions = {};
    const multiShipManager = multiShipManagerRef.current;
    
    for (let i = 0; i < activeShips.length; i++) {
      const mmsi = activeShips[i];
      
      // 边界处理：跳过无效的MMSI
      if (!mmsi) continue;
      
      try {
        const position = multiShipManager.getShipPositionAtTime(mmsi, currentTime);
        if (!position || (!position.lng && !position.lon) || !position.lat) {
          continue; // 跳过无效位置
        }
        
        // 添加船只信息（颜色、图标大小等）
        const shipInfo = multiShipManager.getShip(mmsi);
        if (shipInfo) {
          shipPositions[mmsi] = {
            ...position,
            iconSize: shipInfo.iconSize || 24,
            color: shipInfo.color || '#2196f3', // 边界处理：缺失时使用默认颜色
            mmsi: mmsi,
            vessel_type: shipInfo.vesselType || '',
            flag_ctry: shipInfo.flagCtry || '', // 边界处理：flag_ctry缺失
            dest: shipInfo.dest || ''
          };
        }
      } catch (e) {
        console.warn(`获取船只 ${mmsi} 位置失败:`, e);
        // 继续处理其他船只
      }
    }

    // 批量更新地图标记（性能优化：一次性更新所有标记）
    try {
      window.ShipMarkersManager.updateAllMarkers(
        shipPositions,
        actualMode,
        actualSelectedId
      );
    } catch (e) {
      console.error('批量更新标记失败:', e);
    }

    // 性能监控：记录更新耗时（内部使用，不显示UI）
    const updateTime = performance.now() - startTime;
    if (performanceMonitorRef.current) {
      performanceMonitorRef.current.recordFrame(updateTime);
    }
  }, [currentMode, selectedShipId]);

  // 计算两个轨迹点之间的时间差（分钟）
  const getTimeDifference = (point1, point2) => {
    if (!point1 || !point2) return 5; // 默认5分钟
    
    // 尝试从timestamp计算时间差
    if (point1.timestamp && point2.timestamp) {
      try {
        const time1 = new Date(point1.timestamp).getTime();
        const time2 = new Date(point2.timestamp).getTime();
        if (!isNaN(time1) && !isNaN(time2) && time2 > time1) {
          return (time2 - time1) / (1000 * 60); // 转换为分钟
        }
      } catch (e) {
        console.warn('时间解析失败:', e);
      }
    }
    
    // 如果没有时间戳，默认每个点间隔5分钟
    return 5;
  };

  // 计算两点之间的插值位置（根据进度0-1）
  const interpolatePosition = (point1, point2, progress) => {
    if (!point1 || !point2) return point1 || point2;
    
    // 确保进度在0-1之间
    progress = Math.max(0, Math.min(1, progress));
    
    // 线性插值经纬度，使用更高精度计算，然后四舍五入到合理精度
    // 经纬度通常需要6位小数精度（约0.1米）
    const lng = parseFloat((point1.lng + (point2.lng - point1.lng) * progress).toFixed(6));
    const lat = parseFloat((point1.lat + (point2.lat - point1.lat) * progress).toFixed(6));
    
    // 插值航向（处理角度跨越360度的情况）
    let hdg = point1.hdg || point1.cog || 0;
    let nextHdg = point2.hdg || point2.cog || hdg;
    
    // 处理角度差，选择最短路径
    let angleDiff = nextHdg - hdg;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    const interpolatedHdg = hdg + angleDiff * progress;
    const normalizedHdg = ((interpolatedHdg % 360) + 360) % 360;
    
    // 插值其他属性
    const interpolatedPoint = {
      lng,
      lat,
      lon: lng, // 兼容性
      hdg: normalizedHdg,
      cog: normalizedHdg,
      timestamp: point1.timestamp,
      speed: point1.speed || point2.speed || 0,
      rot: point1.rot || 0,
      draught: point1.draught || point2.draught || null,
      status: point1.status || point2.status || null,
      dest: point1.dest || point2.dest || null,
      eta: point1.eta || point2.eta || null,
      leg_start_postime: point1.leg_start_postime || point2.leg_start_postime || null,
      arrival_time: point1.arrival_time || point2.arrival_time || null
    };
    
    return interpolatedPoint;
  };

  /**
   * 统一时间轴动画循环（性能优化版本）
   */
  const startUnifiedTimeAnimation = useCallback(() => {
    if (!timeSyncControllerRef.current || !multiShipManagerRef.current) {
      console.warn('核心服务未初始化，无法启动动画');
      return;
    }

    if (!mapInstanceRef.current || !window.ShipMarkersManager) {
      console.warn('地图或标记管理器未初始化');
      return;
    }

    // 初始化性能监控
    if (!performanceMonitorRef.current) {
      performanceMonitorRef.current = new PerformanceMonitor();
    }
    performanceMonitorRef.current.start();

    const BASE_TIME_RATIO = 300; // 基础时间比例（现实1秒=船舶移动5分钟=300秒）
    
    const animate = (currentTime) => {
      const frameStartTime = performance.now();
      
      if (!animationFrameRef.current) {
        return; // 动画已停止
      }

      // 初始化时间记录
      if (!lastAnimationTimeRef.current) {
        lastAnimationTimeRef.current = currentTime;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // 计算时间差
      const realTimeElapsed = (currentTime - lastAnimationTimeRef.current) / 1000; // 转换为秒
      const shipTimeElapsed = realTimeElapsed * BASE_TIME_RATIO * animationSpeed; // 船舶时间（秒）
      
      // 更新当前播放时间
      const currentShipTime = timeSyncControllerRef.current.getCurrentTime();
      if (!currentShipTime) {
        console.warn('当前时间未设置');
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        setIsPlaying(false);
        if (performanceMonitorRef.current) {
          performanceMonitorRef.current.stop();
        }
        return;
      }

      const newShipTime = new Date(currentShipTime.getTime() + shipTimeElapsed * 1000);
      
      // 检查是否到达结束时间
      const timeRange = timeSyncControllerRef.current.getGlobalTimeRange();
      if (timeRange.endTime && newShipTime > timeRange.endTime) {
        // 动画结束，确保所有船只到达最终位置
        timeSyncControllerRef.current.updateTime(timeRange.endTime);
        updateAllShipsPositions(timeRange.endTime);
        setCurrentTime(timeRange.endTime);
        
        // 停止动画
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        setIsPlaying(false);
        timeSyncControllerRef.current.setPlaying(false);
        lastAnimationTimeRef.current = null;
        
        // 停止性能监控
        if (performanceMonitorRef.current) {
          performanceMonitorRef.current.stop();
        }
        return;
      }

      // 更新时间
      timeSyncControllerRef.current.updateTime(newShipTime);
      
      // 批量更新所有船只位置（性能优化：使用useCallback缓存的函数）
      updateAllShipsPositions(newShipTime);
      
      // 更新UI（使用防抖：避免频繁更新导致性能问题）
      setCurrentTime(newShipTime);
      lastAnimationTimeRef.current = currentTime;
      
      // 性能监控：记录帧时间
      const frameTime = performance.now() - frameStartTime;
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.recordFrame(frameTime);
      }
      
      // 继续下一帧
      if (animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // 开始动画循环
    lastAnimationTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [animationSpeed, updateAllShipsPositions]);

  const handlePlayAnimation = () => {
    if (isRealTimeMode) {
      console.log('实时模式下不能播放动画');
      alert('实时模式下不能播放动画');
      return;
    }
    
    // 如果使用多船只模式且有核心服务，使用统一时间轴动画
    if (Object.keys(allShipsData).length > 0 && timeSyncControllerRef.current && multiShipManagerRef.current) {
      if (isPlaying) {
        // 停止动画
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        lastAnimationTimeRef.current = null;
        setIsPlaying(false);
        timeSyncControllerRef.current.setPlaying(false);
        
        // 停止性能监控
        if (performanceMonitorRef.current) {
          performanceMonitorRef.current.stop();
        }
      } else {
        // 开始统一时间轴动画
        setIsPlaying(true);
        timeSyncControllerRef.current.setPlaying(true);
        timeSyncControllerRef.current.setSpeed(animationSpeed);
        startUnifiedTimeAnimation();
      }
      return;
    }
    
    // 向后兼容：单船只模式，使用原有逻辑
    if (isPlaying) {
      // 停止动画 - 可以在两个点之间停止
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastAnimationTimeRef.current = null;
      // 注意：不重置segmentStartIndexRef，这样下次播放时可以从当前位置继续
      setIsPlaying(false);
    } else {
      // 开始动画，从当前位置继续
      // 使用requestAnimationFrame实现平滑动画，支持在两个点之间停止和插值
      // 如果segmentStartIndexRef有值，说明之前停止过，从那里继续；否则从currentIndex开始
      const startIndex = segmentStartIndexRef.current !== null && segmentStartIndexRef.current !== undefined 
        ? segmentStartIndexRef.current 
        : currentIndex;
      currentAnimationIndexRef.current = startIndex;
      segmentStartIndexRef.current = startIndex;
      lastAnimationTimeRef.current = performance.now();
      segmentStartTimeRef.current = performance.now();
      
      // 基础时间：现实1秒 = 船舶移动5分钟
      const BASE_TIME_RATIO = 5; // 分钟/秒
      
      const animate = (currentTime) => {
        // 检查动画是否应该继续（通过检查animationFrameRef是否存在）
        if (!animationFrameRef.current) {
          return; // 如果已停止，退出
        }
        
        const index = segmentStartIndexRef.current;
        if (index >= currentTrajectory.length - 1) {
          // 动画结束，确保到达最后一个点
          if (currentTrajectory[index] && window.updateShipPosition) {
            window.updateShipPosition(currentTrajectory[index]);
            setCurrentIndex(index);
            setSelectedTimeIndex(index);
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          setIsPlaying(false);
          lastAnimationTimeRef.current = null;
          segmentStartTimeRef.current = null;
          return;
        }
        
        const currentPoint = currentTrajectory[index];
        const nextPoint = currentTrajectory[index + 1];
        
        if (!currentPoint || !nextPoint || !window.updateShipPosition) {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          setIsPlaying(false);
          return;
        }
        
        // 计算两点之间的时间差（分钟）
        const timeDiffMinutes = getTimeDifference(currentPoint, nextPoint);
        
        // 计算动画间隔：现实时间 = 船舶时间 / (倍速 * 基础时间比)
        // 例如：船舶移动5分钟，倍速1x，则现实需要1秒
        // 倍速2x，则现实需要0.5秒
        const realTimeMs = (timeDiffMinutes / BASE_TIME_RATIO / animationSpeed) * 1000;
        
        // 计算从段落开始到现在的经过时间
        const elapsed = currentTime - segmentStartTimeRef.current;
        
        // 计算进度（0-1）
        const progress = Math.min(1, elapsed / realTimeMs);
        
        // 计算插值位置
        const interpolatedPoint = interpolatePosition(currentPoint, nextPoint, progress);
        
        // 更新船舶位置（每帧都更新，实现平滑移动）
        window.updateShipPosition(interpolatedPoint);
        
        // 更新当前索引（用于显示，但不用于动画计算）
        // 使用进度来决定显示哪个点
        const displayIndex = progress >= 1 ? index + 1 : index;
        setCurrentIndex(displayIndex);
        setSelectedTimeIndex(displayIndex);
        
        // 如果进度达到1，移动到下一段
        if (progress >= 1) {
          const nextIndex = index + 1;
          segmentStartIndexRef.current = nextIndex;
          currentAnimationIndexRef.current = nextIndex;
          segmentStartTimeRef.current = currentTime;
          
          // 确保到达目标点
          if (nextIndex < currentTrajectory.length) {
            window.updateShipPosition(currentTrajectory[nextIndex]);
            setCurrentIndex(nextIndex);
            setSelectedTimeIndex(nextIndex);
          }
        }
        
        // 继续动画循环（只要animationFrameRef还存在）
        if (animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };
      
      // 立即显示当前位置
      if (currentTrajectory[startIndex] && window.updateShipPosition) {
        window.updateShipPosition(currentTrajectory[startIndex]);
      }
      
      // 开始动画循环
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };


  const handleResetAnimation = () => {
    // 停止动画
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastAnimationTimeRef.current = null;
    segmentStartTimeRef.current = null;
    setIsPlaying(false);
    
    // 停止性能监控
    if (performanceMonitorRef.current) {
      performanceMonitorRef.current.stop();
    }
    
    // 如果使用多船只模式且有核心服务，使用统一时间轴重置
    if (Object.keys(allShipsData).length > 0 && timeSyncControllerRef.current && multiShipManagerRef.current) {
      // 重置到开始时间
      timeSyncControllerRef.current.reset();
      const startTime = timeSyncControllerRef.current.getCurrentTime();
      if (startTime) {
        updateAllShipsPositions(startTime);
        setCurrentTime(startTime);
      }
      return;
    }
    
    // 向后兼容：单船只模式
    setCurrentIndex(0);
    setSelectedTimeIndex(0);
    currentAnimationIndexRef.current = 0;
    segmentStartIndexRef.current = 0;
    
    // 重置船舶位置到起点
    if (currentTrajectory.length > 0 && window.updateShipPosition) {
      window.updateShipPosition(currentTrajectory[0]);
    }
  };
  
  /**
   * 时间轴拖拽跳转（统一时间轴模式）
   */
  const handleTimeSliderChange = (e) => {
    // 如果使用多船只模式且有核心服务，使用统一时间轴跳转
    if (Object.keys(allShipsData).length > 0 && timeSyncControllerRef.current && multiShipManagerRef.current && globalTimeRange) {
      // 停止当前动画
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastAnimationTimeRef.current = null;
      setIsPlaying(false);
      timeSyncControllerRef.current.setPlaying(false);

      // 根据滑块值计算时间（滑块值范围：0-100）
      const sliderValue = parseFloat(e.target.value);
      
      if (globalTimeRange.start_time && globalTimeRange.end_time) {
        const start = new Date(globalTimeRange.start_time);
        const end = new Date(globalTimeRange.end_time);
        const timeDiff = end - start;
        const newTime = new Date(start.getTime() + (timeDiff * sliderValue / 100));
        
        // 更新时间
        timeSyncControllerRef.current.updateTime(newTime);
        
        // 批量更新所有船只位置
        updateAllShipsPositions(newTime);
        
        // 更新UI
        setCurrentTime(newTime);
      }
      
      return;
    }

    // 向后兼容：单船只模式，使用原有逻辑
    const index = parseInt(e.target.value);
    setSelectedTimeIndex(index);
    setCurrentIndex(index);
    currentAnimationIndexRef.current = index;
    
    // 停止当前动画
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastAnimationTimeRef.current = null;
    segmentStartTimeRef.current = null;
    setIsPlaying(false);
    segmentStartIndexRef.current = index;
    
    // 更新船舶位置
    if (currentTrajectory[index] && window.updateShipPosition) {
      window.updateShipPosition(currentTrajectory[index]);
    }
  };

  /**
   * 进入单船只模式的统一函数
   * 使其他船舶变得半透明，大小不变，显示选中船舶的航路和关键点
   * @param {string} mmsi - 选中的船舶MMSI
   */
  const enterSingleShipMode = useCallback((mmsi) => {
    if (!multiShipManagerRef.current || !timeSyncControllerRef.current) {
      console.warn('核心服务未初始化');
      return;
    }

    // 进入单船只模式
    setCurrentMode('single');
    setSelectedShipId(mmsi);
    timeSyncControllerRef.current.setMode('single', mmsi);

    // 显示选中船只的轨迹（航路）和关键点
    const shipData = multiShipManagerRef.current.getShip(mmsi);
    if (shipData && shipData.trajectory && window.TrajectoryManager) {
      // 显示航路和关键点（起点、终点和中间关键点）
      window.TrajectoryManager.showShipTrajectory(mmsi, shipData.trajectory, {
        color: '#2196f3',
        lineWidth: 3,
        pointSize: 8,
        lineOpacity: 0.8,
        pointOpacity: 0.6
      });
    }

    // 调整视角到选中船只的边界
    const shipBounds = multiShipManagerRef.current.getShipBounds(mmsi);
    if (shipBounds) {
      adjustMapViewToBounds(shipBounds);
    }

    // 更新所有船只位置（使其他船舶半透明，大小不变）
    // 直接传递新的模式值和选中ID，避免状态更新延迟问题
    const currentShipTime = timeSyncControllerRef.current.getCurrentTime();
    if (currentShipTime) {
      updateAllShipsPositions(currentShipTime, 'single', mmsi);
    }
  }, [updateAllShipsPositions, adjustMapViewToBounds]);

  /**
   * 处理船只双击事件（已禁用，不再执行任何操作）
   */
  const handleShipDoubleClick = (mmsi, position) => {
    // 双击功能已取消，不执行任何操作
  };

  /**
   * 退出单船只模式
   */
  const handleExitSingleMode = () => {
    if (!timeSyncControllerRef.current) {
      console.warn('核心服务未初始化');
      return;
    }

    // 退出单船只模式
    setCurrentMode('multi');
    setSelectedShipId(null);
    timeSyncControllerRef.current.setMode('multi', null);

    // 隐藏轨迹
    if (window.TrajectoryManager) {
      window.TrajectoryManager.hideAllTrajectories();
    }

    // 恢复所有船只正常显示
    // 直接传递新的模式值，避免状态更新延迟问题
    const currentShipTime = timeSyncControllerRef.current.getCurrentTime();
    if (currentShipTime) {
      updateAllShipsPositions(currentShipTime, 'multi', null);
    }
  };

  // 侧栏回调函数
  const handleOverviewClick = () => {
    handleExitSingleMode();
    // 总览功能：调整视角到所有船只的中心，缩放使差值占据页面2/3
    adjustMapViewToBounds(null);
  };

  const handleShipButtonClick = () => {
    setShowShipSearch(!showShipSearch);
  };

  const handleSpeedClick = () => {
    setShowSpeedControl(!showSpeedControl);
  };

  const handleSpeedChange = (newSpeed) => {
    setAnimationSpeed(newSpeed);
    // 如果正在播放，需要重新启动动画以应用新速度
    if (isPlaying && animationFrameRef.current) {
      // 停止当前动画
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      lastAnimationTimeRef.current = null;
      
      // 重新启动动画
      if (Object.keys(allShipsData).length > 0 && timeSyncControllerRef.current && multiShipManagerRef.current) {
        timeSyncControllerRef.current.setSpeed(newSpeed);
        startUnifiedTimeAnimation();
      } else if (currentTrajectory.length > 0) {
        // 向后兼容：单船只模式，重新启动动画
        const startIndex = currentIndex;
        currentAnimationIndexRef.current = startIndex;
        segmentStartIndexRef.current = startIndex;
        lastAnimationTimeRef.current = performance.now();
        segmentStartTimeRef.current = performance.now();
        
        const BASE_TIME_RATIO = 5; // 分钟/秒
        
        const animate = (currentTime) => {
          if (!animationFrameRef.current) {
            return;
          }
          
          const index = segmentStartIndexRef.current;
          if (index >= currentTrajectory.length - 1) {
            if (currentTrajectory[index] && window.updateShipPosition) {
              window.updateShipPosition(currentTrajectory[index]);
              setCurrentIndex(index);
              setSelectedTimeIndex(index);
            }
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            setIsPlaying(false);
            lastAnimationTimeRef.current = null;
            segmentStartTimeRef.current = null;
            return;
          }
          
          const currentPoint = currentTrajectory[index];
          const nextPoint = currentTrajectory[index + 1];
          
          if (!currentPoint || !nextPoint || !window.updateShipPosition) {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            setIsPlaying(false);
            return;
          }
          
          const timeDiffMinutes = getTimeDifference(currentPoint, nextPoint);
          const realTimeMs = (timeDiffMinutes / BASE_TIME_RATIO / newSpeed) * 1000;
          
          const elapsed = currentTime - segmentStartTimeRef.current;
          const progress = Math.min(1, elapsed / realTimeMs);
          
          const interpolatedPoint = interpolatePosition(currentPoint, nextPoint, progress);
          window.updateShipPosition(interpolatedPoint);
          
          const displayIndex = progress >= 1 ? index + 1 : index;
          setCurrentIndex(displayIndex);
          setSelectedTimeIndex(displayIndex);
          
          if (progress >= 1) {
            const nextIndex = index + 1;
            segmentStartIndexRef.current = nextIndex;
            currentAnimationIndexRef.current = nextIndex;
            segmentStartTimeRef.current = currentTime;
            
            if (nextIndex < currentTrajectory.length) {
              window.updateShipPosition(currentTrajectory[nextIndex]);
              setCurrentIndex(nextIndex);
              setSelectedTimeIndex(nextIndex);
            }
          }
          
          if (animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };
        
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }
  };

  /**
   * 处理船只点击事件（进入单船只模式）
   * 如果当前在单船舶模式且选中的是不同的船舶，先退出再进入
   */
  const handleShipClick = (mmsi, position) => {
    // 如果点击的是同一个船舶，不执行任何操作
    if (currentMode === 'single' && selectedShipId === mmsi) {
      return;
    }
    
    // 如果当前在单船舶模式且选中的是不同的船舶，先退出再进入
    if (currentMode === 'single' && selectedShipId && selectedShipId !== mmsi) {
      // 先退出当前单船舶模式
      handleExitSingleMode();
      // 使用 setTimeout 确保退出操作完成后再进入新模式
      setTimeout(() => {
        enterSingleShipMode(mmsi);
      }, 0);
    } else {
      // 直接进入单船舶模式
      enterSingleShipMode(mmsi);
    }
  };
  
  const toggleTrajectoryPoints = () => {
    setShowTrajectoryPoints(!showTrajectoryPoints);
    if (window.updateShipTrajectory && currentTrajectory && Array.isArray(currentTrajectory)) {
      window.updateShipTrajectory(currentTrajectory, {
        showPoints: !showTrajectoryPoints,
        showLine: showTrajectoryLine
      });
    }
  };
  
  const toggleTrajectoryLine = () => {
    setShowTrajectoryLine(!showTrajectoryLine);
    if (window.updateShipTrajectory && currentTrajectory && Array.isArray(currentTrajectory)) {
      window.updateShipTrajectory(currentTrajectory, {
        showPoints: showTrajectoryPoints,
        showLine: !showTrajectoryLine
      });
    }
  };
  
  const getCurrentPointTime = () => {
    if (currentTrajectory[currentIndex] && currentTrajectory[currentIndex].timestamp) {
      try {
        const date = new Date(currentTrajectory[currentIndex].timestamp);
        return date.toLocaleString();
      } catch {
        return currentTrajectory[currentIndex].timestamp;
      }
    }
    return `第 ${currentIndex + 1}/${currentTrajectory.length} 个点`;
  };

  const getUploadStatusText = () => {
    switch(uploadStatus) {
      case 'uploading': return '上传中...';
      case 'success': return '上传成功！';
      case 'error': return '操作失败';
      default: return '';
    }
  };

  const getUploadStatusClass = () => {
    switch(uploadStatus) {
      case 'uploading': return 'status-pending';
      case 'success': return 'status-success';
      case 'error': return 'status-error';
      default: return '';
    }
  };
  
  // 清除数据的函数
  const clearExampleData = () => {
    // 重置所有数据状态
    setCsvData(null);
    setCurrentTrajectory([]);
    setTimeRange([0, 0]);
    setCurrentIndex(0);
    setSelectedTimeIndex(0);
    setIsPlaying(false);
    setUploadStatus('');
    setSelectedFile(null);
    setAllShipsData({});
    setSelectedShipId(null);
    setCurrentMode('multi');
    setCurrentTime(null);
    setGlobalTimeRange(null);
    
    // 清除地图上的轨迹
    if (window.updateShipTrajectory) {
      window.updateShipTrajectory([], { showPoints: false, showLine: false });
    }
    
    // 清除标记
    if (window.ShipMarkersManager) {
      window.ShipMarkersManager.clearAllMarkers();
    }
    
    // 清除轨迹
    if (window.TrajectoryManager) {
      window.TrajectoryManager.hideAllTrajectories();
    }
  };

  // 清理动画定时器
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);
  
  // 实时数据轮询
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(5000); // 默认5秒轮询一次
  const pollingRef = useRef(null);
  
  const toggleRealTimeMode = async () => {
    if (isRealTimeMode) {
      // 关闭实时模式
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setIsRealTimeMode(false);
    } else {
      // 开启实时模式
      // 停止任何正在运行的动画
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
        setIsPlaying(false);
      }
      
      setIsRealTimeMode(true);
      await refreshData(); // 立即刷新一次
      // 设置轮询
      pollingRef.current = setInterval(async () => {
        await refreshData();
      }, pollingInterval);
    }
  };
  
  const refreshData = async () => {
    if (!currentFile) return;
    
    try {
      console.log('刷新数据...');
      const response = await shipAPI.getCSVData(currentFile);
      console.log('数据刷新成功');
      
      // 更新CSV数据
      setCsvData(response.data);
      
      // 处理轨迹点数据
      let trajectory = [];
      const shipsData = {};
      
      // 优先使用ship_groups中的数据
      if (response.data.ship_groups && Object.keys(response.data.ship_groups).length > 0) {
        // 处理所有船只数据
        Object.keys(response.data.ship_groups).forEach(shipId => {
          const shipData = response.data.ship_groups[shipId];
          if (shipData && shipData.data) {
            shipsData[shipId] = shipData;
          }
        });
        
        // 更新所有船只数据
        setAllShipsData(shipsData);
        
        // 使用当前选中的船只数据，如果没有选中则使用第一艘
        const targetShipId = selectedShipId && shipsData[selectedShipId] ? selectedShipId : Object.keys(shipsData)[0];
        if (targetShipId) {
          trajectory = shipsData[targetShipId].data;
        }
      } 
      // 否则使用主数据数组
      else if (response.data.data) {
        trajectory = response.data.data;
        setAllShipsData({});
        setSelectedShipId(null);
      }
      
      // 处理轨迹点，标准化字段
      const processedTrajectory = trajectory.map(point => {
        // 确保经度字段存在
        const lng = point.lon || null;
        const lat = point.lat || null;
        
        // 添加时间戳信息
        let timestamp = null;
        if (point.standard_timestamp) {
          timestamp = point.standard_timestamp;
        } else if (point.timestamp) {
          timestamp = point.timestamp;
        } else if (point.time) {
          timestamp = point.time;
        }
        
        // 确保航向、速度等字段
        const hdg = point.heading || point.hdg || null;
        const cog = point.cog || point.direction || null;
        const speed = point.speed || null;
        const rot = point.rot || null;
        const draught = point.draught || null;
        const status = point.status || null;
        const dest = point.dest || null;
        const eta = point.eta || null;
        const legStartPostime = point.leg_start_postime || null;
        const arrivalTime = point.arrival_time || null;
        
        return { 
          lng, 
          lat, 
          timestamp,
          hdg, 
          cog, 
          speed,
          rot,
          draught,
          status,
          dest,
          eta,
          leg_start_postime: legStartPostime,
          arrival_time: arrivalTime,
          ...point 
        };
      }).filter(point => point.lng && point.lat && !isNaN(point.lng) && !isNaN(point.lat));
      
      // 更新轨迹数据
      setCurrentTrajectory(processedTrajectory);
      setTimeRange([0, processedTrajectory.length - 1]);
      
      // 如果是实时模式且播放中，更新到最新位置
      if (isRealTimeMode && isPlaying && processedTrajectory.length > 0) {
        const latestIndex = processedTrajectory.length - 1;
        setCurrentIndex(latestIndex);
        setSelectedTimeIndex(latestIndex);
        
        // 更新船舶位置到最新点
        if (window.updateShipPosition) {
          window.updateShipPosition(processedTrajectory[latestIndex]);
        }
      }
      
      // 更新地图轨迹
      if (window.updateShipTrajectory && processedTrajectory && Array.isArray(processedTrajectory)) {
        window.updateShipTrajectory(processedTrajectory, {
          showPoints: showTrajectoryPoints,
          showLine: showTrajectoryLine
        });
      }
    } catch (error) {
      console.error('数据刷新失败:', error);
    }
  };
  
  const handlePollingIntervalChange = (e) => {
    const interval = parseInt(e.target.value);
    setPollingInterval(interval);
    
    // 如果已经在实时模式，更新轮询间隔
    if (isRealTimeMode && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        await refreshData();
      }, interval);
    }
  };

  // 获取API状态样式和文本
  const getApiStatusClass = () => {
    switch(apiStatus) {
      case 'connected': return 'api-status-connected';
      case 'disconnected': return 'api-status-disconnected';
      default: return 'api-status-checking';
    }
  };
  
  const getApiStatusText = () => {
    switch(apiStatus) {
      case 'connected': return '✅ 后端服务已连接';
      case 'disconnected': return '❌ 后端服务连接失败';
      default: return '⏳ 正在检查后端连接...';
    }
  };

  return (
    <div className="app-container">
      {/* 侧栏组件 */}
      <Sidebar
        onOverviewClick={handleOverviewClick}
        onShipClick={handleShipButtonClick}
        onSpeedClick={handleSpeedClick}
        onUploadClick={handleUploadClick}
        showShipSearch={showShipSearch}
        showSpeedControl={showSpeedControl}
        onShipSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        animationSpeed={animationSpeed}
        onSpeedChange={handleSpeedChange}
        uploadStatus={uploadStatus}
        onCancelUpload={clearExampleData}
        apiStatus={apiStatus}
        getApiStatusText={getApiStatusText}
        getApiStatusClass={getApiStatusClass}
        allShipsData={allShipsData}
        selectedShipId={selectedShipId}
        currentMode={currentMode}
        onShipSelect={(shipId) => {
          if (currentMode === 'single' && selectedShipId === shipId) {
            return;
          }
          if (currentMode === 'single' && selectedShipId && selectedShipId !== shipId) {
            handleExitSingleMode();
            setTimeout(() => {
              enterSingleShipMode(shipId);
            }, 0);
          } else {
            enterSingleShipMode(shipId);
          }
        }}
      />

      {/* 隐藏的文件输入框 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* 地图和船舶选择区域容器 */}
      <div className="map-and-ship-selector-container">
        {/* 地图显示区域 */}
        <div className="map-container-main">
          <AMapComponent 
            ref={mapRef} 
            multiShipManager={multiShipManagerRef.current}
            onShipClick={handleShipClick}
            onShipDoubleClick={handleShipDoubleClick}
            onExitSingleMode={handleExitSingleMode}
          />
        </div>
        
      </div>
      
      {/* 船只信息弹窗 */}
      <div>
      <ShipInfoModal
        shipInfo={selectedShipInfo}
        isOpen={isShipInfoModalOpen}
        onClose={() => {
          setIsShipInfoModalOpen(false);
          setSelectedShipInfo(null);
        }}
      />
      </div>
      
      {/* 底部控制栏 */}
      <BottomControls
        isPlaying={isPlaying}
        onPlayPause={handlePlayAnimation}
        onReset={handleResetAnimation}
        currentTime={currentTime}
        globalTimeRange={globalTimeRange}
        timeRange={timeRange}
        selectedTimeIndex={selectedTimeIndex}
        onTimeSliderChange={handleTimeSliderChange}
        getCurrentPointTime={getCurrentPointTime}
        currentIndex={currentIndex}
        currentTrajectoryLength={currentTrajectory.length}
      />
    </div>
  );
}

export default App;