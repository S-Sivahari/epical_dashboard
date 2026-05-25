import passport from 'passport';
import { ObjectId } from 'mongodb';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { getDB } from './db';
import bcrypt from 'bcryptjs';

export function initializePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const googleId = profile.id;

          if (!email) {
            return done(new Error('No email provided by Google'));
          }

          const userCollection = getDB().collection('users');

          // Try to find existing user
          let user: any = await userCollection.findOne({ email: email.toLowerCase().trim() });

          if (!user) {
            // Auto-create user if it doesn't exist
            const newUser = {
              id: `EMP-${Date.now()}`,
              email: email.toLowerCase().trim(),
              name: name || email.split('@')[0],
              googleId,
              passwordHash: await bcrypt.hash('', 10), // Empty password hash for OAuth users
              role: 'Employee',
              designation: 'Employee',
              joinedAt: new Date().toISOString().split('T')[0],
              avatarUrl: profile.photos?.[0]?.value,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await userCollection.insertOne(newUser);
            user = newUser;
          } else if (!user.googleId) {
            // Link Google ID to existing user
            await userCollection.updateOne(
              { _id: user._id },
              { $set: { googleId, updatedAt: new Date() } }
            );
            user.googleId = googleId;
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user._id.toString());
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const userCollection = getDB().collection('users');
      const user = await userCollection.findOne({ _id: new ObjectId(id) });
      done(null, user as any);
    } catch (error) {
      done(error);
    }
  });
}

