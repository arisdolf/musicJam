import { Component } from 'react'

// Catches render/effect crashes so the page never goes blank.
// `resetKey` clears the error automatically (e.g. when the tab changes).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label || 'App'}] crashed:`, error, info?.componentStack)
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div className="empty-result-card" role="alert" style={{ margin: 16, flexWrap: 'wrap' }}>
      <span>{this.props.label || 'This section'} hit an error: {this.state.error.message || 'unknown error'}</span>
      <button className="btn btn-small" onClick={() => this.setState({ error: null })}>Try again</button>
    </div>
  }
}