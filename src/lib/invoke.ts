// src/lib/invoke.ts
import { supabase } from "./supabaseClient";

export async function invokeFunction<T = any>(name: string, body?: any) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;

  if (!token) {
    throw new Error("Not authenticated (no access token).");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) throw error;
  return data as T;
}
