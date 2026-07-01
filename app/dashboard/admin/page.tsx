"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isUsingMock } from "@/lib/supabase";
import { 
  User, Mail, Lock, Trash2, Edit3, UserPlus, Shield, 
  Activity, Database, Sparkles, X, Check, Loader2, Key
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
}

export default function AdminPage() {
  const router = useRouter();
  
  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Authenticated Admin Profile
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Modals visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Active selected user for edit/password/delete
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Form Inputs
  const [formEmail, setFormEmail] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formPassword, setFormPassword] = useState("");

  // Check auth and verify superuser privileges
  useEffect(() => {
    const checkAdminPrivileges = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const email = user.email || "";
        const isSuper = email === "admin@kubicatrading.es" || email.startsWith("admin@kubicatrading");
        
        if (!isSuper) {
          setError("Acceso denegado: Se requieren privilegios de superusuario para ver esta sección.");
          setIsAdminUser(false);
          setLoading(false);
          return;
        }

        setCurrentAdminId(user.id);
        setIsAdminUser(true);
        fetchUsers();
      } catch (err) {
        console.error("Error al validar privilegios:", err);
        router.push("/login");
      }
    };

    checkAdminPrivileges();
  }, [router]);

  // Seed default users in Mock mode if they do not exist
  const getMockUsersList = (): AdminUser[] => {
    if (typeof window === "undefined") return [];
    
    const stored = localStorage.getItem("hivex_users");
    let parsedUsers = [];
    try {
      parsedUsers = stored ? JSON.parse(stored) : [];
    } catch (e) {
      parsedUsers = [];
    }

    // Default system seed users to showcase in mock mode
    const systemSeeds = [
      { id: "admin-user-id", email: "admin@kubicatrading.es", fullName: "Admin", createdAt: new Date().toISOString() },
      { id: "jsaavedra-user-id", email: "semeviene@hotmail.es", fullName: "Juan Manuel Saavedra", createdAt: new Date().toISOString() },
      { id: "cyildirim-user-id", email: "cerendeinert@hotmail.de", fullName: "Ceren Yildirim", createdAt: new Date().toISOString() },
      { id: "demo-user-id", email: "demo@hivex.com", fullName: "Alex Hivex", createdAt: new Date().toISOString() },
    ];

    // Merge system seeds with stored custom users, removing duplicates by email
    const mergedMap = new Map<string, any>();
    systemSeeds.forEach(s => mergedMap.set(s.email.toLowerCase(), s));
    parsedUsers.forEach((u: any) => {
      mergedMap.set(u.email.toLowerCase(), {
        id: u.id,
        email: u.email,
        fullName: u.user_metadata?.full_name || u.fullName || "Usuario Demo",
        createdAt: u.created_at || new Date().toISOString()
      });
    });

    return Array.from(mergedMap.values());
  };

  // Fetch users from local storage or secure backend API
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isUsingMock) {
        // Mode Demo: fetch from localStorage
        const mockUsers = getMockUsersList();
        setUsers(mockUsers);
      } else {
        // Mode Production: Fetch from server API route
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/users", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session?.access_token || ""}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.error("Error al obtener listado de usuarios:", err);
      setError(err.message || "No se pudo cargar el listado de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isUsingMock) {
        // Validate duplicates
        const stored = localStorage.getItem("hivex_users");
        let parsedUsers = stored ? JSON.parse(stored) : [];
        if (parsedUsers.some((u: any) => u.email.toLowerCase() === formEmail.trim().toLowerCase())) {
          throw new Error("El correo electrónico ya está registrado en la base de datos.");
        }

        const newId = Math.random().toString(36).substring(2, 15);
        const newUserObj = {
          id: newId,
          email: formEmail.trim(),
          password: formPassword,
          user_metadata: { full_name: formFullName.trim() || "Usuario Demo" },
          created_at: new Date().toISOString()
        };

        localStorage.setItem("hivex_users", JSON.stringify([...parsedUsers, newUserObj]));
        setSuccess("Usuario creado correctamente en el Modo Demo Local.");
        resetForm();
        setShowCreateModal(false);
        fetchUsers();
      } else {
        // Production: HTTP POST
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            fullName: formFullName.trim() || "Alex Hivex"
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        setSuccess("Usuario registrado exitosamente en Supabase Auth.");
        resetForm();
        setShowCreateModal(false);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || "Error al crear el usuario.");
    } finally {
      setActionLoading(false);
    }
  };

  // Update User Profile
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isUsingMock) {
        const stored = localStorage.getItem("hivex_users");
        let parsedUsers = stored ? JSON.parse(stored) : [];
        
        // Find if user already has an entry in custom users list, otherwise we inject it from system seeds
        let userIdx = parsedUsers.findIndex((u: any) => u.id === selectedUser.id);
        
        if (userIdx === -1) {
          // It was a system seed, let's create a custom entry for it
          const systemSeedsMap = {
            "admin-user-id": { email: "admin@kubicatrading.es", password: "hivex1234#" },
            "jsaavedra-user-id": { email: "semeviene@hotmail.es", password: "hivex1234#" },
            "cyildirim-user-id": { email: "cerendeinert@hotmail.de", password: "hivex1234#" },
            "demo-user-id": { email: "demo@hivex.com", password: "demo1234" }
          };
          const seedInfo = (systemSeedsMap as any)[selectedUser.id] || { email: selectedUser.email, password: "hivex1234#" };
          
          parsedUsers.push({
            id: selectedUser.id,
            email: seedInfo.email,
            password: seedInfo.password,
            user_metadata: { full_name: formFullName.trim() },
            created_at: selectedUser.createdAt || new Date().toISOString()
          });
        } else {
          parsedUsers[userIdx].user_metadata = { 
            ...parsedUsers[userIdx].user_metadata, 
            full_name: formFullName.trim() 
          };
        }

        localStorage.setItem("hivex_users", JSON.stringify(parsedUsers));
        setSuccess("Perfil de usuario actualizado correctamente.");
        setShowEditModal(false);
        fetchUsers();
      } else {
        // Production API PUT
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({
            id: selectedUser.id,
            fullName: formFullName.trim()
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        setSuccess("Perfil de usuario actualizado en Supabase.");
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || "Error al actualizar perfil.");
    } finally {
      setActionLoading(false);
    }
  };

  // Change User Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !formPassword) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isUsingMock) {
        const stored = localStorage.getItem("hivex_users");
        let parsedUsers = stored ? JSON.parse(stored) : [];
        
        let userIdx = parsedUsers.findIndex((u: any) => u.id === selectedUser.id);
        if (userIdx === -1) {
          // If system seed, convert to custom stored user
          const systemSeedsMap = {
            "admin-user-id": { email: "admin@kubicatrading.es", fullName: "Admin" },
            "jsaavedra-user-id": { email: "semeviene@hotmail.es", fullName: "Juan Manuel Saavedra" },
            "cyildirim-user-id": { email: "cerendeinert@hotmail.de", fullName: "Ceren Yildirim" },
            "demo-user-id": { email: "demo@hivex.com", fullName: "Alex Hivex" }
          };
          const seedInfo = (systemSeedsMap as any)[selectedUser.id] || { email: selectedUser.email, fullName: selectedUser.fullName };
          
          parsedUsers.push({
            id: selectedUser.id,
            email: seedInfo.email,
            password: formPassword,
            user_metadata: { full_name: seedInfo.fullName },
            created_at: selectedUser.createdAt || new Date().toISOString()
          });
        } else {
          parsedUsers[userIdx].password = formPassword;
        }

        localStorage.setItem("hivex_users", JSON.stringify(parsedUsers));
        setSuccess(`Contraseña cambiada exitosamente para ${selectedUser.email}.`);
        setShowPasswordModal(false);
        setFormPassword("");
      } else {
        // Production API PUT (changing password)
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({
            id: selectedUser.id,
            password: formPassword
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        setSuccess(`Contraseña restablecida correctamente en Supabase Auth.`);
        setShowPasswordModal(false);
        setFormPassword("");
      }
    } catch (err: any) {
      setError(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userId === currentAdminId) {
      alert("No puedes eliminar tu propia cuenta administrativa activa.");
      return;
    }

    const confirmDel = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${userEmail}? Esta acción es irreversible.`);
    if (!confirmDel) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isUsingMock) {
        const stored = localStorage.getItem("hivex_users");
        let parsedUsers = stored ? JSON.parse(stored) : [];
        
        // Remove from localStorage
        const updatedUsers = parsedUsers.filter((u: any) => u.id !== userId);
        localStorage.setItem("hivex_users", JSON.stringify(updatedUsers));
        setSuccess(`Usuario ${userEmail} eliminado de la base local.`);
        fetchUsers();
      } else {
        // Production API DELETE
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/users?id=${userId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session?.access_token || ""}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        setSuccess(`Usuario ${userEmail} eliminado de Supabase.`);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || "Error al eliminar el usuario.");
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormEmail("");
    setFormFullName("");
    setFormPassword("");
    setSelectedUser(null);
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormFullName(user.fullName);
    setShowEditModal(true);
  };

  const openPasswordModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormPassword("");
    setShowPasswordModal(true);
  };

  if (!isAdminUser && !loading) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950/40 border border-red-500/10 text-center max-w-2xl mx-auto my-12 backdrop-blur-xl shadow-2xl">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-red-400 mb-2">Acceso No Autorizado</h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          {error || "Se requieren privilegios de superusuario para ver esta sección. Inicie sesión con la cuenta de administrador oficial."}
        </p>
        <button 
          onClick={() => router.push("/dashboard")}
          className="px-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-bold hover:text-white hover:bg-zinc-850 transition-all shadow-md"
        >
          Volver al Resumen General
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 relative">
      {/* Background Decorative Glow */}
      <div className="absolute top-[10%] right-[10%] w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            <Shield className="w-8 h-8 text-violet-400" />
            Administración de Accesos
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            Gestione perfiles, correos electrónicos y contraseñas de acceso seguro para todos los analistas y operadores del panel HIVEX.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-95 duration-200"
        >
          <UserPlus className="w-4 h-4" />
          Crear Nuevo Usuario
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-center gap-3 animate-fade-in">
          <X className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-3 animate-fade-in">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Quick Dashboard Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-zinc-950/30 border border-zinc-900/80 backdrop-blur-xl flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center text-violet-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Analistas Registrados</div>
            <div className="text-2xl font-black text-white mt-1">{loading ? "..." : users.length}</div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-950/30 border border-zinc-900/80 backdrop-blur-xl flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Motor de Base de Datos</div>
            <div className="text-sm font-bold text-white mt-1.5 flex items-center gap-2">
              {isUsingMock ? (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Modo Demostración Local</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 text-violet-400" />
                  <span>Supabase Producción Auth</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-950/30 border border-zinc-900/80 backdrop-blur-xl flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estado de Superusuario</div>
            <div className="text-sm font-extrabold text-amber-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-md animate-pulse" />
              Sesión Administrativa Activa
            </div>
          </div>
        </div>
      </div>

      {/* Main Table View (Glassmorphism design) */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/30 backdrop-blur-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-900/80 bg-zinc-950/20 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Panel de Control de Analistas</span>
          <span className="text-[10px] text-zinc-600 font-semibold font-mono">SEGURIDAD DE ALTO NIVEL</span>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-3" />
            <span className="text-zinc-500 text-xs">Sincronizando base de datos de usuarios...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            No se encontraron usuarios en la base de datos de autenticación.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/10">
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-zinc-400 uppercase">Analista</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-zinc-400 uppercase">Correo Electrónico</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-zinc-400 uppercase">Identificador ID</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-zinc-400 uppercase text-right">Acciones de Seguridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40">
                {users.map((user) => {
                  const isSelf = user.id === currentAdminId;
                  const isUserAdmin = user.email === "admin@kubicatrading.es" || user.email.startsWith("admin@kubicatrading");
                  
                  return (
                    <tr key={user.id} className="hover:bg-zinc-900/10 transition-colors">
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-zinc-900/50 border flex items-center justify-center font-bold text-sm text-white ${isUserAdmin ? "border-amber-500/20 bg-amber-500/5 text-amber-400" : "border-zinc-800"}`}>
                            {user.fullName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              {user.fullName}
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-bold">
                                  Tú (Admin)
                                </span>
                              )}
                              {isUserAdmin && !isSelf && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold">
                                  Superusuario
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-xs text-zinc-300 font-medium">
                        {user.email}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-xs font-mono text-zinc-600">
                        {user.id}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            title="Editar Perfil"
                            className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-850 hover:text-white text-zinc-400 transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => openPasswordModal(user)}
                            title="Restablecer Contraseña"
                            className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-850 hover:text-amber-400 text-zinc-400 transition-all"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              disabled={actionLoading}
                              title="Eliminar analista"
                              className="p-2 rounded-lg border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-900 bg-zinc-950/95 p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-violet-400" />
              Crear Nuevo Analista
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                <div className="relative">
                  <User className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Correo Electrónico / Usuario</label>
                <div className="relative">
                  <Mail className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="analista@kubicatrading.es"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Contraseña Inicial</label>
                <div className="relative">
                  <Lock className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Contraseña robusta"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-850 bg-transparent text-xs text-zinc-400 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {actionLoading ? "Registrando..." : "Crear Cuenta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-900 bg-zinc-950/95 p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-violet-400" />
              Modificar Perfil de Analista
            </h3>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Correo Electrónico (No editable)</label>
                <div className="relative">
                  <Mail className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-700" />
                  <input
                    type="text"
                    disabled
                    value={selectedUser.email}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/30 border border-zinc-900 text-sm text-zinc-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                <div className="relative">
                  <User className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-850 bg-transparent text-xs text-zinc-400 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {actionLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CHANGE PASSWORD */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-900 bg-zinc-950/95 p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              Restablecer Contraseña
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Defina una contraseña de acceso nueva y segura para el operador: <strong className="text-white">{selectedUser.email}</strong>
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="w-4.5 h-4.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-850 bg-transparent text-xs text-zinc-400 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-zinc-950 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {actionLoading ? "Actualizando..." : "Restablecer Contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
