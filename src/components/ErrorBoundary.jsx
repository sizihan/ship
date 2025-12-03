import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 你同样可以将错误日志上报给服务器
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI 并渲染
      return (
        <div style={{
          padding: '50px',
          textAlign: 'center',
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#856404', marginBottom: '20px' }}>⚠️ 发生了一个错误</h2>
          <p style={{ color: '#856404', marginBottom: '20px' }}>
            应用程序遇到了一个问题。请刷新页面或联系管理员。
          </p>
          <details style={{ 
            textAlign: 'left', 
            background: '#fff',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '20px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              错误详情
            </summary>
            <pre style={{ 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              color: '#721c24'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#ffc107',
              color: '#856404',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            🔄 刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
