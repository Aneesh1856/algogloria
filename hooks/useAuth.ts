import { useAuthContext } from '../context/AuthContext';

export type { AppUser } from '../context/AuthContext';

export function useAuth() {
  return useAuthContext();
}
