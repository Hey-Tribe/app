// Supabase public key for server calls. Prefers the new publishable key (SUPABASE_PUBLISHABLE_KEY)
// and falls back to the old anon key. Old keys are JWTs and also go in the Authorization header;
// new keys are not JWTs and must be sent as the apikey header only.
export const sbKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
export const isJwtKey = (k = sbKey()) => typeof k === "string" && k.startsWith("eyJ");
export function sbHeaders(extra = {}) {
  const k = sbKey();
  const h = { apikey: k };
  if (k && (isJwtKey(k) || !k.startsWith("sb_"))) h.authorization = `Bearer ${k}`;
  return { ...h, ...extra };
}
