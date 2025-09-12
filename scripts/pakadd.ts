#!/usr/bin/env bun

const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('用法: bun pakadd <package> <project>')
  process.exit(1)
}

const [pkg, project] = args
const cwd = `apps/${project}`

const { spawn } = await import('node:child_process')
const child = spawn('bun', ['add', pkg, '--cwd', cwd], {
  stdio: 'inherit',
})

child.on('close', (code) => process.exit(code || 0))
export {}
