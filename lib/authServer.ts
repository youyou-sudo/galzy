"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const signIn = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  await auth.api.signInEmail({
    body: {
      email: email,
      password: password,
    },
  });
};

export const signUp = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) => {
  await auth.api.signUpEmail({
    body: {
      name: name,
      email: email,
      password: password,
    },
  });
};

export const signOut = async () => {
  await auth.api.signOut({
    headers: await headers(),
  });
};
