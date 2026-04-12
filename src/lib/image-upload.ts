import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'menu-images';

export async function uploadMenuImage(
  restaurantId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${restaurantId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

export async function deleteMenuImage(imageUrl: string): Promise<void> {
  // Extract path from URL
  const urlParts = imageUrl.split(`/storage/v1/object/public/${BUCKET}/`);
  if (urlParts.length < 2) return;
  const path = urlParts[1];

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
