/**
 * 单页采集逻辑（CDP 之上的编排层）：
 *   设置视口/主题 → 导航 → 等 load/网络空闲/字体/图片 → 滚动触发懒加载
 *   → 回顶部 → 等布局稳定 → 全页截图 + outerHTML。
 */
import { CdpClient } from './cdp'
import { sleep, withTimeout } from './util'

export type ThemeMode = 'light' | 'dark' | 'auto'

export type VariantSpec = {
  name: string
  width: number
  height: number
  theme: ThemeMode
  mobile?: boolean
}

export type RouteSpec = {
  /** 站点内路径模板，如 /games 或 /tags/$tagId */
  path: string
  /** 动态段真实值，如 { tagId: 'g946' } */
  params?: Record<string, string>
  /** 额外 query string（不带 ?），可为空 */
  query?: string
  /** manifest 中的名字，仅用于日志 */
  name?: string
  /** 期望的最终路径（用于识别重定向，如 admin → /auth/login） */
  expectFinalPath?: string
  /** 期望 HTTP 状态，默认 200 */
  expectStatus?: number
}

export type CaptureResult = {
  route: string
  url: string
  finalUrl: string
  finalPath: string
  title: string
  status: number | null
  statuses: number[]
  redirected: boolean
  resolvedTheme: 'light' | 'dark' | 'unknown'
  viewport: { width: number; height: number; deviceScaleFactor: number; mobile: boolean; theme: ThemeMode }
  pageSize: { width: number; height: number }
  screenshotPath: string | null
  htmlPath: string | null
  bytes: { png: number; html: number }
  durationMs: number
  warnings: string[]
  error: string | null
  /** 页面文本长度，用于快速识别空白页 */
  textLength: number
  /** 是否命中应用级错误页（__root errorComponent） */
  appError: string | null
  /** 各阶段耗时（ms），便于发现慢在哪一步 */
  timings: Record<string, number>
}

const FREEZE_CSS = [
  '*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;',
  'animation-iteration-count:1!important;transition-delay:0s!important;',
  'transition-duration:0s!important;}',
  'html{scroll-behavior:auto!important;}',
  '*{caret-color:transparent!important;}',
  'html{scrollbar-width:thin;}',
].join('')

/** 不参与网络空闲判断的请求（统计/埋点/CDP 自身），避免永远等不到 idle。 */
const IGNORED_REQUEST = /(umami|google-analytics|googletagmanager|baidu\.com\/hm|clarity\.ms|sentry\.io|hotjar|doubleclick|googlesyndication|adsystem|cloudflareinsights)/i

export type PageSessionOptions = {
  deviceScaleFactor?: number
  /** 单个路由的整体超时 */
  routeTimeoutMs?: number
  /** 网络空闲判定窗口 */
  idleMs?: number
  /** 全页截图最大高度（超过则截断并告警） */
  maxPageHeight?: number
  /** 采集 HTML（关闭可提速） */
  captureHtml?: boolean
  /** 触发懒加载时最多滚动多少屏 */
  maxScrollSteps?: number
  /** 隐藏广告位内容（保留占位，避免随机广告污染像素对比），默认 true */
  hideAds?: boolean
}

type DocResponse = { url: string; status: number; redirect: boolean }

export class PageSession {
  private cdp: CdpClient
  private options: Required<PageSessionOptions>
  private inflight = new Set<string>()
  private criticalInflight = new Set<string>()
  private lastNetworkActivity = Date.now()
  private lastCriticalActivity = Date.now()
  private docResponses: DocResponse[] = []
  private mainFrameId = ''
  private themeScriptId: string | null = null
  private prepared = false
  private currentVariant: VariantSpec | null = null

  constructor(cdp: CdpClient, options: PageSessionOptions = {}) {
    this.cdp = cdp
    this.options = {
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
      routeTimeoutMs: options.routeTimeoutMs ?? 45000,
      idleMs: options.idleMs ?? 600,
      maxPageHeight: options.maxPageHeight ?? 16384,
      captureHtml: options.captureHtml ?? true,
      maxScrollSteps: options.maxScrollSteps ?? 120,
      hideAds: options.hideAds ?? true,
    }
  }

