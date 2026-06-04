import passport from 'passport';
import { ObjectId } from 'mongodb';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { getDB } from './db';
import bcrypt from 'bcryptjs';
import {
  ensureUserAccountForEmployee,
  normalizeLoginEmail,
  OAUTH_ONLY_EMPLOYEE_PASSWORD,
  resolveUserForOAuthLogin,
} from '../utils/employeeAuth';
import { EmployeeLoginError } from '../utils/employeeLoginRules';

export function initializePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;

          if (!email) {
            return done(new Error('No email provided by Google'));
          }

          const normalizedEmail = normalizeLoginEmail(email);
          let existingUser: any = null;
          let employee: any = null;
          try {
            const resolved = await resolveUserForOAuthLogin(normalizedEmail);
            existingUser = resolved.user;
            employee = resolved.employee;
          } catch (err) {
            if (err instanceof EmployeeLoginError) {
              return done(null, false, { message: err.message });
            }
            throw err;
          }

          if (!employee && !existingUser) {
            return done(null, false, {
              message:
                'This email is not registered. Contact HR to be added as an employee, or use the admin sign-in.',
            });
          }

          let user = existingUser;
          if (!user && employee) {
            user = await ensureUserAccountForEmployee(employee as any, OAUTH_ONLY_EMPLOYEE_PASSWORD);
          }

          if (!user) {
            return done(null, false, { message: 'Unable to sign in with this email.' });
          }

          const userCollection = getDB().collection('users');

          if (!user.passwordHash) {
            await userCollection.updateOne(
              { _id: user._id },
              { $set: { passwordHash: await bcrypt.hash('', 10), updatedAt: new Date() } },
            );
          }

          if (googleId && !user.googleId) {
            await userCollection.updateOne(
              { _id: user._id },
              { $set: { googleId, updatedAt: new Date() } },
            );
            user.googleId = googleId;
          }

          const displayName =
            employee
              ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
              : user.name || profile.displayName || normalizedEmail.split('@')[0];

          return done(null, {
            ...user,
            email: normalizedEmail,
            name: displayName,
            designation: user.designation || employee?.designation || 'Employee',
            joinedAt: user.joinedAt || employee?.joinedAt,
            avatarUrl: user.avatarUrl || profile.photos?.[0]?.value,
          });
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
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
