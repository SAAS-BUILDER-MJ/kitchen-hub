import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchTablesWithQr, rotateQrCode } from '@/lib/qr-api';
import { DEMO_RESTAURANT_ID } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface TableQr {
  id: string;
  table_number: number;
  qr_code: string | null;
  is_active: boolean;
}

interface AdminQrTabProps {
  restaurantId: string;
}

const AdminQrTab = ({ restaurantId }: AdminQrTabProps) => {
  const [tables, setTables] = useState<TableQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await fetchTablesWithQr(DEMO_RESTAURANT_ID);
      setTables(data);
    } catch {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const handleRotate = async (tableId: string) => {
    setRotatingId(tableId);
    try {
      const newCode = await rotateQrCode(tableId);
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, qr_code: newCode } : t))
      );
      toast.success('QR code rotated successfully');
    } catch {
      toast.error('Failed to rotate QR code');
    } finally {
      setRotatingId(null);
    }
  };

  const getQrUrl = (qrCode: string) => {
    const base = window.location.origin;
    return `${base}/scan?qr=${qrCode}`;
  };

  const handleCopy = (qrCode: string, tableId: string) => {
    navigator.clipboard.writeText(getQrUrl(qrCode));
    setCopiedId(tableId);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (tableNumber: number, qrCode: string) => {
    const svgEl = document.getElementById(`qr-svg-${tableNumber}`);
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
      }
      const link = document.createElement('a');
      link.download = `table-${tableNumber}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading QR codes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Table QR Codes</h2>
          <p className="text-sm text-muted-foreground">
            Each table has a unique QR code. Customers scan it to access the menu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <Card key={table.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Table {table.table_number}</h3>
              <Badge variant={table.is_active ? 'default' : 'secondary'}>
                {table.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {table.qr_code ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG
                    id={`qr-svg-${table.table_number}`}
                    value={getQrUrl(table.qr_code)}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono break-all text-center">
                  {table.qr_code.slice(0, 16)}...
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[160px] bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">No QR code</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleRotate(table.id)}
                disabled={rotatingId === table.id}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${rotatingId === table.id ? 'animate-spin' : ''}`} />
                {table.qr_code ? 'Rotate' : 'Generate'}
              </Button>
              {table.qr_code && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(table.qr_code!, table.id)}
                  >
                    {copiedId === table.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(table.table_number, table.qr_code!)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tables found. Add tables to your restaurant first.
        </div>
      )}
    </div>
  );
};

export default AdminQrTab;
