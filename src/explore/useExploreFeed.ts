import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Item = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  external_url: string | null;
  source: string | null;
  moods: string[] | null;
  intents: string[] | null;
  energy_min: number | null;
  energy_max: number | null;
};

export function useExploreFeed(limit = 50) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select("id,type,title,subtitle,image_url,external_url,source,moods,intents,energy_min,energy_max")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!alive) return;
      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems((data ?? []) as Item[]);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [limit]);

  return { items, loading };
}
