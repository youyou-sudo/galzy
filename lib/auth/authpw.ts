import { compare, hash } from "bcryptjs";

// 密码哈希函数
export const hashPassword = async (password: string) => {
  const saltRounds = 10;
  const hashedPassword = await hash(password, saltRounds);
  return hashedPassword;
};

// 密码验证函数
export const comparePassword = async (
  inputPassword: string,
  hashedPassword: string
) => {
  const isMatch = await compare(inputPassword, hashedPassword);
  return isMatch;
};
