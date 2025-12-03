import './BottomControls.css';

const BottomControls = ({
  isPlaying,
  onPlayPause,
  onReset,
  currentTime,
  globalTimeRange,
  timeRange,
  selectedTimeIndex,
  onTimeSliderChange,
  getCurrentPointTime,
  currentIndex,
  currentTrajectoryLength
}) => {
  if (!currentTrajectoryLength || currentTrajectoryLength === 0) {
    return null;
  }

  return (
    <div className="bottom-controls">
      <div className="bottom-controls-content">
        {/* 播放/暂停按钮 */}
        <button
          className={`play-pause-btn ${isPlaying ? 'playing' : 'paused'}`}
          onClick={onPlayPause}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        {/* 时间进度条 */}
        <div className="time-slider-wrapper">
          {globalTimeRange && globalTimeRange.start_time && globalTimeRange.end_time ? (
            // 统一时间轴模式
            <>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={(() => {
                  if (!currentTime || !globalTimeRange.start_time || !globalTimeRange.end_time) return 0;
                  const start = new Date(globalTimeRange.start_time).getTime();
                  const end = new Date(globalTimeRange.end_time).getTime();
                  const current = currentTime.getTime();
                  if (end <= start) return 0;
                  return ((current - start) / (end - start)) * 100;
                })()}
                onChange={onTimeSliderChange}
                className="time-slider-bottom"
              />
              <div className="time-display-bottom">
                {currentTime && (
                  <span className="current-time">
                    {currentTime.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </>
          ) : (
            // 单船只模式
            <>
              <input
                type="range"
                min={timeRange[0]}
                max={timeRange[1]}
                value={selectedTimeIndex}
                onChange={onTimeSliderChange}
                className="time-slider-bottom"
              />
              <div className="time-display-bottom">
                <span>{getCurrentPointTime ? getCurrentPointTime() : `${currentIndex + 1}/${currentTrajectoryLength}`}</span>
              </div>
            </>
          )}
        </div>

        {/* 重置按钮 */}
        <button
          className="reset-btn"
          onClick={onReset}
        >
          🔄
        </button>
      </div>
    </div>
  );
};

export default BottomControls;