  /** 一次性初始化：开启域、绑定网络/导航事件。 */
  async prepare(): Promise<void> {
    if (this.prepared) return
    await this.cdp.send('Page.enable')
    await this.cdp.send('Runtime.enable')
    await this.cdp.send('Network.enable', { maxTotalBufferSize: 256 * 1024 * 1024 })

    const frameTree = await this.cdp.send<{
      frameTree: { frame: { id: string; url: string } }
    }>('Page.getFrameTree')
    this.mainFrameId = frameTree.frameTree.frame.id

    const CRITICAL_TYPES = new Set(['Document', 'Script', 'XHR', 'Fetch', 'Stylesheet'])
    this.cdp.on('Network.requestWillBeSent', (params) => {
      const type = params.type as string | undefined
      if (type === 'WebSocket' || type === 'EventSource' || type === 'Ping') return
      const request = params.request as { url?: string } | undefined
      const url = request?.url ?? ''
      if (IGNORED_REQUEST.test(url)) return
      const id = params.requestId as string
      this.inflight.add(id)
      this.lastNetworkActivity = Date.now()
      if (type && CRITICAL_TYPES.has(type)) {
        this.criticalInflight.add(id)
        this.lastCriticalActivity = Date.now()
      }
    })
    const finish = (params: Record<string, unknown>) => {
      const id = params.requestId as string
      if (this.inflight.delete(id)) this.lastNetworkActivity = Date.now()
      if (this.criticalInflight.delete(id)) this.lastCriticalActivity = Date.now()
    }
    this.cdp.on('Network.loadingFinished', finish)
    this.cdp.on('Network.loadingFailed', finish)
    this.cdp.on('Network.responseReceived', (params) => {
      const response = params.response as { status?: number; url?: string } | undefined
      const type = params.type as string | undefined
      if (!response || type !== 'Document') return
      this.docResponses.push({
        url: response.url ?? '',
        status: response.status ?? 0,
        redirect: Boolean(params.redirectResponse),
      })
    })
    this.prepared = true
  }

