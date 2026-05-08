import { RouterProvider } from 'react-router-dom';
import { RouterAuthProvider } from './auth-context';
import { router } from './routes';

export function AppRouterProvider() {
  return (
    <RouterAuthProvider>
      <RouterProvider router={router} />
    </RouterAuthProvider>
  );
}
