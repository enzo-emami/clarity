import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
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
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
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
              max-width: 400px;
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
              margin: 0 0 16px 0;
              line-height: 1.5;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}
