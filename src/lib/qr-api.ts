import { supabase } from '@/integrations/supabase/client';

export interface QrResolution {
  restaurant_id: string;
  restaurant_name: string;
  table_id: string;
  table_number: number;
  is_active: boolean;
}

/** Resolve a QR code token to restaurant + table info */
export async function resolveQrCode(qrCode: string): Promise<QrResolution | null> {
  const { data, error } = await (supabase.rpc as any)('resolve_qr', { _qr_code: qrCode });
  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as QrResolution;
}

/** Rotate the QR code for a specific table (admin only) */
export async function rotateQrCode(tableId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('rotate_qr_code', { _table_id: tableId });
  if (error) throw error;
  return data as unknown as string;
}

/** Fetch all tables with their QR codes for a restaurant */
export async function fetchTablesWithQr(restaurantId: string) {
  const { data, error } = await supabase
    .from('tables')
    .select('id, table_number, qr_code, is_active')
    .eq('restaurant_id', restaurantId)
    .order('table_number');
  if (error) throw error;
  return data || [];
}
