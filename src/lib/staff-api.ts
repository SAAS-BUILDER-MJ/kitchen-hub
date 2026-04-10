import { supabase } from '@/integrations/supabase/client';

export interface StaffMember {
  id: string;
  user_id: string;
  role: 'admin' | 'chef';
  restaurant_id: string;
  created_at: string;
  email?: string;
}

/** Fetch staff members for a restaurant */
export async function fetchStaff(restaurantId: string): Promise<StaffMember[]> {
  if (!restaurantId) throw new Error('restaurantId is required');
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('role', ['admin', 'chef']);
  if (error) throw error;
  return (data || []) as StaffMember[];
}

/** Invite a chef by calling the invite-staff edge function */
export async function inviteStaff(
  restaurantId: string,
  email: string,
  role: 'chef' | 'admin' = 'chef'
) {
  const { data, error } = await supabase.functions.invoke('invite-staff', {
    body: { restaurant_id: restaurantId, email, role },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Remove a staff member's role */
export async function removeStaff(roleId: string) {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', roleId);
  if (error) throw error;
}
