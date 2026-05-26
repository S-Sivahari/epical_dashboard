import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import {
  handleGoogleCallback,
  loginWithOAuth,
} from '../controllers/oauthController';

export const oauthRoutes = Router();

const googleAuthOptions = { scope: ['profile', 'email'], session: false };

// Initiate Google OAuth login (server redirect — no browser GSI iframe)
oauthRoutes.get('/google', passport.authenticate('google', googleAuthOptions));

// Google OAuth callback
oauthRoutes.get(
  '/google/callback',
  passport.authenticate('google', {
    ...googleAuthOptions,
    failureRedirect: `${env.FRONTEND_URL}/auth/login?error=google_auth_failed`,
  }),
  handleGoogleCallback,
);

// Login with OAuth (direct verification from frontend)
oauthRoutes.post('/oauth/login', loginWithOAuth);
