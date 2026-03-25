import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { resolveQrCode, QrResolution } from '@/lib/qr-api';
import { AlertCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScanState = 'loading' | 'error' | 'inactive' | 'not-found';

const ScanPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTableNumber, setTableId } = useStore();
  const [state, setState] = useState<ScanState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const qrCode = searchParams.get('qr') || '';

  useEffect(() => {
    if (!qrCode) {
      setState('not-found');
      setErrorMessage('No QR code provided. Please scan a valid table QR code.');
      return;
    }

    let cancelled = false;

    resolveQrCode(qrCode)
      .then((result: QrResolution | null) => {
        if (cancelled) return;

        if (!result) {
          setState('not-found');
          setErrorMessage('This QR code is invalid or has expired. Please ask staff for help.');
          return;
        }

        if (!result.is_active) {
          setState('inactive');
          setErrorMessage(`Table ${result.table_number} is temporarily unavailable. Please ask staff for assistance.`);
          return;
        }

        // Success — set context and redirect to menu
        setTableNumber(result.table_number);
        setTableId(result.table_id);
        navigate(`/menu?table=${result.table_number}`, { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        setState('error');
        setErrorMessage('Something went wrong while resolving your QR code. Please try again.');
      });

    return () => { cancelled = true; };
  }, [qrCode, navigate, setTableNumber, setTableId]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <QrCode className="h-12 w-12 text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground text-sm">Resolving your table...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">
          {state === 'not-found' && 'QR Code Not Found'}
          {state === 'inactive' && 'Table Unavailable'}
          {state === 'error' && 'Something Went Wrong'}
        </h1>
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => window.location.reload()}>Try Again</Button>
          <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
