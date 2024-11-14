import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

// 将错误信息抽取为常量
const AUTH_ERROR_MESSAGES = {
  USER_NOT_FOUND: "呜呜~ 这个用户好像不存在哦，快检查一下吧！",
  INVALID_PASSWORD: "啊呀~ 密码错啦~ 试试看能不能记起来？",
} as const;

export class CustomAuthError extends AuthError {
  constructor(msg: string) {
    super();
    this.message = msg;
    this.stack = undefined;
  }
}

// 将验证逻辑抽取为独立函数
const validateCredentials = async (
  credentials: Record<"email" | "password", string>
) => {
  const user = await prisma.users.findUnique({
    where: { email: credentials.email },
  });

  if (!user) {
    throw new CustomAuthError(AUTH_ERROR_MESSAGES.USER_NOT_FOUND);
  }

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.password
  );
  if (!passwordMatch) {
    throw new CustomAuthError(AUTH_ERROR_MESSAGES.INVALID_PASSWORD);
  }

  return user;
};

export default {
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: validateCredentials,
    }),
  ],
  pages: {
    signIn: "/AuthPanel",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // User is available during sign-in
        token.identity = user.identity;
      }
      return token;
    },
    session({ session, token }) {
      session.user.identity = token.identity;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) {
        return isLoggedIn;
      }
      return true;
    },
  },
  debug: false,
} satisfies NextAuthConfig;
