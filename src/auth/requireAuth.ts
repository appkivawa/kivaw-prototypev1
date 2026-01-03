import { getUserId } from "../data/savesApi";

export async function requireAuth(
  navigate: (to: string) => void,
  returnTo: string
): Promise<string | null> {
  const uid = await getUserId();
  if (!uid) {
    navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
    return null;
  }
  return uid;
}

