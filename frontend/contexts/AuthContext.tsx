import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { authService } from "@/services/authService";
import "@/utils/auth-cleanup"; // Import auth debug tools
import type { AuthUser, LoginCredentials, UserRole } from "@shared/dao";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  canEdit: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Log pour debug mais pas d'erreur dans certain cas
    console.error("useAuth called outside AuthProvider");
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);

      // Check if user is stored locally
      const storedUser = authService.getStoredUser();
      const token = authService.getToken();

      console.log("🔄 Initializing auth...");
      console.log("📦 Stored user:", storedUser?.email || "none");
      console.log("🔑 Token exists:", !!token);

      if (storedUser && token) {
        try {
          console.log("✅ Verifying token with server...");
          // Verify with server
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          console.log("🔄 Auth restored from storage:", currentUser.email);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Distinguer les erreurs réseau des erreurs d'authentification
          if (
            errorMessage.includes("connexion") ||
            errorMessage.includes("réseau") ||
            errorMessage.includes("serveur")
          ) {
            console.warn(
              "🌐 Network error during auth verification:",
              errorMessage,
            );
            // Pour les erreurs réseau, on peut garder l'utilisateur connecté temporairement
            // mais on devra re-vérifier plus tard
            setUser(storedUser);
            console.log(
              "⚠️ Using cached user due to network error, will retry later",
            );

            // Programmer une re-vérification dans 30 secondes
            setTimeout(() => {
              console.log("🔄 Retrying auth verification...");
              initializeAuth();
            }, 30000);
          } else {
            console.warn("⚠️ Auth verification failed:", errorMessage);
            console.log("🧹 Clearing invalid auth data...");
            // Clear auth data for authentication errors (401, invalid token, etc.)
            authService.clearAuth();
            setUser(null);
          }
        }
      } else {
        console.log("ℹ️ No stored credentials found");
        // Clear any partial auth data
        authService.clearAuth();
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Auth initialization failed:", error);
      authService.clearAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log("✅ Auth initialization complete");
    }
  };

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
      console.log("✅ Login successful:", response.user.email);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      console.log("✅ Logout successful");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback(
    (roles: UserRole[]): boolean => {
      return user ? roles.includes(user.role) : false;
    },
    [user],
  );

  const isAdmin = useCallback((): boolean => {
    return user?.role === "admin";
  }, [user]);

  const canEdit = useCallback((): boolean => {
    return hasRole(["admin", "user"]);
  }, [hasRole]);

  const value: AuthContextType = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      hasRole,
      isAdmin,
      canEdit,
    }),
    [user, isLoading, login, logout, hasRole, isAdmin, canEdit],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
