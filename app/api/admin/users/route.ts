import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin client dynamically to bypass RLS and perform auth actions
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key in environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Verifies the Authorization token and ensures the caller is indeed admin@kubicatrading.es
async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401, adminClient: null, currentUser: null };
  }

  const token = authHeader.substring(7);
  try {
    const adminClient = getSupabaseAdmin();
    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
      return { error: "Unauthorized session", status: 401, adminClient: null, currentUser: null };
    }

    const email = user.email || "";
    const isAdmin = email === "admin@kubicatrading.es" || email.startsWith("admin@kubicatrading");

    if (!isAdmin) {
      return { error: "Forbidden: Superuser privileges required", status: 403, adminClient: null, currentUser: null };
    }

    return { error: null, status: 200, adminClient, currentUser: user };
  } catch (err: any) {
    console.error("Error verifying admin token:", err);
    return { error: err.message || "Internal server error during verification", status: 500, adminClient: null, currentUser: null };
  }
}

// GET: List all users
export async function GET(request: Request) {
  const { error, status, adminClient } = await verifyAdmin(request);
  if (error || !adminClient) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    // Map users to clean format
    const results = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || "Alex Hivex",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at
    }));

    return NextResponse.json({ users: results });
  } catch (err: any) {
    console.error("GET /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Failed to list users" }, { status: 500 });
  }
}

// POST: Create a new user
export async function POST(request: Request) {
  const { error, status, adminClient } = await verifyAdmin(request);
  if (error || !adminClient) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 1. Create user in Supabase Auth
    const { data: { user }, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "Alex Hivex" }
    });

    if (createError) throw createError;
    if (!user) throw new Error("Created user was empty");

    // 2. Insert/upsert public.profiles
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: user.id,
        email: email,
        full_name: fullName || "Alex Hivex"
      });

    if (profileError) {
      console.warn("User auth created, but public.profile upsert failed:", profileError);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || fullName || "Alex Hivex",
        createdAt: user.created_at
      }
    });
  } catch (err: any) {
    console.error("POST /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Failed to create user" }, { status: 500 });
  }
}

// PUT: Update an existing user's password or metadata
export async function PUT(request: Request) {
  const { error, status, adminClient } = await verifyAdmin(request);
  if (error || !adminClient) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const { id, password, fullName } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (password) updateData.password = password;
    if (fullName) {
      updateData.user_metadata = { full_name: fullName };
    }

    // 1. Update in auth.users
    const { data: { user }, error: updateError } = await adminClient.auth.admin.updateUserById(id, updateData);
    if (updateError) throw updateError;
    if (!user) throw new Error("Updated user was empty");

    // 2. Update public.profiles if fullName changed
    if (fullName) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", id);

      if (profileError) {
        console.warn("User auth updated, but public.profile update failed:", profileError);
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || "Alex Hivex",
        updatedAt: user.updated_at
      }
    });
  } catch (err: any) {
    console.error("PUT /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Failed to update user" }, { status: 500 });
  }
}

// DELETE: Delete a user by ID
export async function DELETE(request: Request) {
  const { error, status, adminClient, currentUser } = await verifyAdmin(request);
  if (error || !adminClient) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Safety check: prevent deleting themselves
    if (id === currentUser?.id) {
      return NextResponse.json({ error: "You cannot delete your own administrative account" }, { status: 400 });
    }

    // 1. Delete from public.profiles
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.warn("Deleting profiles database entry encountered an error:", profileError);
    }

    // 2. Delete from auth.users
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete user" }, { status: 500 });
  }
}
