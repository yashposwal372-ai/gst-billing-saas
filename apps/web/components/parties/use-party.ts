"use client";
import { useEffect, useState } from "react";
import { partyApi, type PartyKind, type PartyProfile } from "../../lib/parties";
export function useParty(kind: PartyKind, id?: string) {
  const [profile, setProfile] = useState<PartyProfile | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [loaded, setLoaded] = useState("");
  const key = kind + "/" + id + "#" + attempt;
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    let alive = true;
    partyApi(kind)
      .detail(id, abort.signal)
      .then((result) => {
        if (alive) {
          setProfile(result.profile);
          setError("");
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "This record could not be loaded. It may be unavailable or you may not have access.",
          );
      })
      .finally(() => {
        if (alive) setLoaded(key);
      });
    return () => {
      alive = false;
      abort.abort();
    };
  }, [kind, id, attempt, key]);
  return {
    profile,
    error,
    loading: Boolean(id) && loaded !== key,
    retry: () => setAttempt((n) => n + 1),
  };
}
