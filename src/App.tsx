import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";
import Index from "./pages/Index";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import OrderStatusPage from "./pages/OrderStatusPage";
import KitchenDashboard from "./pages/KitchenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role: string }) => {
  const { auth } = useStore();
  if (!auth.isAuthenticated) return <Navigate to="/login" />;
  if (auth.role !== role) return <Navigate to="/" />;
  return <>{children}</>;
};

const StaffRouter = () => {
  const { auth } = useStore();
  if (!auth.isAuthenticated) return <Navigate to="/login" />;
  if (auth.role === 'chef') return <KitchenDashboard />;
  if (auth.role === 'admin') return <AdminDashboard />;
  return <Navigate to="/" />;
};

const AuthInit = ({ children }: { children: React.ReactNode }) => {
  const { checkAuth } = useStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);
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
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="/order-status/:orderId" element={<OrderStatusPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/kitchen" element={<ProtectedRoute role="chef"><KitchenDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<StaffRouter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
