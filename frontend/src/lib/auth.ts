import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// 認証方式は暫定でCredentials(ID/パスワード)を採用。
// 実運用ではユーザーテーブル等への差し替えを想定した最小構成。
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "ユーザー名", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
        const adminPassword = process.env.ADMIN_PASSWORD ?? "admin";

        if (
          credentials?.username === adminUsername &&
          credentials?.password === adminPassword
        ) {
          return { id: "1", name: adminUsername };
        }
        return null;
      },
    }),
  ],
};
