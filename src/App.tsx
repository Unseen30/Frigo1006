
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { queryClient } from "@/config/queryClient";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import DriverInfo from "./pages/DriverInfo";
import CargoRegistration from "./pages/CargoRegistration";
import ActiveTrip from "./pages/ActiveTrip";
import TripHistory from "./pages/TripHistory";
import RouteHistory from "./pages/RouteHistory";
import LocationTester from "./pages/LocationTester";

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/auth" element={<DriverInfo />} />
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Index />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cargo"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <CargoRegistration />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/active-trip"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ActiveTrip />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <TripHistory />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/route-history"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <RouteHistory />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/location-test" 
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <LocationTester />
                </Suspense>
              } 
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
