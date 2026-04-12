import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface RestaurantConfig {
  id?: string;
  restaurant_id: string;
  currency_symbol: string;
  tax_rate: number;
  business_hours_open: string;
  business_hours_close: string;
  timezone: string;
}

interface Props {
  restaurantId: string;
}

const timezones = [
  'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
];

export default function AdminSettingsTab({ restaurantId }: Props) {
  const [config, setConfig] = useState<RestaurantConfig>({
    restaurant_id: restaurantId,
    currency_symbol: '₹',
    tax_rate: 0,
    business_hours_open: '09:00',
    business_hours_close: '22:00',
    timezone: 'Asia/Kolkata',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('restaurant_config')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig({
            id: data.id,
            restaurant_id: data.restaurant_id,
            currency_symbol: data.currency_symbol,
            tax_rate: Number(data.tax_rate),
            business_hours_open: data.business_hours_open || '09:00',
            business_hours_close: data.business_hours_close || '22:00',
            timezone: data.timezone,
          });
        }
        setLoading(false);
      });
  }, [restaurantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        currency_symbol: config.currency_symbol || '₹',
        tax_rate: config.tax_rate,
        business_hours_open: config.business_hours_open,
        business_hours_close: config.business_hours_close,
        timezone: config.timezone,
      };

      if (config.id) {
        const { error } = await supabase
          .from('restaurant_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('restaurant_config')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Restaurant Settings</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Currency Symbol</label>
          <Input
            value={config.currency_symbol}
            onChange={(e) => setConfig({ ...config, currency_symbol: e.target.value })}
            placeholder="₹"
            className="w-24 mt-1"
            maxLength={5}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
          <Input
            type="number"
            value={config.tax_rate || ''}
            onChange={(e) => setConfig({ ...config, tax_rate: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="w-32 mt-1"
            min={0}
            max={100}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground mt-1">Applied to order totals (0 = no tax)</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Opens At</label>
            <Input
              type="time"
              value={config.business_hours_open}
              onChange={(e) => setConfig({ ...config, business_hours_open: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Closes At</label>
            <Input
              type="time"
              value={config.business_hours_close}
              onChange={(e) => setConfig({ ...config, business_hours_close: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Timezone</label>
          <select
            value={config.timezone}
            onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-1">
        <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
