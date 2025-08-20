import React from "react";
import { Modal } from "./modal";
import AuthForm from "@/components/auth/AuthForm";

export default async function page() {
  return (
    <Modal>
      <AuthForm />
    </Modal>
  );
}
