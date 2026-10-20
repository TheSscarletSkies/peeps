import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps one broken page from blanking the whole window. */
export class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card boundary" role="alert">
        <h2>This page hit a snag</h2>
        <p className="setup__hint">{this.state.error.message}</p>
        <button
          className="button"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
