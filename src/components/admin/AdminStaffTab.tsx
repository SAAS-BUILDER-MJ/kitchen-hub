import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { fetchStaff, removeStaff, StaffMember } from '@/lib/staff-api';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeField } from '@/lib/sanitize';
import { UserPlus, Trash2, X, Shield, ChefHat, Mail, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  restaurantId: string;
}

export default function AdminStaffTab({ restaurantId }: Props) {
  const { auth } = useStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'chef' | 'waiter'>('chef');
  const [inviting, setInviting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      const data = await fetchStaff(restaurantId);
      setStaff(data);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleInvite = async () => {
    const cleanEmail = sanitizeField(inviteEmail, 255).toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-staff', {
        body: { restaurant_id: restaurantId, email: cleanEmail, role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Invitation sent to ${cleanEmail}`);
      setInviteOpen(false);
      setInviteEmail('');
      loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to invite staff member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: StaffMember) => {
    if (member.user_id === auth.userId) {
      toast.error("You can't remove yourself");
      return;
    }
    try {
      await removeStaff(member.id);
      toast.success('Staff member removed');
      setDeleteConfirm(null);
      loadStaff();
    } catch {
      toast.error('Failed to remove staff member');
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading staff...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Staff Members</h2>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite Staff
          </Button>
        </div>

        {staff.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No staff members yet. Invite your first chef!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  {member.role === 'admin' ? (
                    <Shield className="h-4 w-4 text-primary" />
                  ) : member.role === 'waiter' ? (
                    <UtensilsCrossed className="h-4 w-4 text-primary" />
                  ) : (
                    <ChefHat className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {member.user_id === auth.userId ? 'You' : `User ${member.user_id.slice(0, 8)}...`}
                    </span>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                {member.user_id !== auth.userId && (
                  <>
                    {deleteConfirm === member.id ? (
                      <div className="flex gap-1">
                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemove(member)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(member.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Invite Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Email *</label>
              <Input
                type="email"
                placeholder="chef@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'chef' | 'waiter')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chef">Chef (Kitchen Access)</SelectItem>
                  <SelectItem value="waiter">Waiter (Table Service)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              The staff member will receive login credentials. They must already have an account or will need to sign up first.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Inviting...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
