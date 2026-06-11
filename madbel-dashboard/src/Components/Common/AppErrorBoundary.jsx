import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Something went wrong while loading the dashboard.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard render error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
              Dashboard Error
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              This screen could not load.
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 rounded-lg bg-[#17b4c9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#149cb0]"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
