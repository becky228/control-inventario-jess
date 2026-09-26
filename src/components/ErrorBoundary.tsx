import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error("Error no controlado:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pantalla-carga">
          Ocurrió un error inesperado. Intenta recargar la página. Si el
          problema continúa, contacta al administrador.
        </div>
      );
    }
    return this.props.children;
  }
}
