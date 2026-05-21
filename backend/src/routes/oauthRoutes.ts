import { Router } from 'express';
import passport from 'passport';
import {
  handleGoogleCallback,
  loginWithOAuth,
} from '../controllers/oauthController';

export const oauthRoutes = Router();

// Initiate Google OAuth login
oauthRoutes.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Google OAuth callback
oauthRoutes.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failed',
  }),
  handleGoogleCallback
);

// Login with OAuth (direct verification from frontend)
oauthRoutes.post('/oauth/login', loginWithOAuth);
