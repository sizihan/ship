import { useEffect, useState } from 'react';
import './ShipInfoModal.css';

/**
 * 船只信息弹窗组件
 * 职责：显示船只详细信息
 */
const ShipInfoModal = ({ shipInfo, isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 延迟显示以触发动画
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen || !shipInfo) {
    return null;
  }

  // 格式化时间
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return timeStr;
    }
  };

  // 格式化经纬度
  const formatCoordinate = (coord, type) => {
    if (coord === null || coord === undefined || isNaN(coord)) return '-';
    const absCoord = Math.abs(coord);
    const degrees = Math.floor(absCoord);
    const minutes = Math.floor((absCoord - degrees) * 60);
    const seconds = ((absCoord - degrees) * 60 - minutes) * 60;
    const direction = type === 'lat' 
      ? (coord >= 0 ? 'N' : 'S')
      : (coord >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction} (${coord.toFixed(6)})`;
  };

  // 格式化角度
  const formatAngle = (angle) => {
    if (angle === null || angle === undefined || isNaN(angle)) return '-';
    return `${Math.round(angle)}°`;
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div 
      className={`ship-info-modal-backdrop ${isVisible ? 'visible' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={`ship-info-modal ${isVisible ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ship-info-modal-header">
          <h2 className="ship-info-modal-title">船只详细信息</h2>
          <button 
            className="ship-info-modal-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="ship-info-modal-content">
          <div className="ship-info-section">
            <h3 className="ship-info-section-title">基本信息</h3>
            <div className="ship-info-grid">
              <div className="ship-info-item">
                <span className="ship-info-label">MMSI:</span>
                <span className="ship-info-value">{shipInfo.mmsi || '-'}</span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">船舶类型:</span>
                <span className="ship-info-value">{shipInfo.vessel_type || '-'}</span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">国旗国家:</span>
                <span className="ship-info-value">{shipInfo.flag_ctry || '-'}</span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">目的地:</span>
                <span className="ship-info-value">{shipInfo.dest || '-'}</span>
              </div>
            </div>
          </div>

          <div className="ship-info-section">
            <h3 className="ship-info-section-title">当前位置</h3>
            <div className="ship-info-grid">
              <div className="ship-info-item">
                <span className="ship-info-label">经度:</span>
                <span className="ship-info-value">
                  {formatCoordinate(shipInfo.lng || shipInfo.lon, 'lon')}
                </span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">纬度:</span>
                <span className="ship-info-value">
                  {formatCoordinate(shipInfo.lat, 'lat')}
                </span>
              </div>
            </div>
          </div>

          <div className="ship-info-section">
            <h3 className="ship-info-section-title">航行信息</h3>
            <div className="ship-info-grid">
              <div className="ship-info-item">
                <span className="ship-info-label">航向 (HDG):</span>
                <span className="ship-info-value">{formatAngle(shipInfo.hdg)}</span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">对地航向 (COG):</span>
                <span className="ship-info-value">{formatAngle(shipInfo.cog)}</span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">速度:</span>
                <span className="ship-info-value">
                  {shipInfo.speed !== null && shipInfo.speed !== undefined && !isNaN(shipInfo.speed)
                    ? `${shipInfo.speed.toFixed(2)} 节`
                    : '-'}
                </span>
              </div>
              
              <div className="ship-info-item">
                <span className="ship-info-label">时间戳:</span>
                <span className="ship-info-value">{formatTime(shipInfo.timestamp || shipInfo.postime)}</span>
              </div>
            </div>
          </div>

          {shipInfo.draught && (
            <div className="ship-info-section">
              <h3 className="ship-info-section-title">其他信息</h3>
              <div className="ship-info-grid">
                <div className="ship-info-item">
                  <span className="ship-info-label">吃水深度:</span>
                  <span className="ship-info-value">
                    {shipInfo.draught !== null && shipInfo.draught !== undefined && !isNaN(shipInfo.draught)
                      ? `${shipInfo.draught.toFixed(2)} 米`
                      : '-'}
                  </span>
                </div>
                
                {shipInfo.status && (
                  <div className="ship-info-item">
                    <span className="ship-info-label">状态:</span>
                    <span className="ship-info-value">{shipInfo.status}</span>
                  </div>
                )}
                
                {shipInfo.eta && (
                  <div className="ship-info-item">
                    <span className="ship-info-label">预计到达时间:</span>
                    <span className="ship-info-value">{formatTime(shipInfo.eta)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ship-info-modal-footer">
          <button className="ship-info-modal-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipInfoModal;
