import { Component, ErrorInfo, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Clarity Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <Sparkles size={48} className="error-icon" />
            <h2>Something went wrong</h2>
            <p>We encountered an unexpected error while connecting to your map.</p>
            {this.state.error && (
              <pre style={{
                textAlign: 'left',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f87171',
                maxWidth: '100%',
                maxHeight: '160px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="primary-button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                }}
              >
                Try Again
              </button>
              <button
                className="ghost-button"
                style={{ color: '#fff', border: '1px solid #444' }}
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
          <style>{`
            .error-boundary {
              position: fixed;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0f1715;
              color: white;
              z-index: 9999;
              font-family: inherit;
              text-align: center;
              padding: 20px;
            }
            .error-content {
              max-width: 440px;
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 16px;
            }
            .error-icon {
              color: #557b72;
              margin-bottom: 8px;
            }
            .error-content h2 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .error-content p {
              opacity: 0.8;
              margin: 0;
              line-height: 1.5;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}
