import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import {
  handleGoogleCallback,
  loginWithOAuth,
} from '../controllers/oauthController';

export const oauthRoutes = Router();

const googleAuthOptions = { scope: ['profile', 'email'], session: false };

/** Dev helper: exact redirect URI sent to Google (must match Cloud Console). */
oauthRoutes.get('/google/config', (_req, res) => {
  res.json({
    enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    redirectUri: env.GOOGLE_CALLBACK_URL,
    frontendUrl: env.FRONTEND_URL,
    clientId: env.GOOGLE_CLIENT_ID,
  });
});

// Initiate Google OAuth login (server redirect — no browser GSI iframe)
oauthRoutes.get('/google', passport.authenticate('google', googleAuthOptions));

// Google OAuth callback — surface HR login rules (e.g. wrong Google account) in redirect
oauthRoutes.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', googleAuthOptions, (err, user, info) => {
    if (err) return next(err)
    if (!user) {
      const reason =
        (typeof info === 'object' && info && 'message' in info && String(info.message)) ||
        'google_auth_failed'
      return res.redirect(
        `${env.FRONTEND_URL}/auth/login?error=${encodeURIComponent(reason)}`,
      )
    }
    req.user = user
    return handleGoogleCallback(req, res)
  })(req, res, next)
});

// Login with OAuth (direct verification from frontend)
oauthRoutes.post('/oauth/login', loginWithOAuth);
