import { useEffect, useRef, forwardRef, useState } from 'react';
import ShipMarkersManager from './ShipMarkersManager';
import TrajectoryManager from './TrajectoryManager';

const AMapComponent = forwardRef((props, ref) => {
  const {
    multiShipManager = null,
    onShipClick = null,
    onShipDoubleClick = null,
    onExitSingleMode = null
  } = props;
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const shipMarkerRef = useRef(null);
  const trajectoryPolylineRef = useRef(null);
  const trajectoryPointsRef = useRef([]);
  const currentPositionRef = useRef(null);
  const startPointMarkerRef = useRef(null);
  const endPointMarkerRef = useRef(null);
  const isMountedRef = useRef(true); // 用于跟踪组件是否已卸载
  const [isMapLoaded, setIsMapLoaded] = useState(false); // 用于跟踪地图是否已加载
  const [mapError, setMapError] = useState(null); // 用于跟踪地图加载错误
  const [mouseCoords, setMouseCoords] = useState({ lng: null, lat: null }); // 鼠标位置的经纬度
  
  useEffect(() => {
    // 确保 ref 被正确转发（延迟执行，确保DOM已渲染）
    const timeoutId = setTimeout(() => {
      try {
        if (ref && mapContainerRef.current && isMountedRef.current) {
          if (typeof ref === 'function') {
            ref(mapContainerRef.current);
          } else if (ref && typeof ref === 'object') {
            ref.current = mapContainerRef.current;
          }
        }
      } catch (e) {
        console.warn('转发ref失败:', e);
      }
    }, 0);
    
    // 清理函数：在组件卸载时清理ref（但要小心，因为React可能已经清理了DOM）
    return () => {
      clearTimeout(timeoutId);
      // 不在这里清理ref，让React自己处理
      // 清理ref可能导致React在清理DOM时出错
    };
  }, [ref]);

  useEffect(() => {
    isMountedRef.current = true; // 组件已挂载

    if (!window.AMapLoader) {
      console.error('高德地图API加载器未找到!');
      setMapError('高德地图API加载器未找到');
      return;
    }

    if (!mapContainerRef.current) {
      console.error('地图容器不存在!');
      return;
    }
    
    // 参考旧版本：直接加载，包含插件
    window.AMapLoader.load({
      key: 'e0391c2e682e05ce7e2c17f3584eafe3',
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.Polyline']
    })
    
    .then((AMap) => {
      if (!mapContainerRef.current) return;
      
      // 参考旧版本：直接创建地图，简单配置
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 10,
        center: [116.397026, 39.909787],
        viewMode: '2D',
        features: ['bg', 'road', 'point']
      });
      
      mapRef.current = map;
      
      // 标记地图已加载
      if (isMountedRef.current) {
        setIsMapLoaded(true);
        setMapError(null);
      }
      
      // 参考旧版本：直接添加控件，不延迟
      map.addControl(new AMap.Scale());
      
      // 监听地图鼠标移动事件，获取经纬度
      map.on('mousemove', (e) => {
        if (isMountedRef.current) {
          const lng = e.lnglat.getLng();
          const lat = e.lnglat.getLat();
          setMouseCoords({ lng, lat });
        }
      });
      
      // 暴露地图实例给外部使用
      window.getMap = () => {
        return mapRef.current;
      };
      
      // 创建船舶标记 - 使用箭头图标表示船舶位置和方向
      const shipIcon = new AMap.Icon({
        size: new AMap.Size(32, 32),
        image: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2 L28 16 L22 16 L22 28 L10 28 L10 16 L4 16 Z" fill="%232196f3" stroke="%23ffffff" stroke-width="1.5"/></svg>',
        imageSize: new AMap.Size(32, 32)
      });
      
      // 创建船舶标记，但初始时不显示在地图上，等待实际数据
      const shipMarker = new AMap.Marker({
        position: [116.397026, 39.909787],
        icon: shipIcon,
        offset: new AMap.Pixel(-16, -16),
        // 初始时不设置map属性，这样标记不会显示
        zIndex: 1000,
        rotation: 0
      });
      
      shipMarkerRef.current = shipMarker;
      
      // 添加工具栏（可选，如果不需要可以注释掉）
      // if (AMap.ToolBar) {
      //   try {
      //     map.addControl(new AMap.ToolBar({
      //       position: { top: '20px', right: '20px' }
      //     }));
      //   } catch (e) {
      //     console.warn('添加工具栏控件失败:', e);
      //   }
      // }
      
      // 注意：不再在这里移除React子元素，因为加载提示已经移到容器外部
      // 这样可以避免干扰地图的初始化过程

      // 创建轨迹线条样式
      const lineStyle = {
        path: 'M 0,-1 0,1',
        strokeColor: '#2196f3',
        strokeWidth: 3,
        strokeOpacity: 0.8
      };
      
      // 创建导航路径
      const lineDash = [40, 20];
      
      // 暴露接口给全局使用（参考旧版本简化）
      window.updateShipTrajectory = (trajectory, options = {}) => {
        const {
          showPoints = true,
          showLine = true,
          pointSize = 8,
          pointColor = '#ff9800',
          lineColor = '#2196f3'
        } = options;
        
        // 清除之前的轨迹元素
        if (trajectoryPolylineRef.current) {
          if (Array.isArray(trajectoryPolylineRef.current)) {
            trajectoryPolylineRef.current.forEach(line => map.remove(line));
          } else {
            map.remove(trajectoryPolylineRef.current);
          }
          trajectoryPolylineRef.current = null;
        }
        
        // 清除之前的轨迹点
        if (trajectoryPointsRef.current && trajectoryPointsRef.current.length > 0) {
          map.remove(trajectoryPointsRef.current);
          trajectoryPointsRef.current = [];
        }
        
        // 清除起点和终点标记
        if (startPointMarkerRef.current) {
          map.remove(startPointMarkerRef.current);
          startPointMarkerRef.current = null;
        }
        if (endPointMarkerRef.current) {
          map.remove(endPointMarkerRef.current);
          endPointMarkerRef.current = null;
        }
        
        if (!trajectory || trajectory.length === 0) return;
        
        // 提取轨迹点坐标（参考旧版本，简单直接）
        const path = trajectory.map(point => [point.lon || point.lng, point.lat]);
        
        // 显示轨迹连线
        if (showLine && path.length > 1) {
          const shadowPolyline = new AMap.Polyline({
            path: path,
            borderWeight: 12,
            strokeColor: '#000000',
            strokeOpacity: 0.3,
            lineJoin: 'round',
            lineCap: 'round'
          });
          shadowPolyline.setMap(map);
          
          const polyline = new AMap.Polyline({
            path: path,
            borderWeight: 6,
            strokeColor: '#ff4757',
            lineJoin: 'round',
            lineCap: 'round',
            strokeStyle: 'solid',
            strokeOpacity: 0.9,
            showDir: true,
            dirColor: '#ffffff',
            dirFrequency: 1,
            dirLength: 30,
            dirOpacity: 1
          });
          
          polyline.setMap(map);
          trajectoryPolylineRef.current = [shadowPolyline, polyline];
        }
        
        // 显示轨迹点（参考旧版本）
        if (showPoints) {
          const markers = [];
          const iconUrls = [
            'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="%232196f3"><circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="6" fill="%23ffffff"/></svg>',
            'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="%234caf50"><circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="6" fill="%23ffffff"/></svg>',
            'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="%23ff9800"><circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="6" fill="%23ffffff"/></svg>',
            'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="%239c27b0"><circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="6" fill="%23ffffff"/></svg>'
          ];
          
          trajectory.forEach((point, index) => {
            if (index === 0) {
              const startMarker = new AMap.Marker({
                position: [point.lon || point.lng, point.lat],
                icon: new AMap.Icon({
                  size: new AMap.Size(18, 18),
                  image: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="%234caf50"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="8" fill="%23ffffff"/><path d="M20 8v16M16 12l8 8M24 12l-8 8" stroke="%23ffffff" stroke-width="2"/></svg>',
                  imageSize: new AMap.Size(18, 18)
                }),
                offset: new AMap.Pixel(-9, -9),
                title: `起点 - ${index + 1}`
              });
              try {
                if (typeof startMarker.setAnimation === 'function') {
                  startMarker.setAnimation('AMAP_ANIMATION_BOUNCE');
                }
              } catch (e) {
                console.log('设置动画失败:', e.message);
              }
              startMarker.setMap(map);
              markers.push(startMarker);
              startPointMarkerRef.current = startMarker;
            } else if (index === trajectory.length - 1) {
              const endMarker = new AMap.Marker({
                position: [point.lon || point.lng, point.lat],
                icon: new AMap.Icon({
                  size: new AMap.Size(18, 18),
                  image: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="%23f44336"><circle cx="20" cy="20" r="18"/><path d="M20 10l8 8-8 8-8-8z" fill="%23ffffff"/></svg>',
                  imageSize: new AMap.Size(18, 18)
                }),
                offset: new AMap.Pixel(-9, -9),
                title: `终点 - ${index + 1}`
              });
              try {
                if (typeof endMarker.setAnimation === 'function') {
                  endMarker.setAnimation('AMAP_ANIMATION_BOUNCE');
                }
              } catch (e) {
                console.log('设置动画失败:', e.message);
              }
              endMarker.setMap(map);
              markers.push(endMarker);
              endPointMarkerRef.current = endMarker;
            } else {
              if (trajectory.length <= 50 || index % Math.ceil(trajectory.length / 50) === 0) {
                const iconIndex = index % iconUrls.length;
                const midMarker = new AMap.Marker({
                  position: [point.lon || point.lng, point.lat],
                  icon: new AMap.Icon({
                    size: new AMap.Size(10, 10),
                    image: iconUrls[iconIndex],
                    imageSize: new AMap.Size(10, 10)
                  }),
                  offset: new AMap.Pixel(-5, -5),
                  title: `轨迹点 ${index + 1}`
                });
                
                if (index === Math.floor(trajectory.length * 0.25) || 
                    index === Math.floor(trajectory.length * 0.5) || 
                    index === Math.floor(trajectory.length * 0.75)) {
                  try {
                    if (typeof midMarker.setAnimation === 'function') {
                      midMarker.setAnimation('AMAP_ANIMATION_DROP');
                    }
                  } catch (e) {
                    console.log('设置动画失败:', e.message);
                  }
                }
                
                midMarker.setMap(map);
                markers.push(midMarker);
              }
              const circleMarker = new AMap.CircleMarker({
                center: [point.lon || point.lng, point.lat],
                radius: 3,
                fillColor: '#ff6b81',
                strokeColor: '#ffffff',
                strokeWidth: 1,
                opacity: 0.5,
                title: `轨迹点 - ${index + 1}`
              });
              circleMarker.setMap(map);
              markers.push(circleMarker);
            }
          });
          
          if (trajectory.length > 2) {
            const midPointIndex = Math.floor(trajectory.length / 2);
            const midPoint = trajectory[midPointIndex];
            
            const infoMarker = new AMap.Marker({
              position: [midPoint.lon || midPoint.lng, midPoint.lat],
              icon: new AMap.Icon({
                size: new AMap.Size(15, 15),
                image: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 35" fill="%23ffeb3b"><circle cx="17.5" cy="17.5" r="15"/><circle cx="17.5" cy="14" r="3" fill="%23ffffff"/><path d="M17.5 24c-2 0-4-1-4-3s2-3 4-3 4 1 4 3-2 3-4 3z" fill="%23ffffff"/></svg>',
                imageSize: new AMap.Size(15, 15)
              }),
              offset: new AMap.Pixel(-7, -7),
              title: `中点 - 轨迹${Math.floor(trajectory.length / 2)}号点`
            });
            
            const infoWindow = new AMap.InfoWindow({
              content: `<div style="padding: 10px;">
                          <h4>轨迹中点信息</h4>
                          <p>经度: ${(midPoint.lon || midPoint.lng).toFixed(4)}</p>
                          <p>纬度: ${midPoint.lat.toFixed(4)}</p>
                          <p>序号: ${midPointIndex + 1}/${trajectory.length}</p>
                        </div>`,
              offset: new AMap.Pixel(0, -40)
            });
            
            infoMarker.on('click', function() {
              infoWindow.open(map, infoMarker.getPosition());
            });
            
            infoMarker.setMap(map);
            markers.push(infoMarker);
          }
          
          trajectoryPointsRef.current = markers;
        }
        
        // 调整地图视野以显示整个轨迹
        if (path.length > 1) {
          try {
            map.setFitView(path, false, [50, 50]);
            map.setStatus({
              dragEnable: true,
              zoomEnable: true,
              scrollWheel: true,
              doubleClickZoom: true
            });
          } catch (error) {
            console.warn('调整地图视野失败，使用备选方案:', error);
            const midIndex = Math.floor(path.length / 2);
            map.setCenter(path[midIndex]);
            map.setZoom(5);
            map.setStatus({
              dragEnable: true,
              zoomEnable: true,
              scrollWheel: true,
              doubleClickZoom: true
            });
          }
        }
      };
      
      // 更新船舶位置的内部函数
      // 注意：平滑动画由App.jsx中的插值逻辑处理，这里直接更新位置即可
      // 添加位置和角度变化阈值，避免抖动
      // 使用闭包变量保存上次更新的位置和角度，避免频繁更新导致抖动
      let lastUpdatePosition = null;
      let lastUpdateRotation = null;
      
      const updateShipPositionInternal = (position) => {
        if (!shipMarkerRef.current || !position || (!position.lon && !position.lng) || !position.lat) return;
        
        // 更新船舶标记位置，直接设置（平滑移动由插值逻辑处理）
        const newPosition = [position.lon || position.lng, position.lat];
        
        // 检查位置变化是否足够大，避免微小变化导致抖动
        let shouldUpdatePosition = true;
        if (lastUpdatePosition) {
          // 计算位置距离（使用简单的欧几里得距离近似）
          const latDiff = newPosition[1] - lastUpdatePosition[1];
          const lngDiff = newPosition[0] - lastUpdatePosition[0];
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          
          // 根据地图缩放级别动态调整阈值
          // 缩放级别越高，阈值越小（更精确），但最小不低于0.000005度
          let threshold = 0.00001; // 默认阈值（约1米）
          try {
            const zoom = map.getZoom();
            if (zoom > 15) {
              threshold = 0.000005; // 高缩放级别，更精确（约0.5米）
            } else if (zoom > 10) {
              threshold = 0.00001; // 中等缩放级别（约1米）
            } else {
              threshold = 0.00002; // 低缩放级别，允许更大变化（约2米）
            }
          } catch (e) {
            // 如果获取缩放级别失败，使用默认值
          }
          
          // 只有当距离变化超过阈值时才更新，避免抖动
          shouldUpdatePosition = distance > threshold;
        }
        
        if (shouldUpdatePosition) {
          try {
            shipMarkerRef.current.setPosition(newPosition);
            // 确保标记已添加到地图上
            if (!shipMarkerRef.current.getMap()) {
              shipMarkerRef.current.setMap(map);
            }
            lastUpdatePosition = [...newPosition]; // 保存位置副本
          } catch (e) {
            console.log('更新位置失败:', e.message);
          }
        }
        
        // 设置船舶方向（优先使用hdg作为船首方向，如果没有则使用cog作为移动方向）
        let rotation = 0;
        if (position.hdg !== null && position.hdg !== undefined) {
          rotation = position.hdg;
        } else if (position.cog !== null && position.cog !== undefined) {
          rotation = position.cog;
        }
        
        // 安全地设置旋转角度，添加错误处理和变化阈值
        try {
          // 检查getRotation方法是否存在
          if (typeof shipMarkerRef.current.getRotation === 'function') {
            // 只有当方向变化明显时才更新，避免频繁旋转
            const currentRotation = shipMarkerRef.current.getRotation() || 0;
            const rotationDiff = Math.abs(currentRotation - rotation);
            // 处理角度跨越360度的情况
            const normalizedDiff = Math.min(rotationDiff, 360 - rotationDiff);
            // 提高阈值到2度，减少抖动
            if (normalizedDiff > 2 || lastUpdateRotation === null) {
              shipMarkerRef.current.setRotation(rotation);
              lastUpdateRotation = rotation;
            }
          } else {
            // 如果getRotation方法不存在，检查是否需要更新
            if (lastUpdateRotation === null || Math.abs(lastUpdateRotation - rotation) > 2) {
              shipMarkerRef.current.setRotation(rotation);
              lastUpdateRotation = rotation;
            }
          }
        } catch (error) {
          console.warn('设置船舶方向失败:', error);
          // 即使出错也要尝试设置旋转，这是核心功能
          try {
            shipMarkerRef.current.setRotation(rotation);
            lastUpdateRotation = rotation;
          } catch (e) {
            console.error('无法设置船舶旋转:', e);
          }
        }
        
        // 更新当前位置的高亮效果
        if (currentPositionRef.current) {
          map.remove(currentPositionRef.current);
        }
        
        // 创建一个带有脉冲动画效果的圆圈表示当前位置
        const currentCircle = new AMap.CircleMarker({
          center: newPosition,
          radius: 8,
          fillColor: '#ffeb3b',
          strokeColor: '#ff9800',
          strokeWidth: 2,
          opacity: 0.8
        });
        
        // 添加脉冲动画效果
        let radius = 8;
        let opacity = 0.8;
        const pulseInterval = setInterval(() => {
          if (!currentPositionRef.current) {
            clearInterval(pulseInterval);
            return;
          }
          
          radius += 0.5;
          opacity -= 0.05;
          
          if (opacity <= 0) {
            radius = 8;
            opacity = 0.8;
          }
          
          // 添加安全检查，避免currentCircle已被移除或方法不存在时的TypeError
          if (currentCircle && typeof currentCircle.setRadius === 'function' && typeof currentCircle.setOpacity === 'function') {
            currentCircle.setRadius(radius);
            currentCircle.setOpacity(opacity);
          } else {
            // 如果currentCircle已经无效，清除定时器
            clearInterval(pulseInterval);
          }
        }, 100);
        
        currentCircle.setMap(map);
        currentPositionRef.current = currentCircle;
        
        // 设置船舶信息标签，包含速度、船首方向、移动方向、转向速度、吃水、状态、目的地和时间信息
        let titleText = '';
        if (position.speed) {
          titleText += `速度: ${position.speed} 节`;
        }
        if (position.hdg) {
          titleText += (titleText ? '\n' : '') + `船首方向: ${position.hdg}°`;
        }
        if (position.cog) {
          titleText += (titleText ? '\n' : '') + `移动方向: ${position.cog}°`;
        }
        if (position.rot !== undefined && position.rot !== null) {
          titleText += (titleText ? '\n' : '') + `转向速度: ${position.rot}°/min`;
        }
        if (position.draught !== undefined && position.draught !== null) {
          titleText += (titleText ? '\n' : '') + `吃水: ${position.draught} m`;
        }
        if (position.status !== undefined && position.status !== null) {
          titleText += (titleText ? '\n' : '') + `状态: ${position.status}`;
        }
        if (position.dest !== undefined && position.dest !== null && position.dest !== 'nan') {
          titleText += (titleText ? '\n' : '') + `目的地: ${position.dest}`;
        }
        // 添加时间相关字段
        if (position.eta !== undefined && position.eta !== null && position.eta !== 'nan') {
          titleText += (titleText ? '\n' : '') + `预计到达: ${position.eta}`;
        }
        if (position.leg_start_postime !== undefined && position.leg_start_postime !== null && position.leg_start_postime !== 'nan') {
          titleText += (titleText ? '\n' : '') + `航段出发: ${position.leg_start_postime}`;
        }
        if (position.arrival_time !== undefined && position.arrival_time !== null && position.arrival_time !== 'nan') {
          titleText += (titleText ? '\n' : '') + `实际到达: ${position.arrival_time}`;
        }
        if (titleText) {
          shipMarkerRef.current.setTitle(titleText);
        }
      };
      
      // 暴露船舶位置更新接口给全局
      window.updateShipPosition = updateShipPositionInternal;
      
      // 性能优化
      try {
        const canvas = mapContainerRef.current.querySelector('canvas');
        if (canvas) canvas.willReadFrequently = true;
      } catch(e) {
        console.log('Canvas优化提示:', e.message);
      }
    })
    .catch((error) => {
      console.error('高德地图加载失败:', error);
      if (isMountedRef.current) {
        setIsMapLoaded(false);
        setMapError(error.message || error.toString() || '未知错误');
      }
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = `
          <div style="padding: 50px; text-align: center; background: #ffecb3; border-radius: 8px;">
            <h3 style="color: #d32f2f;">地图加载失败</h3>
            <p>错误代码: ${error.name}</p>
            <p>请检查网络连接或高德地图API密钥是否正确</p>
            <button style="padding: 10px 20px; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;" 
                    onclick="window.location.reload()">
              🔄 刷新页面
            </button>
          </div>
        `;
      }
    });
    
    // 清理函数（参考旧版本简化）
    return () => {
      isMountedRef.current = false;
      setIsMapLoaded(false);
      setMapError(null);
      
      // 先清理ShipMarkersManager和TrajectoryManager（在清理地图之前）
      if (window.ShipMarkersManager && typeof window.ShipMarkersManager.clearAllMarkers === 'function') {
        try {
          window.ShipMarkersManager.clearAllMarkers();
        } catch (e) {
          console.warn('清理ShipMarkersManager失败:', e);
        }
      }
      
      if (window.TrajectoryManager && typeof window.TrajectoryManager.hideAllTrajectories === 'function') {
        try {
          window.TrajectoryManager.hideAllTrajectories();
        } catch (e) {
          console.warn('清理TrajectoryManager失败:', e);
        }
      }
      
      // 移除全局引用
      if (window.updateShipTrajectory) {
        delete window.updateShipTrajectory;
      }
      if (window.updateShipPosition) {
        delete window.updateShipPosition;
      }
      if (window.getMap) {
        delete window.getMap;
      }
      
      // 清理所有地图元素（参考旧版本）
      if (mapRef.current) {
        const allFeatures = [];
        if (shipMarkerRef.current) allFeatures.push(shipMarkerRef.current);
        
        if (trajectoryPolylineRef.current) {
          if (Array.isArray(trajectoryPolylineRef.current)) {
            allFeatures.push(...trajectoryPolylineRef.current);
          } else {
            allFeatures.push(trajectoryPolylineRef.current);
          }
        }
        
        if (currentPositionRef.current) allFeatures.push(currentPositionRef.current);
        if (startPointMarkerRef.current) allFeatures.push(startPointMarkerRef.current);
        if (endPointMarkerRef.current) allFeatures.push(endPointMarkerRef.current);
        if (trajectoryPointsRef.current) allFeatures.push(...trajectoryPointsRef.current);
        
        if (allFeatures.length > 0) {
          mapRef.current.remove(allFeatures);
        }
        
        // 清理地图实例
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  // 集成ShipMarkersManager和TrajectoryManager，设置事件回调
  useEffect(() => {
    // 检查必要的前提条件
    if (!multiShipManager) {
      return;
    }

    // 延迟设置回调，确保ShipMarkersManager已初始化
    const timeoutId = setTimeout(() => {
      // 检查地图是否已准备好
      if (!mapRef.current) {
        return;
      }

      // 设置标记管理器的点击和双击事件回调
      if (window.ShipMarkersManager) {
        // 设置点击事件回调
        if (onShipClick) {
          window.ShipMarkersManager.setOnMarkerClick((mmsi, position) => {
            console.log('船只点击事件:', mmsi, position);
            onShipClick(mmsi, position);
          });
        }

        // 设置双击事件回调
        if (onShipDoubleClick) {
          window.ShipMarkersManager.setOnMarkerDoubleClick((mmsi, position) => {
            console.log('船只双击事件:', mmsi, position);
            onShipDoubleClick(mmsi, position);
          });
        }
      }
    }, 100);

    // 清理函数
    return () => {
      clearTimeout(timeoutId);
      // 清理标记管理器回调
      if (window.ShipMarkersManager) {
        if (window.ShipMarkersManager.setOnMarkerClick) {
          window.ShipMarkersManager.setOnMarkerClick(null);
        }
        if (window.ShipMarkersManager.setOnMarkerDoubleClick) {
          window.ShipMarkersManager.setOnMarkerDoubleClick(null);
        }
      }
    };
  }, [multiShipManager, onShipClick, onShipDoubleClick]);

  // 使用wrapper结构，避免React清理高德地图修改的DOM节点
  return (
    <>
      <style>{`
        .mouse-coords-display {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 6px;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          color: #fff;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          pointer-events: none;
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      {/* 地图容器 - 让高德地图API完全控制这个div */}
      <div 
        ref={mapContainerRef}
        id="map"
        style={{ 
          width: '100%', 
          height: '100%', 
          minHeight: '500px', 
          background: 'transparent', 
          borderRadius: '4px',
          position: 'relative',
          zIndex: 0,
          // 确保容器可见
          display: 'block',
          overflow: 'hidden'
        }}
      />
      
      {/* 地图加载中的提示 - 使用绝对定位覆盖在容器上，不放入容器内部 */}
      {!isMapLoaded && !mapError && (
        <div 
          key="map-loading-overlay"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: '80px 20px', 
            color: '#666', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: '#f5f5f5',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#90caf9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px' }}>
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <h3 style={{ margin: 0, color: '#0d47a1', fontSize: '1.2em' }}>地图加载中...</h3>
          <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '0.9em' }}>正在连接高德地图服务</p>
          <div style={{ marginTop: '5px', fontSize: '0.85em', opacity: 0.8 }}>请稍候，地图初始化需要一点时间</div>
        </div>
      )}
      
      {/* 地图加载错误提示 */}
      {mapError && (
        <div 
          key="map-error-overlay"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: '80px 20px', 
            color: '#d32f2f', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: '#ffecb3',
            zIndex: 1,
            pointerEvents: 'auto'
          }}
        >
          <h3 style={{ margin: 0, color: '#d32f2f', fontSize: '1.2em' }}>地图加载失败</h3>
          <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '0.9em' }}>{mapError}</p>
          <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '0.85em', color: '#666' }}>请检查网络连接或高德地图API密钥是否正确</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: '20px',
              padding: '10px 20px', 
              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 500 
            }}
          >
            🔄 刷新页面
          </button>
        </div>
      )}
      
      {/* 集成ShipMarkersManager和TrajectoryManager */}
      {mapRef.current && multiShipManager && (
        <>
          <ShipMarkersManager 
            map={mapRef.current} 
            multiShipManager={multiShipManager} 
          />
          <TrajectoryManager map={mapRef.current} />
        </>
      )}
      
      {/* 右下角经纬度显示 */}
      {mouseCoords.lng !== null && mouseCoords.lat !== null && (
        <div className="mouse-coords-display">
          经度: {mouseCoords.lng.toFixed(6)}, 纬度: {mouseCoords.lat.toFixed(6)}
        </div>
      )}
      </div>
    </>
  );
});

export default AMapComponent;