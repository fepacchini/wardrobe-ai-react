import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey &&
  supabaseUrl !== "https://your-project-id.supabase.co"
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Convert a data URL (base64) to a Blob for upload
async function dataURLToBlob(dataURL) {
  const res = await fetch(dataURL);
  return res.blob();
}

// Upload image to Supabase Storage, returns public URL or null
export async function uploadItemImage(dataURL, id) {
  if (!supabase || !dataURL) return null;
  try {
    const blob = await dataURLToBlob(dataURL);
    const path = `${id}.jpg`;
    const { error } = await supabase.storage
      .from("wardrobe-images")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.warn("Image upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage
      .from("wardrobe-images")
      .getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn("Image upload error:", e);
    return null;
  }
}

function itemToDb(item) {
  return {
    id: item.id,
    title: item.title || "",
    category: item.category,
    style: item.style,
    fabric: item.fabric,
    colors: item.colors || [],
    tags: item.tags || [],
    favorite: item.favorite || false,
    image_url: item.image || "",
    updated_at: new Date().toISOString(),
  };
}

function dbToItem(row) {
  return {
    id: row.id,
    title: row.title || "",
    category: row.category,
    style: row.style,
    fabric: row.fabric,
    colors: row.colors || [],
    tags: row.tags || [],
    favorite: row.favorite || false,
    image: row.image_url || "",
    createdAt: row.created_at,
  };
}

export const wardrobeService = {
  async getAll() {
    if (!supabase) return null; // caller falls back to localStorage
    try {
      const { data, error } = await supabase
        .from("wardrobe_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(dbToItem);
    } catch (e) {
      console.error("Supabase getAll error:", e);
      return null;
    }
  },

  async create(item, imageDataURL) {
    if (!supabase) return null;
    try {
      // Try to upload image to Supabase Storage
      const imageUrl = await uploadItemImage(imageDataURL, item.id);
      const dbItem = itemToDb({ ...item, image: imageUrl || imageDataURL || "" });
      const { data, error } = await supabase
        .from("wardrobe_items")
        .insert(dbItem)
        .select()
        .single();
      if (error) throw error;
      return dbToItem(data);
    } catch (e) {
      console.error("Supabase create error:", e);
      return null;
    }
  },

  async update(id, updates) {
    if (!supabase) return false;
    try {
      const dbUpdates = { updated_at: new Date().toISOString() };
      if ("title" in updates) dbUpdates.title = updates.title;
      if ("category" in updates) dbUpdates.category = updates.category;
      if ("style" in updates) dbUpdates.style = updates.style;
      if ("fabric" in updates) dbUpdates.fabric = updates.fabric;
      if ("colors" in updates) dbUpdates.colors = updates.colors;
      if ("tags" in updates) dbUpdates.tags = updates.tags;
      if ("favorite" in updates) dbUpdates.favorite = updates.favorite;
      if ("image" in updates) dbUpdates.image_url = updates.image;

      const { error } = await supabase
        .from("wardrobe_items")
        .update(dbUpdates)
        .eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Supabase update error:", e);
      return false;
    }
  },

  async delete(id) {
    if (!supabase) return false;
    try {
      // Delete image from storage too
      await supabase.storage.from("wardrobe-images").remove([`${id}.jpg`]);
      const { error } = await supabase
        .from("wardrobe_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Supabase delete error:", e);
      return false;
    }
  },
};
