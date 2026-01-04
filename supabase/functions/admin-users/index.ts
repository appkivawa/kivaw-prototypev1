import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL_ALLOWLIST: string[] = [
  "kivawapp@proton.me",
];

interface AdminUsersResponse {
  total: number;
  users: Array<{
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
  }>;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight - MUST be first and return immediately
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  console.log("Handling", req.method, "request to admin-users");

  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" } as AdminUsersResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client with anon key for user verification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Received auth header:", authHeader ? `${authHeader.substring(0, 20)}...` : "missing");

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace(/^Bearer\s+/i, "");
    console.log("Extracted token length:", token.length);
    console.log("Token preview:", token.substring(0, 50) + "...");

    // Extract user ID from JWT payload - Supabase already validated it, so we trust it
    let userIdFromJWT: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }
      const payload = JSON.parse(atob(parts[1]));
      userIdFromJWT = payload.sub || payload.user_id || null;
      console.log("Extracted from JWT:", {
        userId: userIdFromJWT,
        email: payload.email,
        role: payload.role,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : "N/A",
      });
    } catch (decodeErr: any) {
      console.error("Could not decode JWT:", decodeErr);
      return new Response(
        JSON.stringify({ error: "Invalid JWT token format" } as AdminUsersResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!userIdFromJWT) {
      return new Response(
        JSON.stringify({ error: "JWT token missing user ID" } as AdminUsersResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Use service role to query profiles table directly (simpler than getUserById)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    
    // Query profiles table to get user info and admin status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_admin")
      .eq("id", userIdFromJWT)
      .maybeSingle();
    
    if (profileError && profileError.code !== "42P01") {
      // Error other than "table doesn't exist" - log it but continue with allowlist fallback
      console.warn("Error querying profiles table:", profileError);
    }
    
    // If profiles table doesn't exist or user not found, use email allowlist
    let userEmail: string | null = null;
    let isAdmin = false;
    
    if (profile) {
      userEmail = profile.email || null;
      isAdmin = profile.is_admin === true;
      console.log("User found in profiles:", { id: profile.id, email: userEmail, isAdmin });
    } else {
      // Profiles table doesn't exist or user not in profiles - try to get email from JWT payload
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          userEmail = payload.email || null;
          console.log("User not in profiles, using email from JWT:", userEmail);
        }
      } catch {
        // Ignore JWT decode errors here
      }
      
      // Use email allowlist as fallback
      if (userEmail && ADMIN_EMAIL_ALLOWLIST.length > 0) {
        isAdmin = ADMIN_EMAIL_ALLOWLIST.includes(userEmail.toLowerCase());
        console.log(`Email allowlist check: ${userEmail} isAdmin=${isAdmin}`);
      }
    }

    // Admin status already determined above
    const adminCheckError = profileError?.code === "42P01" ? "profiles table does not exist" : null;

    if (!isAdmin) {
      const errorDetails = adminCheckError 
        ? ` (${adminCheckError})` 
        : "";
      const emailInfo = userEmail ? ` Email: ${userEmail}.` : "";
      return new Response(
        JSON.stringify({
          error: `Forbidden: Admin access required.${emailInfo}${errorDetails} Please ensure your email is in the allowlist or set is_admin=true in profiles table.`,
        } as AdminUsersResponse),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // User is admin - use existing supabaseAdmin client to query profiles

    // Get total count and users from auth.users
    // Note: We can't directly query auth.users via REST API, so we'll use the admin client
    // to query the auth schema via RPC or direct SQL if needed
    // For now, we'll query profiles table which should mirror auth.users
    // If profiles doesn't exist, we'll return an error

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, created_at, last_sign_in_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      const errorMsg = profilesError.message || profilesError.code || "Unknown error";
      const errorCode = profilesError.code || "UNKNOWN";
      
      // If profiles table doesn't exist, provide helpful error message
      if (errorCode === "42P01" || errorMsg.includes("does not exist")) {
        return new Response(
          JSON.stringify({
            error: `Profiles table does not exist. Please run the migration: supabase/migrations/create_profiles_table.sql. Error: ${errorMsg}`,
            total: 0,
            users: [],
          } as AdminUsersResponse),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          error: `Could not fetch users from profiles table. Error code: ${errorCode}, Message: ${errorMsg}`,
          total: 0,
          users: [],
        } as AdminUsersResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Also get total count
    const { count, error: countError } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const total = count || 0;
    const users = (profiles || []).map((p) => ({
      id: p.id,
      email: p.email || null,
      created_at: p.created_at,
      last_sign_in_at: p.last_sign_in_at || null,
    }));

    return new Response(
      JSON.stringify({
        total,
        users,
      } as AdminUsersResponse),
      {
        status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error in admin-users function:", errorMsg, errorStack);
    
    return new Response(
      JSON.stringify({
        error: `Internal server error: ${errorMsg}. Check function logs for details.`,
        total: 0,
        users: [],
      } as AdminUsersResponse),
      {
        status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

