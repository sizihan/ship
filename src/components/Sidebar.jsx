import { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({
  onOverviewClick,
  onShipClick,
  onSpeedClick,
  onUploadClick,
  showShipSearch = false,
  showSpeedControl = false,
  onShipSearchChange,
  searchQuery = '',
  animationSpeed = 1,
  onSpeedChange,
  uploadStatus = '',
  onCancelUpload,
  apiStatus = 'checking',
  getApiStatusText,
  getApiStatusClass,
  allShipsData = {},
  selectedShipId = null,
  currentMode = 'multi',
  onShipSelect
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const collapseTimerRef = useRef(null); // 用于存储延迟收起的定时器

  const handleMouseEnter = () => {
    // 如果存在延迟收起的定时器，清除它
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    
    if (!isFixed) {
      setIsExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isFixed) {
      // 清除之前的定时器（如果存在）
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
      
      // 设置延迟0.5秒后收起
      collapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
        collapseTimerRef.current = null;
      }, 500); // 500毫秒 = 0.5秒
    }
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const handleFixedToggle = () => {
    setIsFixed(!isFixed);
    if (!isFixed) {
      setIsExpanded(true);
    }
  };

  const handleUploadClick = () => {
    // 只调用父组件的上传处理函数，不再触发自己的文件输入框
    if (onUploadClick) {
      onUploadClick();
    }
  };

  return (
    <div
      className={`sidebar ${isExpanded ? 'expanded' : ''} ${isFixed ? 'fixed' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 固定按钮 */}
      <button
        className="sidebar-fix-btn"
        onClick={handleFixedToggle}
        title={isFixed ? '取消固定' : '固定侧栏'}
      >
        {isFixed ? '📌' : '📍'}
      </button>

      {/* 菜单项 */}
      <div className="sidebar-menu">
        <button
          className="sidebar-menu-item"
          onClick={onOverviewClick}
          title="总览"
        >
          <span className="menu-icon">📊</span>
          {isExpanded && <span className="menu-text">总览</span>}
        </button>

        <button
          className="sidebar-menu-item"
          onClick={onShipClick}
          title="船只"
        >
          <span className="menu-icon">🚢</span>
          {isExpanded && <span className="menu-text">船只</span>}
        </button>

        {/* 船只搜索框和列表 - 显示在船只按钮下方 */}
        {isExpanded && showShipSearch && (
          <div className="sidebar-submenu ship-search">
            <input
              type="text"
              className="ship-search-input"
              placeholder="搜索船舶编号..."
              value={searchQuery}
              onChange={(e) => onShipSearchChange && onShipSearchChange(e.target.value)}
            />
            {/* 船舶列表 */}
            {Object.keys(allShipsData).length > 0 && (
              <div className="ship-list-container">
                {(() => {
                  const query = searchQuery.toLowerCase().trim();
                  const filteredShips = Object.keys(allShipsData).filter(shipId => {
                    const ship = allShipsData[shipId];
                    const shipName = ship.name || shipId;
                    return query === '' || shipId.toLowerCase().includes(query) || shipName.toLowerCase().includes(query);
                  });
                  
                  if (filteredShips.length === 0) {
                    return <div className="no-ships-message">未找到匹配的船舶</div>;
                  }
                  
                  return filteredShips.map(shipId => {
                    const ship = allShipsData[shipId];
                    const shipName = ship.name || shipId;
                    return (
                      <button
                        key={shipId}
                        onClick={() => onShipSelect && onShipSelect(shipId)}
                        className={`ship-list-item ${selectedShipId === shipId ? 'active' : ''}`}
                      >
                        {shipName}
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        <button
          className="sidebar-menu-item"
          onClick={onSpeedClick}
          title="倍速"
        >
          <span className="menu-icon">⚡</span>
          {isExpanded && <span className="menu-text">倍速</span>}
        </button>

        {/* 倍速调整条 - 显示在倍速按钮下方 */}
        {isExpanded && showSpeedControl && (
          <div className="sidebar-submenu speed-control">
            <div className="speed-control-header">
              <span>倍速调整</span>
              <span className="speed-value">{animationSpeed}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={animationSpeed}
              onChange={(e) => onSpeedChange && onSpeedChange(parseFloat(e.target.value))}
              className="speed-slider"
            />
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={animationSpeed}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0.5 && value <= 10) {
                  onSpeedChange && onSpeedChange(value);
                }
              }}
              className="speed-input"
              placeholder="输入倍速"
            />
          </div>
        )}

        <button
          className="sidebar-menu-item"
          onClick={handleUploadClick}
          title="上传"
        >
          <span className="menu-icon">📁</span>
          {isExpanded && <span className="menu-text">上传</span>}
        </button>
      </div>

      {/* 上传状态显示 */}
      {isExpanded && uploadStatus && (
        <div className={`sidebar-status ${uploadStatus}`}>
          {uploadStatus === 'uploading' && <span>上传中...</span>}
          {uploadStatus === 'success' && (
            <div className="upload-success">
              <span>上传成功</span>
              {onCancelUpload && (
                <button
                  className="cancel-btn"
                  onClick={onCancelUpload}
                >
                  取消
                </button>
              )}
            </div>
          )}
          {uploadStatus === 'error' && <span>上传失败</span>}
        </div>
      )}

      {/* API状态显示 */}
      {isExpanded && (
        <div className={`sidebar-api-status ${getApiStatusClass ? getApiStatusClass() : ''}`}>
          {getApiStatusText ? getApiStatusText() : 'API状态'}
        </div>
      )}
    </div>
  );
};

export default Sidebar;

