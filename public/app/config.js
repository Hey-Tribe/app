// Public Supabase settings for the browser. The publishable key is safe to ship: row level security protects the data.
window.HEYTRIBE = {
  // Sentry DSN for error reports (public by design). Empty turns reporting off.
  sentryDsn: "https://12f8ffd6dd40a341c8c6469092260634@o4512392984657920.ingest.us.sentry.io/4512393028108288",
  supabaseUrl: "https://ayafbypcbsfmqckuwqom.supabase.co",
  vapidPublicKey: "BF98FzITXaMSmtQTT-ykMkcXDyVJUwgxRenmuRZ-MjL90ZNytQhtdAUFyXUqvmKC2w-zE6ZTSdY5RbcvAiJaPsc",
  supabaseKey: "sb_publishable_MymhCm7AOF3UhF24YGO8ag_Vpq7JYZf",
  // Old name, kept so app versions still cached on phones keep working. Remove after December 2026.
  supabaseAnonKey: "sb_publishable_MymhCm7AOF3UhF24YGO8ag_Vpq7JYZf"
};
