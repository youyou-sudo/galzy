import AuthForm from '@web/components/auth/AuthForm'
import React from 'react'
import { Modal } from './modal'

export default async function page() {
  return (
    <Modal>
      <AuthForm />
    </Modal>
  )
}
