import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QrCode, ChefHat, LayoutDashboard } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center animate-slide-up">
        <span className="text-6xl mb-4 block">🍽️</span>
        <h1 className="text-3xl font-bold mb-2">QR Restaurant</h1>
        <p className="text-muted-foreground mb-8">
          Scan, Order, Enjoy — A modern table ordering system
        </p>

        <div className="space-y-3">
          <Button
            className="w-full py-6 text-base"
            onClick={() => navigate('/menu?table=5')}
          >
            <QrCode className="h-5 w-5 mr-2" />
            Open Menu (Table 5)
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="py-5"
              onClick={() => navigate('/login')}
            >
              <ChefHat className="h-4 w-4 mr-1" />
              Kitchen
            </Button>
            <Button
              variant="outline"
              className="py-5"
              onClick={() => navigate('/login')}
            >
              <LayoutDashboard className="h-4 w-4 mr-1" />
              Admin
            </Button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-2">🔗 Quick Links</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[1, 2, 3, 5, 7, 10].map((t) => (
              <button
                key={t}
                onClick={() => navigate(`/menu?table=${t}`)}
                className="px-3 py-1.5 bg-background rounded border hover:border-primary transition-colors"
              >
                Table {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
