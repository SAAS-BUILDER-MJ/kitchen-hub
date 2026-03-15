import { useState } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  preset: DatePreset;
}

export function getDateRange(preset: DatePreset, customDate?: Date): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), preset };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y), preset };
    }
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now), preset };
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now), preset };
    case 'custom': {
      const d = customDate || now;
      return { from: startOfDay(d), to: endOfDay(d), preset };
    }
  }
}

const presets: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

interface Props {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

export default function AdminDateFilter({ dateRange, onChange }: Props) {
  const [calOpen, setCalOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={dateRange.preset === p.value ? 'default' : 'secondary'}
          onClick={() => onChange(getDateRange(p.value))}
          className="text-xs"
        >
          {p.label}
        </Button>
      ))}

      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={dateRange.preset === 'custom' ? 'default' : 'outline'}
            className={cn('text-xs gap-1', dateRange.preset !== 'custom' && 'text-muted-foreground')}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateRange.preset === 'custom'
              ? format(dateRange.from, 'dd MMM yyyy')
              : 'Custom Date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.preset === 'custom' ? dateRange.from : undefined}
            onSelect={(day) => {
              if (day) {
                onChange(getDateRange('custom', day));
                setCalOpen(false);
              }
            }}
            disabled={(date) => date > new Date()}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
