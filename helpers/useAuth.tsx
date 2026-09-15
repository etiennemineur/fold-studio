// Public self-hosted edition: no accounts or remote AI requests.
export const useAuth = () => ({ user: null, isAuthenticated: false, isLoading: false, logout: async () => {}, login: async () => { throw new Error("Accounts are unavailable in this edition"); }, isLoginLoading: false, isLogoutLoading: false, authError: null });
