"use server";
import { signIn } from "@/auth";
import prisma from "@/lib/prisma";
import { AuthError } from "next-auth";
import { hashPassword } from "@/lib/auth/authpw";
import { ZodError, object, string } from "zod";

const signInSchema = object({
  email: string()
    .min(1, "邮箱可不能忘了呀！填上吧~")
    .email("这不是一个合法的邮箱哦！快检查一下格式！"),
  password: string()
    .min(8, "至少 8 个字符哦～！")
    .max(32, "密码不能超过32个字符哦～！"),
});

// 登陆部分
export async function signInAC(formData: FormData) {
  const credentials = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };
  try {
    const { email, password } = await signInSchema.parseAsync(credentials);
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    if (result?.error) {
      return {
        status: "error",
        message: result.error,
      };
    }
    return {
      status: "success",
      message: "耶~ 登录成功啦！欢迎回来，主人~",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        type: "validation",
        message: error.errors,
      };
    }
    if (error instanceof AuthError) {
      return {
        status: "error",
        message: error.message,
      };
    }
    return {
      status: "error",
      message: "登录失败了哦～，请稍后再试",
    };
  }
}

const registerSchema = object({
  email: string({ required_error: "邮箱可不能忘了呀！填上吧~" })
    .min(1, { message: "邮箱可不能忘了呀！填上吧~" })
    .email("这不是一个合法的邮箱哦！快检查一下格式！"),
  password: string({ required_error: "嘿嘿，密码也得有哦！" })
    .min(8, "密码得长一点，至少 8 个字符！")
    .max(32, "密码太长啦，最多 32 个字符！"),
  name: string({ required_error: "君の名は？" })
    .min(1, "至少得有个名吧")
    .max(32, "名字太长啦，记不住啦，最多 32 个字符！"),
});

export const registerAC = async (formData: FormData) => {
  const credentials = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    name: formData.get("name") as string,
  };
  try {
    const { email, password, name } =
      await registerSchema.parseAsync(credentials);
    const existingUser = await prisma.users.findUnique({ where: { email } });

    if (existingUser) {
      return {
        status: "error",
        message: "邮箱已经注册过了哦～，请使用其他邮箱注册",
      };
    }

    const hashedPassword = await hashPassword(password);

    await prisma.users.create({
      data: {
        name,
        email,
        password: hashedPassword,
        identity: "user",
      },
    });

    return {
      status: "success",
      message: "注册成功啦！欢迎加入我们！",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        type: "validation",
        message: error.errors,
      };
    }
    return {
      status: "error",
      message: "注册失败了哦～，请稍后再试",
    };
  }
};
