'use client'
import {
  meiliSearchAddContenAc,
  meiliSearchAddTagAc,
  OpenlistAc,
  WorkerDataAC,
} from '@web/app/(dashboard)/dashboard/(action)/action'
import { Button } from '@web/components/ui/button'
import React from 'react'

export function ButtonCard() {
  return (
    <div>
      <Button
        onClick={async () => {
          await OpenlistAc()
        }}
      >
        OpenlistAc
      </Button>
      <Button
        onClick={async () => {
          await WorkerDataAC()
        }}
      >
        WorkerDataAC
      </Button>
      <Button
        onClick={async () => {
          await meiliSearchAddContenAc()
        }}
      >
        meiliSearchAddContenAc
      </Button>
      <Button
        onClick={async () => {
          await meiliSearchAddTagAc()
        }}
      >
        meiliSearchAddTagAc
      </Button>
    </div>
  )
}
