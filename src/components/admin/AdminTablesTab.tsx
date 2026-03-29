import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchTablesWithQr, rotateQrCode } from '@/lib/qr-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus, Trash2, RefreshCw, Power, PowerOff, Edit2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface TableRow {
  id: string;
  table_number: number;
  qr_code: string | null;
  is_active: boolean;
}

interface Props {
  restaurantId: string;
}

const AdminTablesTab = ({ restaurantId }: Props) => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkCount, setBulkCount] = useState('');
  const [editTable, setEditTable] = useState<TableRow | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [deleteTable, setDeleteTable] = useState<TableRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await fetchTablesWithQr(restaurantId);
      setTables(data);
    } catch {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const handleAddSingle = async () => {
    const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.table_number)) : 0;
    setActionLoading('add');
    try {
      const { error } = await supabase.from('tables').insert({
        restaurant_id: restaurantId,
        table_number: maxNum + 1,
      });
      if (error) throw error;
      toast.success(`Table ${maxNum + 1} added`);
      await loadTables();
    } catch {
      toast.error('Failed to add table');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAdd = async () => {
    const count = parseInt(bulkCount);
    if (!count || count < 1 || count > 50) {
      toast.error('Enter 1–50');
      return;
    }
    setActionLoading('bulk');
    try {
      const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.table_number)) : 0;
      const newTables = Array.from({ length: count }, (_, i) => ({
        restaurant_id: restaurantId,
        table_number: maxNum + i + 1,
      }));
      const { error } = await supabase.from('tables').insert(newTables);
      if (error) throw error;
      toast.success(`${count} tables added`);
      setBulkCount('');
      await loadTables();
    } catch {
      toast.error('Failed to add tables');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (table: TableRow) => {
    setActionLoading(table.id);
    try {
      const { error } = await supabase
        .from('tables')
        .update({ is_active: !table.is_active })
        .eq('id', table.id);
      if (error) throw error;
      toast.success(`Table ${table.table_number} ${!table.is_active ? 'activated' : 'deactivated'}`);
      await loadTables();
    } catch {
      toast.error('Failed to update table');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSave = async () => {
    if (!editTable) return;
    const num = parseInt(editNumber);
    if (!num || num < 1) {
      toast.error('Invalid table number');
      return;
    }
    const exists = tables.some((t) => t.table_number === num && t.id !== editTable.id);
    if (exists) {
      toast.error('Table number already exists');
      return;
    }
    setActionLoading('edit');
    try {
      const { error } = await supabase.from('tables').update({ table_number: num }).eq('id', editTable.id);
      if (error) throw error;
      toast.success('Table number updated');
      setEditTable(null);
      await loadTables();
    } catch {
      toast.error('Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTable) return;
    setActionLoading('delete');
    try {
      // Check active orders
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', deleteTable.id)
        .in('status', ['NEW', 'PREPARING', 'READY'])
        .limit(1);

      if (activeOrders && activeOrders.length > 0) {
        toast.error('Cannot delete — table has active orders');
        setDeleteTable(null);
        setActionLoading(null);
        return;
      }

      const { error } = await supabase.from('tables').delete().eq('id', deleteTable.id);
      if (error) throw error;
      toast.success(`Table ${deleteTable.table_number} deleted`);
      setDeleteTable(null);
      await loadTables();
    } catch {
      toast.error('Failed to delete table');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRotateQr = async (tableId: string) => {
    setActionLoading(tableId);
    try {
      await rotateQrCode(tableId);
      toast.success('QR code regenerated');
      await loadTables();
    } catch {
      toast.error('Failed to regenerate QR');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading tables...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Table Management</h2>
          <p className="text-sm text-muted-foreground">{tables.length} tables configured</p>
        </div>
        <Button size="sm" onClick={handleAddSingle} disabled={actionLoading === 'add'}>
          <Plus className="h-4 w-4 mr-1" /> Add Table
        </Button>
      </div>

      {/* Bulk add */}
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Bulk add count..."
          value={bulkCount}
          onChange={(e) => setBulkCount(e.target.value)}
          min={1}
          max={50}
          className="max-w-[180px]"
        />
        <Button variant="outline" size="sm" onClick={handleBulkAdd} disabled={actionLoading === 'bulk'}>
          Bulk Add
        </Button>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.map((table) => (
          <Card key={table.id} className={`p-4 space-y-2 ${!table.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Table {table.table_number}</h3>
              <Badge variant={table.is_active ? 'default' : 'secondary'}>
                {table.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground font-mono">
              QR: {table.qr_code ? table.qr_code.slice(0, 12) + '...' : 'Not generated'}
            </p>

            <div className="flex gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleActive(table)}
                disabled={actionLoading === table.id}
              >
                {table.is_active ? <PowerOff className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                {table.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditTable(table);
                  setEditNumber(String(table.table_number));
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotateQr(table.id)}
                disabled={actionLoading === table.id}
              >
                <RefreshCw className={`h-3 w-3 ${actionLoading === table.id ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTable(table)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tables yet. Add your first table above.
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTable} onOpenChange={() => setEditTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Table Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>New Table Number</Label>
            <Input
              type="number"
              min={1}
              value={editNumber}
              onChange={(e) => setEditNumber(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTable(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading === 'edit'}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTable} onOpenChange={() => setDeleteTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Table {deleteTable?.table_number}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. Tables with active orders cannot be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTable(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading === 'delete'}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTablesTab;
