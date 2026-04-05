import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { enrichSessionUser, getLegacyUserById, upsertLegacyUserFromDiscord } from '@/lib/auth/legacy-user';

type DiscordIdentityProfile = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

export const { handlers, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'identify',
        },
      },
      profile(profile) {
        const discordProfile = profile as DiscordIdentityProfile;
        return {
          id: String(discordProfile.id),
          name: discordProfile.global_name || discordProfile.username,
          image: discordProfile.avatar
            ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png?size=128`
            : null,
          discordId: String(discordProfile.id),
          username: String(discordProfile.username ?? 'ghosted-member'),
          displayName: String(discordProfile.global_name || discordProfile.username || 'Ghosted member'),
          avatarHash: discordProfile.avatar ? String(discordProfile.avatar) : null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, account }) {
      const discordProfile = profile as DiscordIdentityProfile | undefined;
      if (!discordProfile?.id) return false;
      await upsertLegacyUserFromDiscord(
        {
          id: String(discordProfile.id),
          username: String(discordProfile.username ?? 'ghosted-member'),
          global_name: discordProfile.global_name ? String(discordProfile.global_name) : null,
          avatar: discordProfile.avatar ? String(discordProfile.avatar) : null,
        },
        account
          ? {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          }
          : null,
      );
      return true;
    },
    async jwt({ token, profile, account }) {
      const discordProfile = profile as DiscordIdentityProfile | undefined;
      const nextToken = token as typeof token & {
        discordId?: string;
        username?: string;
        displayName?: string;
        avatarUrl?: string | null;
        isAdmin?: boolean;
        roles?: string[];
      };

      if (discordProfile?.id) {
        const legacyUser = await upsertLegacyUserFromDiscord(
          {
            id: String(discordProfile.id),
            username: String(discordProfile.username ?? 'ghosted-member'),
            global_name: discordProfile.global_name ? String(discordProfile.global_name) : null,
            avatar: discordProfile.avatar ? String(discordProfile.avatar) : null,
          },
          account
            ? {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            }
            : null,
        );
        nextToken.sub = legacyUser.id;
        nextToken.discordId = legacyUser.discordId;
        nextToken.username = legacyUser.username;
        nextToken.displayName = legacyUser.displayName;
        nextToken.avatarUrl = legacyUser.avatarUrl;
        nextToken.isAdmin = legacyUser.isAdmin;
        nextToken.roles = legacyUser.roles;
      } else if (nextToken.sub) {
        const legacyUser = getLegacyUserById(nextToken.sub);
        if (legacyUser) {
          nextToken.discordId = legacyUser.discordId;
          nextToken.username = legacyUser.username;
          nextToken.displayName = legacyUser.displayName;
          nextToken.avatarUrl = legacyUser.avatarUrl;
          nextToken.isAdmin = legacyUser.isAdmin;
          nextToken.roles = legacyUser.roles;
        }
      }
      return nextToken;
    },
    async session({ session, token }) {
      const sessionToken = token as typeof token & {
        displayName?: string;
        avatarUrl?: string | null;
      };
      const enriched = enrichSessionUser({
        ...session,
        user: {
          ...session.user,
          id: String(sessionToken.sub ?? ''),
          name: String(sessionToken.displayName ?? session.user?.name ?? ''),
          image: typeof sessionToken.avatarUrl === 'string' ? sessionToken.avatarUrl : session.user?.image,
        },
      } as typeof session & {
        user: typeof session.user & {
          id: string;
          discordId?: string;
          username?: string;
          displayName?: string;
          avatarUrl?: string;
          isAdmin?: boolean;
          roles?: string[];
        };
      });
      return enriched as typeof session;
    },
  },
});
