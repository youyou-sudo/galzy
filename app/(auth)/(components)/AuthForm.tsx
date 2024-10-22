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
  const [selected, setSelected] = React.useState<React.Key>("login");

  //   登陆部分
  const searchParams = useSearchParams();
  const url = searchParams.get("callbackUrl") || "/";
  const { replace } = useRouter();

  const { status } = useSession();
  const [loingerr, setLoingerr] = useState();
  const [loadingsu, setLoadingsu] = useState(false);

  if (status === "authenticated") {
    replace(`${url || "/"}`);
  }

  const ling = async (formData: FormData) => {
    setLoadingsu(true);
    const log = await signInAC(formData);
    setLoadingsu(false);
    if (log?.status === "success") {
      setLoadingsu(false);
      setLoingerr(log);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      replace(`${url || "/"}`);
    } else {
      setLoingerr(log);
      setLoadingsu(false);
    }
  };

  //   注册部分
  const reg = async (formData: FormData) => {
    setLoadingsu(true);
    const log = await registerAC(formData);
    console.log(log);
    setLoadingsu(false);
    if (log?.status === "success") {
      setLoadingsu(false);
      setLoingerr(log);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSelected("login");
    } else {
      setLoingerr(log);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <Card className="max-md w-[340px] ">
        <CardBody className="overflow-hidden">
          <Tabs
            fullWidth
            size="md"
            aria-label="Tabs form"
            selectedKey={selected}
            onSelectionChange={setSelected}
          >
            {/* 登陆部分 */}
            <Tab key="login" title="登陆">
              <form action={ling} className="space-y-4">
                <Input isRequired label="Email" name="email" />
                <Input
                  isRequired
                  label="Password"
                  name="password"
                  type="password"
                />
                {loingerr && (
                  <Alert
                    variant={
                      loingerr?.status === "error" ? "destructive" : undefined
                    }
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {loingerr.type === "validation" ? (
                        <>
                          {loingerr.message.map((item, index) => (
                            <div key={index}>{item.message}</div>
                          ))}
                        </>
                      ) : (
                        <div>{loingerr.message}</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-center text-small">
                  Already have an account?{" "}
                  <Link size="sm" onPress={() => setSelected("sign-up")}>
                    Login
                  </Link>
                </p>
                <Button
                  isLoading={loadingsu}
                  fullWidth
                  color="primary"
                  type="submit"
                >
                  登陆
                </Button>
              </form>
            </Tab>
            {/* 注册部分 */}
            <Tab key="sign-up" title="注册">
              <form action={reg} className="space-y-4">
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
                {loingerr && (
                  <Alert
                    variant={
                      loingerr?.status === "error" ? "destructive" : undefined
                    }
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {loingerr.type === "validation" ? (
                        <>
                          {loingerr.message.map((item, index) => (
                            <div key={index}>{item.message}</div>
                          ))}
                        </>
                      ) : (
                        <div>{loingerr.message}</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-center text-small">
                  已有账户?{" "}
                  <Link size="sm" onPress={() => setSelected("login")}>
                    Login
                  </Link>
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    isLoading={loadingsu}
                    type="submit"
                    fullWidth
                    color="primary"
                  >
                    注册
                  </Button>
                </div>
              </form>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
