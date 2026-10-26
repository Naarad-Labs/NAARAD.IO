/* Public configuration. Only values that are safe to ship in the browser belong
 * here: the project URL and the anon key, which is public by design because
 * row level security (supabase/migrations) is the wall, not the key.
 *
 * NEVER put the service-role key, a database password or any other secret in
 * this file or anywhere under app/. While these are empty, app/backend.js is
 * switched off and the Studio and My Journey say accounts are unavailable.
 */
export const SUPABASE_URL = 'https://efpkaptocxhevywfqhyt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcGthcHRvY3hoZXZ5d2ZxaHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzcxNDUsImV4cCI6MjA5ODIxMzE0NX0.jLUGrZpp3911l90XMXhRTC8VqWQdKQ3BzGMStb1JA18';
