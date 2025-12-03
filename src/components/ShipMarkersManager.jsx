import { useEffect, useRef } from 'react';

/**
 * 船只标记管理器组件
 * 职责：管理所有船只标记的渲染和更新，支持批量更新和双模式显示（正常/虚化）
 */
const ShipMarkersManager = ({ map, multiShipManager }) => {
  // 使用对象池管理标记：Map<mmsi, AMap.Marker>
  const markersRef = useRef(new Map());
  
  // 标记点击事件回调
  const onMarkerClickRef = useRef(null);
  const onMarkerDoubleClickRef = useRef(null);

  // 图片缓存：Map<color, dataURL>
  const imageCacheRef = useRef(new Map());
  
  /**
   * 将HSL颜色转换为RGB
   * @param {string} hslColor - HSL颜色字符串，格式如 "hsl(200, 70%, 50%)"
   * @returns {Object} {r, g, b} RGB值 (0-255)
   */
  const hslToRgb = (hslColor) => {
    const hslMatch = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!hslMatch) {
      return { r: 0, g: 0, b: 0 };
    }

    const h = parseInt(hslMatch[1], 10) / 360; // 色相 (0-1)
    const s = parseInt(hslMatch[2], 10) / 100; // 饱和度 (0-1)
    const l = parseInt(hslMatch[3], 10) / 100; // 亮度 (0-1)

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // 无色彩，灰度
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  };

  /**
   * 使用Canvas API生成彩色图片（带边框）
   * @param {string} color - HSL颜色字符串
   * @param {number} size - 图片大小
   * @returns {Promise<string>} base64 dataURL
   */
  const generateColoredImage = async (color, size) => {
    // 检查缓存
    const cacheKey = `${color}_${size}`;
    if (imageCacheRef.current.has(cacheKey)) {
      return imageCacheRef.current.get(cacheKey);
    }

    return new Promise((resolve, reject) => {
      // 加载原始箭头图片
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // 加载边框图片
        const borderImg = new Image();
        borderImg.crossOrigin = 'anonymous';
        
        borderImg.onload = () => {
          try {
            // 创建Canvas
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // 第一步：绘制原始箭头图片
            ctx.drawImage(img, 0, 0, size, size);

            // 第二步：获取图片数据并应用颜色
            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;

            // 将HSL颜色转换为RGB
            const rgb = hslToRgb(color);

            // 对每个像素应用颜色：对于全黑图片，将黑色像素替换为目标颜色
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // 判断是否为黑色像素（允许一定的容差）
              // 如果像素是黑色或接近黑色，则替换为目标颜色
              if (a > 0 && (r < 50 && g < 50 && b < 50)) {
                // 使用目标颜色，保持原始alpha通道
                data[i] = rgb.r;     // R
                data[i + 1] = rgb.g; // G
                data[i + 2] = rgb.b; // B
                // data[i + 3] 保持原始alpha
              }
            }

            // 将修改后的数据写回Canvas
            ctx.putImageData(imageData, 0, 0);

            // 第三步：叠加边框图片（绘制在彩色箭头之上）
            ctx.drawImage(borderImg, 0, 0, size, size);

            // 转换为base64 dataURL
            const dataURL = canvas.toDataURL('image/png');

            // 缓存结果
            imageCacheRef.current.set(cacheKey, dataURL);

            resolve(dataURL);
          } catch (error) {
            console.error('生成彩色图片失败:', error);
            reject(error);
          }
        };

        borderImg.onerror = (error) => {
          console.error('加载边框图片失败:', error);
          // 如果边框加载失败，仍然返回彩色箭头（不带边框）
          try {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, size, size);

            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;
            const rgb = hslToRgb(color);

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              if (a > 0 && (r < 50 && g < 50 && b < 50)) {
                data[i] = rgb.r;
                data[i + 1] = rgb.g;
                data[i + 2] = rgb.b;
              }
            }

            ctx.putImageData(imageData, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            imageCacheRef.current.set(cacheKey, dataURL);
            resolve(dataURL);
          } catch (e) {
            reject(e);
          }
        };

        borderImg.src = '/icons/bian.svg';
      };

      img.onerror = (error) => {
        console.error('加载箭头图片失败:', error);
        reject(error);
      };

      img.src = '/icons/ship.svg';
    });
  };

  /**
   * 创建船舶图标（使用Canvas生成的彩色图片）
   * @param {number} size - 图标大小
   * @param {string} color - 颜色（HSL格式，用于给全黑箭头图片着色）
   * @param {number} opacity - 透明度（0-1），默认为1
   * @param {number} rotation - 旋转角度（度）
   * @returns {Promise<Object>} {htmlContent} - HTML内容字符串
   */
  const createShipIcon = async (size, color, opacity = 1.0, rotation = 0) => {
    try {
      // 使用Canvas生成彩色图片
      const coloredImageUrl = await generateColoredImage(color, size);
      
      // 创建自定义HTML内容，支持旋转和颜色
      const htmlContent = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          transform: rotate(${rotation}deg);
          transform-origin: center center;
          opacity: ${opacity};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img 
            src="${coloredImageUrl}" 
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
            "
            alt="ship"
          />
        </div>
      `;
      
      return { htmlContent };
    } catch (error) {
      console.error('创建船舶图标失败:', error);
      // 如果失败，返回原始图片
      const htmlContent = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          transform: rotate(${rotation}deg);
          transform-origin: center center;
          opacity: ${opacity};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img 
            src="/icons/ship.svg" 
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
            "
            alt="ship"
          />
        </div>
      `;
      return { htmlContent };
    }
  };

  /**
   * 创建或更新标记
   * @param {Object} shipPositions - 船只位置信息 {mmsi: {lng, lat, hdg, cog, iconSize, color, ...}}
   * @param {string} mode - 模式：'multi' | 'single'
   * @param {string|null} selectedShipId - 单船只模式下选中的船只MMSI
   */
  const updateAllMarkers = (shipPositions, mode = 'multi', selectedShipId = null) => {
    if (!map || !multiShipManager) {
      console.warn('ShipMarkersManager: map or multiShipManager not available');
      return;
    }

    const markers = markersRef.current;
    const currentMmsiSet = new Set(Object.keys(shipPositions));

    // 移除不再需要的标记
    for (const [mmsi, marker] of markers.entries()) {
      if (!currentMmsiSet.has(mmsi)) {
        try {
          marker.setMap(null);
          marker.off('click');
          marker.off('dblclick');
          markers.delete(mmsi);
        } catch (e) {
          console.warn(`移除标记失败 ${mmsi}:`, e);
        }
      }
    }

    // 创建或更新标记
    for (const [mmsi, position] of Object.entries(shipPositions)) {
      if (!position || (!position.lng && !position.lon) || !position.lat) {
        continue;
      }

      // 获取船只信息（用于获取图标大小和颜色）
      const shipInfo = multiShipManager.getShip(mmsi);
      if (!shipInfo) {
        continue;
      }

      const iconSize = shipInfo.iconSize || position.iconSize || 24;
      const color = shipInfo.color || position.color || '#2196f3';
      const lng = position.lng || position.lon || 0;
      const lat = position.lat || 0;
      
      // 调试：打印前几个船舶的颜色信息
      if (mmsi && Object.keys(shipPositions).length <= 5) {
        console.log(`船舶 ${mmsi} 颜色信息:`, {
          color,
          shipInfoColor: shipInfo.color,
          flagCtry: shipInfo.flagCtry
        });
      }
      
      // 完全忽略数据中的cog和hdg，使用MultiShipManager计算出的方向
      // MultiShipManager已经根据相邻两个关键点计算出了方向
      // 注意：需要检查值是否为数字类型，因为0也是有效角度
      let rotation = 0;
      if (typeof position.cog === 'number' && isFinite(position.cog)) {
        rotation = position.cog;
      } else if (typeof position.hdg === 'number' && isFinite(position.hdg)) {
        rotation = position.hdg;
      }
      
      // 规范化角度到0-360范围
      rotation = ((rotation % 360) + 360) % 360;

      // 判断是否虚化（单船只模式下，非选中船只需要虚化）
      const isDimmed = mode === 'single' && selectedShipId && mmsi !== selectedShipId;
      const opacity = isDimmed ? 0.3 : 1.0;
      const scale = 1.0; // 大小不变，只改变透明度

      // 如果标记已存在，更新位置和样式
      if (markers.has(mmsi)) {
        const marker = markers.get(mmsi);
        try {
          // 更新位置
          marker.setPosition([lng, lat]);
          
          // 更新缩放（通过更新图标大小实现）
          const newSize = Math.round(iconSize * scale);
          
          // 使用自定义HTML内容创建图标（支持旋转）
          createShipIcon(newSize, color, opacity, rotation).then(({ htmlContent }) => {
            // 获取或创建内容元素
            let content = marker.getContent();
            if (!content || !(content instanceof HTMLElement)) {
              // 如果内容不存在或不是HTMLElement，创建新的
              content = document.createElement('div');
              marker.setContent(content);
            }
            
            // 更新内容
            content.innerHTML = htmlContent;
            content.style.width = `${newSize}px`;
            content.style.height = `${newSize}px`;
            content.style.pointerEvents = 'auto';
          }).catch(error => {
            console.warn(`更新标记图标失败 ${mmsi}:`, error);
          });
          
          // 更新偏移量
          marker.setOffset(new window.AMap.Pixel(-newSize / 2, -newSize / 2));
        } catch (e) {
          console.warn(`更新标记失败 ${mmsi}:`, e);
        }
      } else {
        // 创建新标记
        const actualSize = Math.round(iconSize * scale);
        
        // 先创建一个临时标记（使用原始图片），然后异步更新为彩色图片
        const tempContent = document.createElement('div');
        tempContent.innerHTML = `
          <div style="
            width: ${actualSize}px;
            height: ${actualSize}px;
            transform: rotate(${rotation}deg);
            transform-origin: center center;
            opacity: ${opacity};
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <img 
              src="/icons/ship.svg" 
              style="
                width: 100%;
                height: 100%;
                object-fit: contain;
              "
              alt="ship"
            />
          </div>
        `;
        tempContent.style.width = `${actualSize}px`;
        tempContent.style.height = `${actualSize}px`;
        tempContent.style.pointerEvents = 'auto';

        const marker = new window.AMap.Marker({
          position: [lng, lat],
          content: tempContent,
          offset: new window.AMap.Pixel(-actualSize / 2, -actualSize / 2),
          map: map,
          zIndex: isDimmed ? 500 : 1000,
          title: `船只 MMSI: ${mmsi}`
        });

        // 添加点击事件
        marker.on('click', () => {
          if (onMarkerClickRef.current) {
            onMarkerClickRef.current(mmsi, position);
          }
        });

        // 添加双击事件
        marker.on('dblclick', () => {
          if (onMarkerDoubleClickRef.current) {
            onMarkerDoubleClickRef.current(mmsi, position);
          }
        });

        markers.set(mmsi, marker);

        // 异步更新为彩色图片
        createShipIcon(actualSize, color, opacity, rotation).then(({ htmlContent }) => {
          // 检查标记是否还存在
          if (markers.has(mmsi)) {
            const existingMarker = markers.get(mmsi);
            const content = existingMarker.getContent();
            if (content) {
              content.innerHTML = htmlContent;
            }
          }
        }).catch(error => {
          console.warn(`更新标记图标为彩色失败 ${mmsi}:`, error);
        });
      }
    }
  };

  /**
   * 清除所有标记
   */
  const clearAllMarkers = () => {
    const markers = markersRef.current;
    for (const [mmsi, marker] of markers.entries()) {
      try {
        marker.setMap(null);
        marker.off('click');
        marker.off('dblclick');
      } catch (e) {
        console.warn(`清除标记失败 ${mmsi}:`, e);
      }
    }
    markers.clear();
  };

  /**
   * 设置标记点击事件回调
   * @param {Function} callback - 回调函数 (mmsi, position) => {}
   */
  const setOnMarkerClick = (callback) => {
    onMarkerClickRef.current = callback;
  };

  /**
   * 设置标记双击事件回调
   * @param {Function} callback - 回调函数 (mmsi, position) => {}
   */
  const setOnMarkerDoubleClick = (callback) => {
    onMarkerDoubleClickRef.current = callback;
  };

  // 暴露接口给外部使用
  useEffect(() => {
    if (window.ShipMarkersManager) {
      window.ShipMarkersManager.updateAllMarkers = updateAllMarkers;
      window.ShipMarkersManager.clearAllMarkers = clearAllMarkers;
      window.ShipMarkersManager.setOnMarkerClick = setOnMarkerClick;
      window.ShipMarkersManager.setOnMarkerDoubleClick = setOnMarkerDoubleClick;
    } else {
      window.ShipMarkersManager = {
        updateAllMarkers,
        clearAllMarkers,
        setOnMarkerClick,
        setOnMarkerDoubleClick
      };
    }

    return () => {
      clearAllMarkers();
      if (window.ShipMarkersManager) {
        delete window.ShipMarkersManager;
      }
    };
  }, [map, multiShipManager]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearAllMarkers();
    };
  }, []);

  // 这个组件不渲染任何DOM元素
  return null;
};

export default ShipMarkersManager;
