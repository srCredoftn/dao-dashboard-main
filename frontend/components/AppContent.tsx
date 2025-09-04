import { Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthenticatedRoute, AdminRoute } from "./ProtectedRoute";
import { LazyLoader, PageFallback, lazy } from "./LazyLoader";
import NetworkStatusAlert from "./NetworkStatusAlert";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

// Imports directs pour les pages critiques (login, not found)
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Lazy loading pour les pages non-critiques
const Index = lazy(() => import("@/pages/Index"));
const DaoDetail = lazy(() => import("@/pages/DaoDetail"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const Profile = lazy(() => import("@/pages/Profile"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

export default function AppContent() {
  return (
    <NotificationProvider>
      <NetworkStatusAlert />
      {/* FetchTestButton temporaire caché */}
      {/* FetchDiagnostics caché */}
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/forgot-password"
          element={
            <LazyLoader fallback={<PageFallback />}>
              <ForgotPassword />
            </LazyLoader>
          }
        />
        <Route
          path="/reset-password"
          element={
            <LazyLoader fallback={<PageFallback />}>
              <ResetPassword />
            </LazyLoader>
          }
        />
        <Route
          path="/"
          element={
            <AuthenticatedRoute>
              <LazyLoader fallback={<PageFallback />}>
                <Index />
              </LazyLoader>
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/dao/:id"
          element={
            <AuthenticatedRoute>
              <LazyLoader fallback={<PageFallback />}>
                <DaoDetail />
              </LazyLoader>
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <AdminUsers />
              </LazyLoader>
            </AdminRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthenticatedRoute>
              <LazyLoader fallback={<PageFallback />}>
                <Profile />
              </LazyLoader>
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/user-management"
          element={
            <AdminRoute>
              <LazyLoader fallback={<PageFallback />}>
                <UserManagement />
              </LazyLoader>
            </AdminRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </NotificationProvider>
  );
}
