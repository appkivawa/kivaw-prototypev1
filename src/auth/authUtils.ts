import { getUserId } from "../data/savesApi";

export async function requireAuth(
  navigate: (to: string, options?: { state?: { from?: string }; replace?: boolean }) => void,
  returnTo: string
): Promise<string | null> {
  const uid = await getUserId();
  if (!uid) {
    navigate("/login", { state: { from: returnTo } });
    return null;
  }
  return uid;
}





