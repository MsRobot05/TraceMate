import { Component } from 'react';

/** Catches render errors so one broken component never leaves the user with a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state" style={{ margin: '80px auto', maxWidth: 520 }} role="alert">
        <h3>Something went wrong</h3>
        <p>The page hit an unexpected error. Your data is safe — reload to continue.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>Reload TraceMate</button>
      </div>
    );
  }
}
