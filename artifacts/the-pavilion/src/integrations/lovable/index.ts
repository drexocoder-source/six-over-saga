// Lovable auth integration — replaced with stub for Replit migration.
// Google OAuth is not configured in this environment. Users can use email/password.

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: any) => {
      return { error: new Error("Google sign-in requires OAuth configuration. Please use email/password instead.") };
    },
  },
};
