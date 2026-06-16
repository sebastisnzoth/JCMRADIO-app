import { Toaster } from 'sonner';
import UserApp from './components/UserApp';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <UserApp />
      <Toaster position="top-center" richColors />
    </ErrorBoundary>
  );
}