  /** 应用视口 + 主题（含 localStorage 预置脚本）。 */
  async applyVariant(variant: VariantSpec): Promise<void> {
    await this.prepare()
    if (this.themeScriptId) {
      try {
        await this.cdp.send('Page.removeScriptToEvaluateOnNewDocument', {
          identifier: this.themeScriptId,
        })
      } catch {
        /* ignore */
      }
      this.themeScriptId = null
    }
    const source =
      '(function(){try{var theme=' +
      JSON.stringify(variant.theme) +
      ';try{localStorage.setItem("theme",theme);}catch(e){}' +
      'var root=document.documentElement;if(!root)return;' +
      'var resolved=theme==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;' +
      'root.classList.remove("light","dark");root.classList.add(resolved);' +
      'if(theme==="auto"){root.removeAttribute("data-theme")}else{root.setAttribute("data-theme",theme)}' +
      'root.style.colorScheme=resolved;}catch(e){}})();'
    const added = await this.cdp.send<{ identifier: string }>(
      'Page.addScriptToEvaluateOnNewDocument',
      { source },
    )
    this.themeScriptId = added.identifier

    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: variant.width,
      height: variant.height,
      deviceScaleFactor: this.options.deviceScaleFactor,
      mobile: Boolean(variant.mobile),
      screenWidth: variant.width,
      screenHeight: variant.height,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    })
    await this.cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: Boolean(variant.mobile),
      maxTouchPoints: variant.mobile ? 5 : 1,
    })
    await this.cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: variant.theme === 'dark' ? 'dark' : 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    })
    try {
      await this.cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' })
    } catch {
      /* 老版本浏览器可能不支持 */
    }
    try {
      await this.cdp.send('Emulation.setLocaleOverride', { locale: 'zh-CN' })
    } catch {
      /* ignore */
    }
    this.currentVariant = variant
  }

  /** 采集一条路由。 */
  async capture(route: RouteSpec, variant: VariantSpec, outPrefix: string): Promise<CaptureResult> {
    const startedAt = Date.now()
    const url = this.buildUrl(route)
    const warnings: string[] = []
    const result: CaptureResult = {
      route: route.path,
      url,
      finalUrl: url,
      finalPath: route.path,
      title: '',
      status: null,
      statuses: [],
      redirected: false,
      resolvedTheme: 'unknown',
      viewport: {
        width: variant.width,
        height: variant.height,
        deviceScaleFactor: this.options.deviceScaleFactor,
        mobile: Boolean(variant.mobile),
        theme: variant.theme,
      },
      pageSize: { width: 0, height: 0 },
      screenshotPath: null,
      htmlPath: null,
      bytes: { png: 0, html: 0 },
      durationMs: 0,
      warnings,
      error: null,
      textLength: 0,
      appError: null,
      timings: {},
    }

    const timings: Record<string, number> = result.timings
    const mark = (phase: string): void => {
      timings[phase] = Date.now() - startedAt
    }

    try {
      if (this.currentVariant?.name !== variant.name) await this.applyVariant(variant)
      mark('variant')

      this.docResponses = []
      this.inflight.clear()
      this.criticalInflight.clear()
      this.lastNetworkActivity = Date.now()
      this.lastCriticalActivity = Date.now()

      await this.navigate(url, warnings)
      mark('navigate')

      const idleOk = await this.waitNetworkIdle()
      if (!idleOk) warnings.push('网络未在超时内空闲')
      mark('idle')

      await this.settle(warnings)
      mark('settle')
      await this.injectFreezeCss()
      mark('freeze')
      await this.scrollThrough()
      mark('scroll')

      const idleAfterLazy = await this.waitNetworkIdle(12000)
      if (!idleAfterLazy) warnings.push('懒加载滚动后网络未空闲')
      mark('idle2')
      await this.settle(warnings, 1500)
      mark('settle2')

      // 回到顶部后重新稳定（fixed 顶栏会从收缩态恢复）
      await this.evaluate('window.scrollTo(0,0);true')
      await sleep(300)
      await this.waitStableMetrics(warnings)
      mark('top')

      const meta = await this.collectMeta()
      result.finalUrl = meta.href
      result.finalPath = this.pathOf(meta.href)
      result.title = meta.title
      result.resolvedTheme = meta.theme
      result.textLength = meta.textLength
      result.appError = meta.appError
      result.redirected = result.finalPath !== route.path

      const statuses = this.docResponses.map((item) => item.status).filter((s) => s > 0)
      result.statuses = statuses
      result.status = statuses.length > 0 ? statuses[statuses.length - 1] : null

      const { png, pageSize } = await this.screenshot(warnings)
      mark('screenshot')
      result.pageSize = pageSize
      result.screenshotPath = outPrefix + '.png'
      await Bun.write(result.screenshotPath, png)
      result.bytes.png = png.byteLength

      if (this.options.captureHtml) {
        const html = await this.getHtml()
        result.htmlPath = outPrefix + '.html'
        await Bun.write(result.htmlPath, html)
        result.bytes.html = Buffer.byteLength(html, 'utf8')
        mark('html')
      }

      if (pageSize.height < 200) warnings.push('页面高度异常（可能空白）')
      if (result.status !== null && result.status >= 400) {
        result.error = 'HTTP ' + result.status
      }
      if (result.appError) {
        warnings.push('命中应用错误页: ' + result.appError)
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
    } finally {
      result.durationMs = Date.now() - startedAt
    }
    return result
  }

  private buildUrl(route: RouteSpec): string {
    const query = route.query ? (route.query.startsWith('?') ? route.query : '?' + route.query) : ''
    let path = route.path.startsWith('/') ? route.path : '/' + route.path
    for (const [key, value] of Object.entries(route.params ?? {})) {
      path = path.split('$' + key).join(encodeURIComponent(value))
    }
    return this.baseUrl.replace(/\/+$/, '') + path + query
  }

  private baseUrl = ''

  setBaseUrl(base: string): void {
    this.baseUrl = base
  }

  private pathOf(href: string): string {
    try {
      const parsed = new URL(href)
      return parsed.pathname + (parsed.search || '')
    } catch {
      return href
    }
  }

  private async navigate(url: string, warnings: string[]): Promise<void> {
    const loadPromise = this.cdp
      .waitFor('Page.loadEventFired', { timeoutMs: 25000 })
      .catch(() => null)
    const response = await this.cdp.send<{ errorText?: string }>(
      'Page.navigate',
      { url, frameId: this.mainFrameId || undefined },
      15000,
    )
    if (response.errorText) throw new Error('导航失败: ' + response.errorText)
    await loadPromise
    // load 之后再确认 readyState，SPA 客户端路由切换也能兜底
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const state = await this.evaluate('document.readyState').catch(() => 'loading')
      if (state === 'complete') return
      await sleep(100)
    }
    warnings.push('等待 readyState=complete 超时')
  }

  /**
   * 网络空闲：以「最近一次网络活动」为准。
   * 远程 CDN 图片/统计请求可能长期悬挂（永远不 loadingFinished），
   * 只要一段时间没有新请求，就认为页面已进入稳定态。
   */
  private async waitNetworkIdle(timeoutMs = 15000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const criticalQuiet = Date.now() - this.lastCriticalActivity
      if (this.criticalInflight.size === 0 && criticalQuiet >= this.options.idleMs) return true
      // 完全没有任何网络活动（含图片）也视为稳定
      if (Date.now() - this.lastNetworkActivity >= this.options.idleMs * 4) return true
      await sleep(80)
    }
    return false
  }

  /** 字体、图片、布局高度稳定。 */
  private async settle(warnings: string[], extraMs = 0): Promise<void> {
    try {
      await withTimeout(
        this.evaluate(
          'document.fonts&&document.fonts.ready?document.fonts.ready.then(function(){return true}):true',
          true,
        ),
        5000,
        'document.fonts.ready',
      )
    } catch {
      warnings.push('字体加载等待超时')
    }
    try {
      await withTimeout(
        this.evaluate(
          'new Promise(function(res){var imgs=Array.prototype.slice.call(document.images);' +
            'if(!imgs.length){res(true);return}var left=imgs.length;var done=false;' +
            'var finish=function(){if(done)return;done=true;clearTimeout(t);res(true)};' +
            'var t=setTimeout(finish,8000);' +
            'imgs.forEach(function(img){var one=function(){if(--left<=0)finish()};' +
            'if(img.complete){one()}else{img.addEventListener("load",one,{once:true});img.addEventListener("error",one,{once:true})}});})',
          true,
        ),
        4000,
        '图片加载',
      )
    } catch {
      warnings.push('图片加载等待超时')
    }
    await this.waitStableMetrics(warnings)
    if (extraMs > 0) await sleep(extraMs)
  }

  /** 布局高度连续多次不变即视为稳定。 */
  private async waitStableMetrics(warnings: string[]): Promise<void> {
    let last = -1
    let stable = 0
    const deadline = Date.now() + 6000
    while (Date.now() < deadline) {
      const height = await this.evaluate(
        'Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)',
      ).catch(() => -2)
      if (typeof height === 'number' && height === last && height > 0) {
        stable++
        if (stable >= 3) return
      } else {
        stable = 0
        last = typeof height === 'number' ? height : -1
      }
      if (Math.abs(Number(height)) > this.options.maxPageHeight * 4) {
        warnings.push('页面高度异常大: ' + height)
        return
      }
      await sleep(200)
    }
    warnings.push('布局高度未稳定')
  }

  private async injectFreezeCss(): Promise<void> {
    // 广告是随机噪声：只隐藏内容，保留占位（visibility 不改变布局），
    // 基线/候选两侧一致处理，避免随机广告素材造成假差异。
    const adsCss = this.options.hideAds
      ? '\n#sidebar-ad,[data-ad-slot]{visibility:hidden!important}\n'
      : ''
    const source = JSON.stringify(FREEZE_CSS + adsCss)
    await this.evaluate(
      '(function(){var id="__parity_freeze__";var el=document.getElementById(id);' +
        'if(!el){el=document.createElement("style");el.id=id;(document.head||document.documentElement).appendChild(el)}' +
        'el.textContent=' +
        source +
        ';try{history.scrollRestoration="manual"}catch(e){}return true})()',
    ).catch(() => {})
  }

  /** 逐屏滚动到底再回顶部，触发懒加载图片 / 无限列表首屏补全。 */
  private async scrollThrough(): Promise<void> {
    const steps = this.options.maxScrollSteps
    const script =
      '(async function(){var step=Math.max(200,Math.round(window.innerHeight*0.85));' +
      'var y=0;var guard=0;' +
      'while(guard++<' +
      steps +
      '){var h=document.documentElement.scrollHeight;' +
      'if(y>=h-2)break;y=Math.min(y+step,h);window.scrollTo(0,y);' +
      'await new Promise(function(r){setTimeout(r,90)})}' +
      'window.scrollTo(0,document.documentElement.scrollHeight);' +
      'await new Promise(function(r){setTimeout(r,450)});' +
      'window.scrollTo(0,0);await new Promise(function(r){setTimeout(r,350)});return true})()'
    try {
      await withTimeout(this.evaluate(script, true), 15000, '懒加载滚动')
    } catch {
      /* 滚动失败不致命 */
    }
  }

  private async collectMeta(): Promise<{
    href: string
    title: string
    theme: 'light' | 'dark' | 'unknown'
    textLength: number
    appError: string | null
  }> {
    const meta = await this.evaluate(
      '(function(){var root=document.documentElement;' +
        'var text=document.body?document.body.innerText:"";' +
        'var err=null;' +
        'var lines=text.split("\\n").map(function(s){return s.trim()}).filter(Boolean);' +
        'for(var i=0;i<lines.length;i++){if(/页面加载出错|页面不存在|出错了/.test(lines[i])){err=lines[i].slice(0,120);break}}' +
        'return {href:location.href,title:document.title,' +
        'theme:root.classList.contains("dark")?"dark":(root.classList.contains("light")?"light":"unknown"),' +
        'textLength:text.length,appError:err}})()',
    )
    return meta as {
      href: string
      title: string
      theme: 'light' | 'dark' | 'unknown'
      textLength: number
      appError: string | null
    }
  }

  private async getHtml(): Promise<string> {
    const value = await this.evaluate('document.documentElement.outerHTML')
    return typeof value === 'string' ? '<!DOCTYPE html>\n' + value : ''
  }

  /** 全页截图：优先 captureBeyondViewport + clip，失败则临时拉高视口。 */
  private async screenshot(
    warnings: string[],
  ): Promise<{ png: Uint8Array; pageSize: { width: number; height: number } }> {
    const metrics = await this.cdp.send<{
      cssContentSize?: { width: number; height: number }
      contentSize?: { width: number; height: number }
    }>('Page.getLayoutMetrics')
    const cssContent = metrics.cssContentSize ?? metrics.contentSize ?? { width: 0, height: 0 }
    const variant = this.currentVariant
    const width = Math.max(variant?.width ?? 0, Math.ceil(cssContent.width))
    let height = Math.max(variant?.height ?? 0, Math.ceil(cssContent.height))
    if (height > this.options.maxPageHeight) {
      warnings.push(
        '页面高度 ' + height + 'px 超过上限 ' + this.options.maxPageHeight + 'px，已截断',
      )
      height = this.options.maxPageHeight
    }

    const capture = async (params: Record<string, unknown>): Promise<Uint8Array> => {
      const shot = await this.cdp.send<{ data: string }>('Page.captureScreenshot', params, 60000)
      return Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0))
    }

    try {
      const png = await capture({
        format: 'png',
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: true,
        fromSurface: true,
      })
      return { png, pageSize: { width, height } }
    } catch (error) {
      warnings.push('captureBeyondViewport 失败，回退到扩大视口: ' + String(error))
      const original = variant ?? { width, height: 900, theme: 'light' as ThemeMode }
      await this.cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: this.options.deviceScaleFactor,
        mobile: false,
        screenWidth: width,
        screenHeight: height,
      })
      try {
        const png = await capture({ format: 'png', fromSurface: true })
        return { png, pageSize: { width, height } }
      } finally {
        await this.applyVariant({ ...original, name: original.name })
      }
    }
  }

  /** 在页面里求值并返回 JSON 结果。 */
  async evaluate(expression: string, awaitPromise = false): Promise<unknown> {
    const response = await this.cdp.send<{
      result: { value?: unknown; description?: string }
      exceptionDetails?: { text?: string; exception?: { description?: string } }
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: false,
    })
    if (response.exceptionDetails) {
      throw new Error(
        '页面求值异常: ' +
          (response.exceptionDetails.exception?.description ??
            response.exceptionDetails.text ??
            'unknown'),
      )
    }
    return response.result?.value
  }
}
