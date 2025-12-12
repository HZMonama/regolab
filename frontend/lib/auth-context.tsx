'use client';

import * as React from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  type User 
} from "firebase/auth";
import { auth, githubProvider } from "@/lib/firebase";
import { toast } from "sonner";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGithub: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGithub = React.useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      toast.success(`Welcome, ${result.user.displayName || result.user.email}!`);
    } catch (error: unknown) {
      console.error("GitHub sign-in error:", error);
      if (error instanceof Error) {
        // Handle specific Firebase auth errors
        if (error.message.includes("popup-closed-by-user")) {
          toast.error("Sign-in cancelled");
        } else if (error.message.includes("account-exists-with-different-credential")) {
          toast.error("An account already exists with a different sign-in method");
        } else {
          toast.error(`Sign-in failed: ${error.message}`);
        }
      } else {
        toast.error("Sign-in failed");
      }
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign-out error:", error);
      toast.error("Failed to sign out");
    }
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, signInWithGithub, signOut }),
    [user, loading, signInWithGithub, signOut]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
