import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import ScanPage from "./pages/ScanPage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import OrderStatusPage from "./pages/OrderStatusPage";
import KitchenDashboard from "./pages/KitchenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import PRDDownload from "./pages/PRDDownload";
import ModifyOrderPage from "./pages/ModifyOrderPage";
import SignupPage from "./pages/SignupPage";
import SetupWizard from "./pages/SetupWizard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role: string }) => {
  const { auth, authLoading } = useStore();
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (!auth.isAuthenticated) return <Navigate to="/login" />;
  if (auth.role !== role) return <Navigate to="/login" />;
  return <>{children}</>;
};

const StaffRouter = () => {
  const { auth, authLoading } = useStore();
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (!auth.isAuthenticated) return <Navigate to="/login" />;
  if (auth.role === 'chef') return <KitchenDashboard />;
  if (auth.role === 'admin') return <AdminDashboard />;
  return <Navigate to="/login" />;
};

const AuthInit = ({ children }: { children: React.ReactNode }) => {
  const { checkAuth, initAuthListener } = useStore();
  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = initAuthListener();
    return () => subscription.unsubscribe();
  }, [checkAuth, initAuthListener]);
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthInit>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/menu" element={<ErrorBoundary fallbackTitle="Menu failed to load"><MenuPage /></ErrorBoundary>} />
            <Route path="/cart" element={<ErrorBoundary fallbackTitle="Cart error"><CartPage /></ErrorBoundary>} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="/order-status/:orderId" element={<OrderStatusPage />} />
            <Route path="/modify-order/:orderId" element={<ErrorBoundary fallbackTitle="Could not load order editor"><ModifyOrderPage /></ErrorBoundary>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/kitchen" element={<ProtectedRoute role="chef"><ErrorBoundary fallbackTitle="Kitchen dashboard error — orders are safe"><KitchenDashboard /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><ErrorBoundary fallbackTitle="Admin dashboard error"><AdminDashboard /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/prd" element={<PRDDownload />} />
            <Route path="/dashboard" element={<StaffRouter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
