"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { signInAC, registerAC } from "../(action)/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthForm() {
  const [selected, setSelected] = useState("login");
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  const searchParams = useSearchParams();
  const url = searchParams.get("callbackUrl") || "/";
  const { replace } = useRouter();
  const { status } = useSession();

  if (status === "authenticated") {
    replace(url);
  }

  const ErrorAlert = ({ error }: { error: any }) => {
    if (!error) return null;
    return (
      <Alert variant={error?.status === "error" ? "destructive" : undefined}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error.type === "validation" ? (
            <>
              {error.message.map((item: any, index: any) => (
                <div key={index}>{item.message}</div>
              ))}
            </>
          ) : (
            <div>{error.message}</div>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  const handleAuth = async (
    formData: FormData,
    action: "login" | "register"
  ) => {
    setIsLoading(true);
    const response = await (action === "login"
      ? signInAC(formData)
      : registerAC(formData));
    setIsLoading(false);

    if (response?.status === "success") {
      setError(response as any);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (action === "login") {
        replace(url);
      } else {
        setSelected("login");
        setError(undefined);
      }
    } else {
      setError(response as any);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <Card className="max-md w-[340px]">
        <CardContent className="overflow-hidden">
          <Tabs defaultValue={selected} className="max-w-xs w-full mt-3">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="login">登陆</TabsTrigger>
              <TabsTrigger value="sign-up">注册</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form
                action={(formData) => handleAuth(formData, "login")}
                className="space-y-2"
              >
                <div className="not-first:*:mt-2">
                  <Label>Email</Label>
                  <Input placeholder="Email" name="email" type="email" />
                </div>
                <div className="not-first:*:mt-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      className="pe-9"
                      name="password"
                      placeholder="Password"
                      type={isVisible ? "text" : "password"}
                    />
                    <button
                      className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-hidden focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={toggleVisibility}
                      aria-label={isVisible ? "Hide password" : "Show password"}
                      aria-pressed={isVisible}
                      aria-controls="password"
                    >
                      {isVisible ? (
                        <EyeOffIcon size={16} aria-hidden="true" />
                      ) : (
                        <EyeIcon size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <ErrorAlert error={error} />
                <p className="text-center text-small">
                  没有账户？{" "}
                  <Button variant="link" onClick={() => setSelected("sign-up")}>
                    注册
                  </Button>
                </p>
                <Button
                  className="w-full"
                  {...(isLoading && { disabled: true })}
                  type="submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      登陆
                    </>
                  ) : (
                    "登陆"
                  )}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="sign-up">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAuth(
                    new FormData(e.currentTarget),
                    "register"
                  );
                }}
                className="space-y-2"
              >
                <div className="not-first:*:mt-2">
                  <Label>Name</Label>
                  <Input placeholder="Name" name="name" />
                </div>
                <div className="not-first:*:mt-2">
                  <Label>Email</Label>
                  <Input placeholder="Enter your email" name="email" />
                </div>

                <div className="not-first:*:mt-2">
                  <Label>Password</Label>
                  <Input
                    placeholder="Enter your password"
                    name="password"
                    type="password"
                  />
                </div>
                <ErrorAlert error={error} />
                <p className="text-center text-small">
                  已有账户?{" "}
                  <Button variant="link" onClick={() => setSelected("login")}>
                    Login
                  </Button>
                </p>
                <Button
                  className="w-full"
                  {...(isLoading && { disabled: true })}
                  type="submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      注册
                    </>
                  ) : (
                    "注册"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
