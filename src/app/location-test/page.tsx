import { Suspense, lazy } from 'react';

// Importar dinámicamente para evitar problemas de SSR
const LocationTester = lazy(() => import('@/components/LocationTester'));

export default function LocationTestPage() {
  return (
    <div className="container mx-auto py-8">
      <Suspense fallback={
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }>
        <LocationTester />
      </Suspense>
    </div>
  );
}
