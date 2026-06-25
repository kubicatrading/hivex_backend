// Mock Supabase Client for local-first seamless development and testing
// Saves all state to localStorage

const SEED_CHARTS = [
  {
    id: "chart-1",
    title: "Métricas de Crecimiento Mensual MRR",
    description: "Crecimiento de los ingresos recurrentes mensuales del SaaS (MRR) en USD.",
    type: "chart",
    file_url: null,
    metadata: {
      data: [
        { name: "Ene", mrr: 12000, ltv: 2400 },
        { name: "Feb", mrr: 15000, ltv: 2600 },
        { name: "Mar", mrr: 18500, ltv: 3100 },
        { name: "Abr", mrr: 22000, ltv: 3500 },
        { name: "May", mrr: 29000, ltv: 3900 },
        { name: "Jun", mrr: 35600, ltv: 4500 }
      ],
      xAxis: "name",
      series: [
        { key: "mrr", label: "Ingresos Recurrentes (MRR)", color: "#8b5cf6" },
        { key: "ltv", label: "Valor de Vida del Cliente (LTV)", color: "#10b981" }
      ]
    },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "chart-2",
    title: "Distribución de Usuarios por Dispositivo",
    description: "Porcentaje de acceso según plataforma del usuario.",
    type: "chart",
    file_url: null,
    metadata: {
      data: [
        { name: "Desktop (App & Web)", value: 5800 },
        { name: "iOS Native", value: 3400 },
        { name: "Android Native", value: 1200 },
        { name: "Otros", value: 600 }
      ],
      xAxis: "name",
      series: [
        { key: "value", label: "Usuarios Activos", color: "#3b82f6" }
      ]
    },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const SEED_AUDIOS = [
  {
    id: "audio-1",
    title: "Summer Ambient Wave",
    description: "Melodía de fondo relajante para concentrarse y trabajar.",
    type: "audio",
    file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    metadata: {
      duration: "6:12",
      genre: "Ambient",
      waveform: [30, 45, 20, 60, 80, 50, 40, 75, 90, 65, 30, 45, 60, 75, 45, 30, 20, 40, 85, 95, 70, 50, 40, 60, 50, 30]
    },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "audio-2",
    title: "Tech Podcast Intro Theme",
    description: "Sintonía electrónica enérgica para intros de contenido.",
    type: "audio",
    file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    metadata: {
      duration: "5:02",
      genre: "Synthwave",
      waveform: [40, 60, 30, 70, 90, 40, 20, 80, 100, 70, 40, 50, 70, 80, 50, 20, 30, 50, 90, 100, 60, 40, 30, 55, 45, 35]
    },
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const SEED_VIDEOS = [
  {
    id: "video-1",
    title: "SaaS Platform Introduction Walkthrough",
    description: "Video tutorial demostrando las capacidades del dashboard y gestión de archivos.",
    type: "video",
    file_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    metadata: {
      duration: "0:15",
      resolution: "1080p",
      thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
    },
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "video-2",
    title: "Sleek Animation Showreel",
    description: "Colección de animaciones fluidas y cinemáticas en ultra alta definición.",
    type: "video",
    file_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    metadata: {
      duration: "10:53",
      resolution: "1080p",
      thumbnail: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80"
    },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

interface MockUser {
  id: string;
  email: string;
  password?: string;
  user_metadata?: { full_name?: string; [key: string]: unknown };
  created_at: string;
}

interface MockDocument {
  id: string;
  title: string;
  description?: string;
  type: string;
  file_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

class MockSupabase {
  private getStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  }

  private setStorage<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  private getUsers(): MockUser[] {
    return this.getStorage<MockUser[]>("hivex_users", []);
  }

  private getSession() {
    return this.getStorage<{ access_token: string; user: MockUser } | null>("hivex_session", null);
  }

  private getDocuments(userId: string): MockDocument[] {
    const docs = this.getStorage<MockDocument[]>(`hivex_docs_${userId}`, [
      ...SEED_CHARTS,
      ...SEED_AUDIOS,
      ...SEED_VIDEOS
    ]);
    return docs;
  }

  private setDocuments(userId: string, docs: MockDocument[]) {
    this.setStorage(`hivex_docs_${userId}`, docs);
  }

  auth = {
    signUp: async ({ email, password, options }: { email: string; password?: string; options?: { data?: Record<string, unknown> } }) => {
      const users = this.getUsers();
      if (users.find((u: MockUser) => u.email === email)) {
        return { data: { user: null, session: null }, error: { message: "El usuario ya existe" } };
      }
      const newUser: MockUser = {
        id: Math.random().toString(36).substring(2, 15),
        email,
        user_metadata: { full_name: "Usuario Demo", ...(options?.data || {}) },
        created_at: new Date().toISOString()
      };
      this.setStorage("hivex_users", [...users, { ...newUser, password }]);
      
      const session = {
        access_token: "mock-token-" + newUser.id,
        user: newUser
      };
      this.setStorage("hivex_session", session);
      return { data: { user: newUser, session }, error: null };
    },

    signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
      const users = this.getUsers();
      const user = users.find((u: MockUser) => u.email === email && u.password === password);
      if (!user) {
        // Auto-create demo user for smooth first-time UX if email is demo@hivex.com
        if (email === "demo@hivex.com" && password === "demo1234") {
          const newUser: MockUser = {
            id: "demo-user-id",
            email,
            user_metadata: { full_name: "Alex Hivex" },
            created_at: new Date().toISOString()
          };
          this.setStorage("hivex_users", [...users, { ...newUser, password }]);
          const session = { access_token: "mock-token-demo", user: newUser };
          this.setStorage("hivex_session", session);
          return { data: { user: newUser, session }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: "Credenciales de demostración inválidas. Usa demo@hivex.com y demo1234" } };
      }
      
      const userWithoutPassword = { ...user };
      delete userWithoutPassword.password;

      const session = {
        access_token: "mock-token-" + user.id,
        user: userWithoutPassword
      };
      this.setStorage("hivex_session", session);
      return { data: { user: userWithoutPassword, session }, error: null };
    },

    signOut: async () => {
      this.setStorage("hivex_session", null);
      return { error: null };
    },

    getUser: async () => {
      const session = this.getSession();
      return { data: { user: session?.user || null }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: { access_token: string; user: MockUser } | null) => void) => {
      const session = this.getSession();
      callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
      
      // Return unsubscriber function
      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }
  };

  from(table: string) {
    const session = this.getSession();
    const userId = session?.user?.id || "demo-user-id";
    const docs = this.getDocuments(userId);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (_query: string = "*") => {
        return {
          order: (column: string, { ascending = true } = {}) => {
            const sorted = [...docs].sort((a: MockDocument, b: MockDocument) => {
              const valA = a[column];
              const valB = b[column];
              if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
              if (valA < valB) return ascending ? -1 : 1;
              if (valA > valB) return ascending ? 1 : -1;
              return 0;
            });
            return Promise.resolve({ data: sorted, error: null });
          },
          eq: (column: string, value: string) => {
            if (column === "type") {
              const filtered = docs.filter((d: MockDocument) => d.type === value);
              return Promise.resolve({ data: filtered, error: null });
            }
            return Promise.resolve({ data: docs, error: null });
          },
          single: () => {
            return Promise.resolve({ data: table === "profiles" ? { id: userId, email: session?.user?.email || "demo@hivex.com", full_name: session?.user?.user_metadata?.full_name || "Alex Hivex" } : docs[0], error: null });
          },
          then: (resolve: (value: { data: unknown; error: null }) => void) => {
            resolve({ data: table === "profiles" ? { id: userId, email: session?.user?.email || "demo@hivex.com", full_name: session?.user?.user_metadata?.full_name || "Alex Hivex" } : docs, error: null });
          }
        };
      },

      insert: async (data: unknown) => {
        const itemArray = Array.isArray(data) ? data : [data];
        const newItems = itemArray.map((item: Record<string, unknown>) => ({
          id: Math.random().toString(36).substring(2, 15),
          user_id: userId,
          created_at: new Date().toISOString(),
          ...item
        }));
        this.setDocuments(userId, [...docs, ...newItems as unknown as MockDocument[]]);
        return { data: newItems, error: null };
      },

      delete: () => {
        return {
          eq: async (column: string, value: string) => {
            const updatedDocs = docs.filter((d: MockDocument) => d[column] !== value);
            this.setDocuments(userId, updatedDocs);
            return { data: null, error: null };
          }
        };
      },

      update: (updateData: Record<string, unknown>) => {
        return {
          eq: async (column: string, value: string) => {
            const updatedDocs = docs.map((d: MockDocument) => {
              if (d[column] === value) {
                return { ...d, ...updateData };
              }
              return d;
            });
            this.setDocuments(userId, updatedDocs);
            return { data: null, error: null };
          }
        };
      }
    };
  }

  storage = {
    from: (bucketName: string) => {
      return {
        upload: async (path: string, file: File) => {
          // Simulate upload by generating object url
          const objectUrl = URL.createObjectURL(file);
          return { data: { path, fullPath: `${bucketName}/${path}` }, error: null, publicUrl: objectUrl };
        },
        getPublicUrl: (path: string) => {
          // If public url, we return an Unsplash or Sample URL based on path name
          let publicUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
          if (path.includes("audio")) {
            publicUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
          } else if (path.includes("video")) {
            publicUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
          }
          return { data: { publicUrl } };
        }
      };
    }
  };
}

export const mockSupabase = new MockSupabase();
