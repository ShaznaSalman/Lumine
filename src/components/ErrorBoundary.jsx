import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F5FF] px-6 py-20 text-center">
          <div className="mx-auto max-w-lg rounded-[2rem] border border-[#E9E3F4] bg-white p-10 shadow-soft">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F0FF] text-4xl">🌙</div>
            <h1 className="mt-6 text-3xl font-semibold text-[#2C2C2A]">Something went wrong</h1>
            <p className="mt-3 text-sm text-[#6D6B6F]">Try refreshing the page or reopening Lumine.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
