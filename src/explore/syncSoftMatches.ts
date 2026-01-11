import { supabase } from "../lib/supabase";
import { clearSoftQueue, readSoftQueue } from "./softMatchStore";

export async function syncSoftMatches(userId: string) {
  const queue = readSoftQueue();
  if (!queue.length) return { synced: 0 };

  // Upsert into user_item_actions. Because of unique(user_id,item_id),
  // we can safely "last action wins".
  const payload = queue.map((e) => ({
    user_id: userId,
    item_id: e.itemId,
    action: e.action,
    mood_at_time: e.mood ?? null,
    intent_at_time: e.intent ?? null,
    energy_at_time: typeof e.energy === "number" ? e.energy : null,
  }));

  const { error } = await supabase
    .from("user_item_actions")
    .upsert(payload, { onConflict: "user_id,item_id" });

  if (error) throw error;

  clearSoftQueue();
  return { synced: queue.length };
}
