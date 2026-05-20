import api from './api';

export interface GoogleOAuthCredentials {
  email: string;
  name: string;
  googleId: string;
}

export async function verifyGoogleOAuthLogin(credentials: GoogleOAuthCredentials) {
  const response = await api.post('/auth/oauth/login', {
    email: credentials.email,
    name: credentials.name,
    googleId: credentials.googleId,
  });

  return response.data;
}

export function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not configured');
  }
  return clientId;
}
