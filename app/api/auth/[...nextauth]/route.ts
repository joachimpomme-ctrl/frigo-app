import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim())

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // Seuls les emails autorisés peuvent se connecter
      if (!user.email) return false
      if (!ALLOWED_EMAILS.includes(user.email)) {
        return false
      }
      return true
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub
      }
      return session
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
