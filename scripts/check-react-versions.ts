/**
 * check-react-versions.ts — 构建期校验 react / react-dom 版本一致性
 *
 * React 19.2+ 的 react-dom 在模块初始化时硬校验 React.version：
 * react 与 react-dom 版本不一致会直接 throw，导致生产环境每次渲染报
 * "Incompatible React versions" 错误。该错误曾因 Docker 构建不使用
 * 仓库锁文件、浮动解析出混合版本的 react/react-dom 而上线。
 *
 * 本脚本扫描已安装的 react / react-dom（排除 bun 安装缓存 .bun 中的
 * 历史版本），要求：
 *   1. 各自只存在一个版本
 *   2. react 与 react-dom 版本一致
 * 不满足时退出码 1，让构建失败而不是带病上线。
 */

import { Glob } from 'bun'

const VERSIONS: Record<string, Set<string>> = {
  react: new Set(),
  'react-dom': new Set(),
}

const glob = new Glob('**/node_modules/{react,react-dom}/package.json')

for await (const file of glob.scan({
  cwd: '.',
  // bun 安装的包在 node_modules 里是到 .bun store 的符号链接，默认不跟随
  followSymlinks: true,
  ignore: [],
})) {
  // 跳过 bun 安装缓存（.bun 内含历史版本，不代表当前安装）
  if (file.replaceAll('\\', '/').includes('/.bun/')) continue
  const pkg = (await Bun.file(file).json()) as {
    name?: string
    version?: string
  }
  if ((pkg.name === 'react' || pkg.name === 'react-dom') && pkg.version) {
    VERSIONS[pkg.name].add(pkg.version)
  }
}

let failed = false

for (const name of ['react', 'react-dom'] as const) {
  const versions = [...VERSIONS[name]]
  if (versions.length === 0) {
    console.error(`[check-react] ${name}: not found in node_modules`)
    failed = true
    continue
  }
  if (versions.length > 1) {
    console.error(
      `[check-react] ${name}: multiple versions installed: ${versions.join(', ')}`,
    )
    failed = true
  }
  console.log(`[check-react] ${name}: ${versions.join(', ')}`)
}

const react = [...VERSIONS.react]
const reactDom = [...VERSIONS['react-dom']]
if (react.length === 1 && reactDom.length === 1 && react[0] !== reactDom[0]) {
  console.error(
    `[check-react] react (${react[0]}) !== react-dom (${reactDom[0]})`,
  )
  failed = true
}

if (failed) {
  console.error('[check-react] FAILED: 版本不一致会导致 React 运行时崩溃，构建中止')
  process.exit(1)
}

console.log('[check-react] OK: react 与 react-dom 版本一致')
