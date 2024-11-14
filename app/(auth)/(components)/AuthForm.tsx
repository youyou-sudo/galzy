"use client";
import React, { useState } from "react";
import {
  Tabs,
  Tab,
  Input,
  Link,
  Button,
  Card,
  CardBody,
} from "@nextui-org/react";
import { useSession } from "next-auth/react";
import { signInAC, registerAC } from "../(action)/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthForm() {
  const [selected, setSelected] = useState<React.Key>("login");
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);

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
      setError(response);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (action === "login") {
        replace(url);
      } else {
        setSelected("login");
        setError(undefined);
      }
    } else {
      setError(response);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <Card className="max-md w-[340px]">
        <CardBody className="overflow-hidden">
          <Tabs
            fullWidth
            size="md"
            aria-label="Tabs form"
            selectedKey={selected}
            onSelectionChange={setSelected}
          >
            <Tab key="login" title="登陆">
              <form
                action={(formData) => handleAuth(formData, "login")}
                className="space-y-4"
              >
                <Input isRequired label="Email" name="email" />
                <Input
                  isRequired
                  label="Password"
                  name="password"
                  type="password"
                />
                <ErrorAlert error={error} />
                <p className="text-center text-small">
                  没有账户？{" "}
                  <Link size="sm" onClick={() => setSelected("sign-up")}>
                    注册
                  </Link>
                </p>
                <Button
                  isLoading={isLoading}
                  fullWidth
                  color="primary"
                  type="submit"
                >
                  登陆
                </Button>
              </form>
            </Tab>

            <Tab key="sign-up" title="注册">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAuth(new FormData(e.currentTarget), "register");
                }}
                className="space-y-4"
              >
                <Input
                  isRequired
                  name="name"
                  label="Name"
                  placeholder="Enter your name"
                />
                <Input
                  isRequired
                  label="Email"
                  name="email"
                  placeholder="Enter your email"
                />
                <Input
                  isRequired
                  label="Password"
                  name="password"
                  placeholder="Enter your password"
                  type="password"
                />
                <ErrorAlert error={error} />
                <p className="text-center text-small">
                  已有账户?{" "}
                  <Link size="sm" onClick={() => setSelected("login")}>
                    Login
                  </Link>
                </p>
                <Button
                  isLoading={isLoading}
                  type="submit"
                  fullWidth
                  color="primary"
                >
                  注册
                </Button>
              </form>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
