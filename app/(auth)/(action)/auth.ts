"use server";
import { signIn } from "@/auth";
import prisma from "@/lib/prisma";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { ZodError, object, string } from "zod";

const signInSchema = object({
  email: string({ required_error: "邮箱可不能忘了呀！填上吧~" })
    .min(1, { message: "邮箱可不能忘了呀！填上吧~" })
    .email("这不是一个合法的邮箱哦！快检查一下格式！"),
  password: string({ required_error: "嘿嘿，密码也得有哦！" })
    .min(8, "密码得长一点，至少 8 个字符！")
    .max(32, "密码太长啦，最多 32 个字符！"),
});

// 登陆部分
export async function signInAC(formData: FormData) {
  const zodyjvg = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };
  try {
    const { email, password } = await signInSchema.parseAsync(zodyjvg);
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    if (result.error) {
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
  try {
    const zodyjvg = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      name: formData.get("name") as string,
    };
    console.log(zodyjvg);
    const { email, password, name } = await registerSchema.parseAsync(zodyjvg);
    const result = await prisma.users.findUnique({ where: { email: email } });
    if (result) {
      return {
        status: "error",
        message: "邮箱已经注册过了哦～，请使用其他邮箱注册",
      };
    } else {
      const pawHash = await bcrypt.hash(password, 10);
      await prisma.users.create({
        data: {
          name: name,
          email: email,
          password: pawHash,
          identity: "user",
        },
      });
      return {
        status: "success",
        message: "注册成功啦！欢迎加入我们！",
      };
    }
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
      message: "注册失败了哦～，请稍后再试" + error,
    };
  }
};
