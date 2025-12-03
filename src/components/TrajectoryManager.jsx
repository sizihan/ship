import { useEffect, useRef } from 'react';

/**
 * 轨迹管理器组件
 * 职责：管理船只轨迹线的显示/隐藏
 * 默认隐藏所有轨迹线和轨迹点
 */
const TrajectoryManager = ({ map }) => {
  // 存储轨迹线和轨迹点：Map<mmsi, {polyline, points: []}>
  const trajectoriesRef = useRef(new Map());

  /**
   * 显示指定船只的轨迹
   * @param {string} mmsi - 船只MMSI
   * @param {Array} trajectory - 轨迹点数组
   * @param {Object} options - 选项 {color, lineWidth, pointSize}
   */
  const showShipTrajectory = (mmsi, trajectory, options = {}) => {
    if (!map || !trajectory || trajectory.length === 0) {
      console.warn(`TrajectoryManager: 无法显示轨迹 ${mmsi}`);
      return;
    }

    // 如果轨迹已存在，先隐藏
    if (trajectoriesRef.current.has(mmsi)) {
      hideShipTrajectory(mmsi);
    }

    const {
      color = '#2196f3',
      lineWidth = 3,
      pointSize = 8,
      lineOpacity = 0.8,
      pointOpacity = 0.6
    } = options;

    try {
      // 提取轨迹点坐标
      const path = trajectory
        .filter(point => point && (point.lon || point.lng) && point.lat)
        .map(point => [point.lon || point.lng || 0, point.lat || 0]);

      if (path.length === 0) {
        console.warn(`TrajectoryManager: 轨迹 ${mmsi} 没有有效坐标点`);
        return;
      }

      // 创建轨迹线
      const polyline = new window.AMap.Polyline({
        path: path,
        isOutline: true,
        outlineColor: '#ffffff',
        borderWeight: 2,
        strokeColor: color,
        strokeOpacity: lineOpacity,
        strokeWeight: lineWidth,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 100,
        map: map
      });

      // 创建轨迹点（起点、终点和关键点）
      const points = [];
      
      // 起点标记（绿色）
      if (path.length > 0) {
        const startPoint = trajectory[0];
        const startMarker = new window.AMap.Marker({
          position: path[0],
          icon: new window.AMap.Icon({
            size: new window.AMap.Size(pointSize + 4, pointSize + 4),
            image: `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pointSize + 4} ${pointSize + 4}"><circle cx="${(pointSize + 4) / 2}" cy="${(pointSize + 4) / 2}" r="${pointSize / 2}" fill="%234caf50" opacity="${pointOpacity}"/><circle cx="${(pointSize + 4) / 2}" cy="${(pointSize + 4) / 2}" r="${pointSize / 4}" fill="%23ffffff"/></svg>`,
            imageSize: new window.AMap.Size(pointSize + 4, pointSize + 4)
          }),
          offset: new window.AMap.Pixel(-(pointSize + 4) / 2, -(pointSize + 4) / 2),
          zIndex: 200,
          title: `起点 - ${startPoint.postime || ''}`
        });
        startMarker.setMap(map);
        points.push(startMarker);
      }

      // 终点标记（红色）
      if (path.length > 1) {
        const endPoint = trajectory[trajectory.length - 1];
        const endMarker = new window.AMap.Marker({
          position: path[path.length - 1],
          icon: new window.AMap.Icon({
            size: new window.AMap.Size(pointSize + 4, pointSize + 4),
            image: `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pointSize + 4} ${pointSize + 4}"><circle cx="${(pointSize + 4) / 2}" cy="${(pointSize + 4) / 2}" r="${pointSize / 2}" fill="%23f44336" opacity="${pointOpacity}"/><circle cx="${(pointSize + 4) / 2}" cy="${(pointSize + 4) / 2}" r="${pointSize / 4}" fill="%23ffffff"/></svg>`,
            imageSize: new window.AMap.Size(pointSize + 4, pointSize + 4)
          }),
          offset: new window.AMap.Pixel(-(pointSize + 4) / 2, -(pointSize + 4) / 2),
          zIndex: 200,
          title: `终点 - ${endPoint.postime || ''}`
        });
        endMarker.setMap(map);
        points.push(endMarker);
      }

      // 中间轨迹点（根据轨迹点数量决定显示密度）
      if (!trajectory || !Array.isArray(trajectory) || trajectory.length === 0) {
        return;
      }
      const step = trajectory.length <= 50 ? 1 : Math.ceil(trajectory.length / 50);
      for (let i = step; i < trajectory.length - 1; i += step) {
        const point = trajectory[i];
        if (!point || (!point.lon && !point.lng) || !point.lat) {
          continue;
        }

        const circleMarker = new window.AMap.CircleMarker({
          center: [point.lon || point.lng || 0, point.lat || 0],
          radius: pointSize / 2,
          strokeColor: color,
          strokeWeight: 1,
          strokeOpacity: pointOpacity,
          fillColor: color,
          fillOpacity: pointOpacity * 0.5,
          zIndex: 150,
          map: map
        });
        points.push(circleMarker);
      }

      // 存储轨迹
      trajectoriesRef.current.set(mmsi, {
        polyline,
        points
      });

      console.log(`TrajectoryManager: 已显示船只 ${mmsi} 的轨迹，共 ${path.length} 个点`);
    } catch (e) {
      console.error(`TrajectoryManager: 显示轨迹失败 ${mmsi}:`, e);
    }
  };

  /**
   * 隐藏指定船只的轨迹
   * @param {string} mmsi - 船只MMSI
   */
  const hideShipTrajectory = (mmsi) => {
    if (!trajectoriesRef.current.has(mmsi)) {
      return;
    }

    try {
      const trajectory = trajectoriesRef.current.get(mmsi);
      
      // 移除轨迹线
      if (trajectory.polyline) {
        trajectory.polyline.setMap(null);
      }

      // 移除轨迹点
      if (trajectory.points && Array.isArray(trajectory.points)) {
        trajectory.points.forEach(point => {
          try {
            point.setMap(null);
          } catch (e) {
            console.warn(`移除轨迹点失败:`, e);
          }
        });
      }

      trajectoriesRef.current.delete(mmsi);
      console.log(`TrajectoryManager: 已隐藏船只 ${mmsi} 的轨迹`);
    } catch (e) {
      console.error(`TrajectoryManager: 隐藏轨迹失败 ${mmsi}:`, e);
    }
  };

  /**
   * 隐藏所有船只轨迹
   */
  const hideAllTrajectories = () => {
    const mmsiList = Array.from(trajectoriesRef.current.keys());
    mmsiList.forEach(mmsi => {
      hideShipTrajectory(mmsi);
    });
    console.log(`TrajectoryManager: 已隐藏所有轨迹`);
  };

  /**
   * 显示所有船只轨迹（如果提供了船只数据）
   * @param {Object} shipGroups - 船只分组数据 {mmsi: {data: [...], ...}}
   */
  const showAllTrajectories = (shipGroups = {}) => {
    for (const [mmsi, shipData] of Object.entries(shipGroups)) {
      const trajectory = shipData.data || [];
      if (trajectory.length > 0) {
        showShipTrajectory(mmsi, trajectory);
      }
    }
  };

  // 暴露接口给外部使用
  useEffect(() => {
    if (window.TrajectoryManager) {
      window.TrajectoryManager.showShipTrajectory = showShipTrajectory;
      window.TrajectoryManager.hideShipTrajectory = hideShipTrajectory;
      window.TrajectoryManager.hideAllTrajectories = hideAllTrajectories;
      window.TrajectoryManager.showAllTrajectories = showAllTrajectories;
    } else {
      window.TrajectoryManager = {
        showShipTrajectory,
        hideShipTrajectory,
        hideAllTrajectories,
        showAllTrajectories
      };
    }

    return () => {
      hideAllTrajectories();
      if (window.TrajectoryManager) {
        delete window.TrajectoryManager;
      }
    };
  }, [map]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      hideAllTrajectories();
    };
  }, []);

  // 这个组件不渲染任何DOM元素
  return null;
};

export default TrajectoryManager;
