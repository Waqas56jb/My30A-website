import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="app">
          <main>
            <p>Something went wrong.</p>
            <button type="button" className="btn" onClick={() => window.location.reload()} style={{ marginTop: 16 }}>
              Reload
            </button>
          </main>
        </div>
      )
    }
    return this.props.children
  }
}
