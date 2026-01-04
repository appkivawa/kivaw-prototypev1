import { supabase } from "../lib/supabaseClient";

export type TrendingStats = {
  topTag: { tag: string; count: number } | null;
  mostActiveTime: { time: string; count: number } | null;
  recurringTheme: { title: string; count: number } | null;
};

/**
 * Get trending stats based on all users' data
 */
export async function getTrendingStats(): Promise<TrendingStats> {
  try {
    // Get top tag from waves_summary (most used usage_tag)
    let topTag: { tag: string; count: number } | null = null;
    try {
      const { data: wavesData } = await supabase
        .from("waves_summary")
        .select("usage_tag, uses")
        .order("uses", { ascending: false })
        .limit(1);

      if (wavesData && wavesData.length > 0) {
        topTag = {
          tag: wavesData[0].usage_tag,
          count: wavesData[0].uses || 0,
        };
      }
    } catch (e) {
      console.warn("Could not get top tag from waves_summary:", e);
    }

    // Get most active time from saves_v2 (hour of day with most saves)
    let mostActiveTime: { time: string; count: number } | null = null;
    try {
      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .limit(1000);

      if (savesData && savesData.length > 0) {
        const hourCounts = new Map<number, number>();
        savesData.forEach((save) => {
          const hour = new Date(save.created_at).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        });

        let maxCount = 0;
        let maxHour = 12;
        hourCounts.forEach((count, hour) => {
          if (count > maxCount) {
            maxCount = count;
            maxHour = hour;
          }
        });

        const timeLabel =
          maxHour < 12 ? "morning" : maxHour < 17 ? "afternoon" : maxHour < 21 ? "evening" : "night";
        mostActiveTime = {
          time: timeLabel,
          count: maxCount,
        };
      }
    } catch (e) {
      console.warn("Could not get most active time:", e);
    }

    // Get recurring theme (most saved content item)
    let recurringTheme: { title: string; count: number } | null = null;
    try {
      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("content_item_id")
        .limit(1000);

      if (savesData && savesData.length > 0) {
        const contentCounts = new Map<string, number>();
        savesData.forEach((save) => {
          if (save.content_item_id) {
            contentCounts.set(
              save.content_item_id,
              (contentCounts.get(save.content_item_id) || 0) + 1
            );
          }
        });

        let maxCount = 0;
        let maxContentId = "";
        contentCounts.forEach((count, id) => {
          if (count > maxCount) {
            maxCount = count;
            maxContentId = id;
          }
        });

        if (maxContentId) {
          const { data: contentData } = await supabase
            .from("content_items")
            .select("title")
            .eq("id", maxContentId)
            .maybeSingle();

          if (contentData?.title) {
            recurringTheme = {
              title: contentData.title,
              count: maxCount,
            };
          }
        }
      }
    } catch (e) {
      console.warn("Could not get recurring theme:", e);
    }

    return {
      topTag,
      mostActiveTime,
      recurringTheme,
    };
  } catch (e) {
    console.error("Error getting trending stats:", e);
    return {
      topTag: null,
      mostActiveTime: null,
      recurringTheme: null,
    };
  }
}

