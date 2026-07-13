// Performance profiling, monitoring, and optimization tools

// === PERFORMANCE MARKS & MEASURES ===

export interface PerformanceMark {
  name: string
  startTime: number
  duration?: number
}

export interface PerformanceMetrics {
  marks: Record<string, PerformanceMark>
  measures: Record<string, number>
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

const performanceMarks = new Map<string, number>()
const performanceMeasures = new Map<string, number[]>()

export function startMark(name: string): void {
  performanceMarks.set(name, performance.now())
  performance.mark(`${name}-start`)
}

export function endMark(name: string): number {
  const startTime = performanceMarks.get(name)
  if (!startTime) {
    console.warn(`No start mark found for: ${name}`)
    return 0
  }
  
  const duration = performance.now() - startTime
  performanceMarks.delete(name)
  
  performance.mark(`${name}-end`)
  performance.measure(name, `${name}-start`, `${name}-end`)
  
  // Store for analysis
  if (!performanceMeasures.has(name)) {
    performanceMeasures.set(name, [])
  }
  performanceMeasures.get(name)!.push(duration)
  
  return duration
}

export function getPerformanceMetrics(): PerformanceMetrics {
  const marks: Record<string, PerformanceMark> = {}
  const measures: Record<string, number> = {}
  
  performanceMarks.forEach((startTime, name) => {
    marks[name] = { name, startTime }
  })
  
  performanceMeasures.forEach((durations, name) => {
    measures[name] = durations[durations.length - 1]
  })
  
  const metrics: PerformanceMetrics = { marks, measures }
  
  // Add memory info if available
  if ('memory' in performance) {
    const mem = (performance as any).memory
    metrics.memory = {
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit
    }
  }
  
  return metrics
}

export function clearPerformanceMetrics(): void {
  performanceMarks.clear()
  performanceMeasures.clear()
  performance.clearMarks()
  performance.clearMeasures()
}

// === FUNCTION PROFILING ===

export interface ProfileResult {
  functionName: string
  calls: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
}

const profileData = new Map<string, number[]>()

export function profileFunction<T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T {
  const functionName = name || fn.name || 'anonymous'
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now()
    const result = fn(...args)
    const duration = performance.now() - start
    
    if (!profileData.has(functionName)) {
      profileData.set(functionName, [])
    }
    profileData.get(functionName)!.push(duration)
    
    return result
  }) as T
}

export function profileAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name?: string
): T {
  const functionName = name || fn.name || 'anonymous'
  
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const start = performance.now()
    const result = await fn(...args)
    const duration = performance.now() - start
    
    if (!profileData.has(functionName)) {
      profileData.set(functionName, [])
    }
    profileData.get(functionName)!.push(duration)
    
    return result
  }) as T
}

export function getProfileResults(): ProfileResult[] {
  const results: ProfileResult[] = []
  
  profileData.forEach((times, functionName) => {
    if (times.length === 0) return
    
    const totalTime = times.reduce((sum, t) => sum + t, 0)
    const avgTime = totalTime / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    
    results.push({
      functionName,
      calls: times.length,
      totalTime,
      avgTime,
      minTime,
      maxTime
    })
  })
  
  return results.sort((a, b) => b.totalTime - a.totalTime)
}

export function clearProfileData(): void {
  profileData.clear()
}

// === RENDER PROFILING ===

export interface RenderMetrics {
  componentName: string
  renderCount: number
  totalRenderTime: number
  avgRenderTime: number
  lastRenderTime: number
}

const renderMetrics = new Map<string, number[]>()

export function trackRender(componentName: string, renderTime: number): void {
  if (!renderMetrics.has(componentName)) {
    renderMetrics.set(componentName, [])
  }
  renderMetrics.get(componentName)!.push(renderTime)
}

export function getRenderMetrics(): RenderMetrics[] {
  const results: RenderMetrics[] = []
  
  renderMetrics.forEach((times, componentName) => {
    if (times.length === 0) return
    
    const totalRenderTime = times.reduce((sum, t) => sum + t, 0)
    const avgRenderTime = totalRenderTime / times.length
    
    results.push({
      componentName,
      renderCount: times.length,
      totalRenderTime,
      avgRenderTime,
      lastRenderTime: times[times.length - 1]
    })
  })
  
  return results.sort((a, b) => b.renderCount - a.renderCount)
}

export function clearRenderMetrics(): void {
  renderMetrics.clear()
}

// === NETWORK PROFILING ===

export interface NetworkMetric {
  url: string
  method: string
  status: number
  duration: number
  size: number
  timestamp: number
}

const networkMetrics: NetworkMetric[] = []

export function trackNetworkRequest(metric: NetworkMetric): void {
  networkMetrics.push(metric)
  
  // Keep only last 100 requests
  if (networkMetrics.length > 100) {
    networkMetrics.shift()
  }
}

export function getNetworkMetrics(): NetworkMetric[] {
  return [...networkMetrics]
}

export function getNetworkStats(): {
  totalRequests: number
  totalSize: number
  avgDuration: number
  slowestRequests: NetworkMetric[]
} {
  const totalRequests = networkMetrics.length
  const totalSize = networkMetrics.reduce((sum, m) => sum + m.size, 0)
  const avgDuration = totalRequests > 0
    ? networkMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests
    : 0
  
  const slowestRequests = [...networkMetrics]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5)
  
  return { totalRequests, totalSize, avgDuration, slowestRequests }
}

export function clearNetworkMetrics(): void {
  networkMetrics.length = 0
}

// === BUNDLE SIZE ANALYSIS ===

export interface BundleInfo {
  totalSize: number
  scripts: Array<{ url: string; size: number }>
  stylesheets: Array<{ url: string; size: number }>
}

export async function analyzeBundleSize(): Promise<BundleInfo> {
  const scripts: Array<{ url: string; size: number }> = []
  const stylesheets: Array<{ url: string; size: number }> = []
  
  // Analyze scripts
  document.querySelectorAll('script[src]').forEach(script => {
    const src = (script as HTMLScriptElement).src
    if (src) {
      scripts.push({ url: src, size: 0 }) // Size would need actual fetch
    }
  })
  
  // Analyze stylesheets
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = (link as HTMLLinkElement).href
    if (href) {
      stylesheets.push({ url: href, size: 0 })
    }
  })
  
  const totalSize = scripts.reduce((sum, s) => sum + s.size, 0) +
                    stylesheets.reduce((sum, s) => sum + s.size, 0)
  
  return { totalSize, scripts, stylesheets }
}

// === MEMORY LEAK DETECTION ===

export interface MemorySnapshot {
  timestamp: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  heapSizeLimit: number
}

const memorySnapshots: MemorySnapshot[] = []

export function takeMemorySnapshot(): MemorySnapshot | null {
  if (!('memory' in performance)) {
    return null
  }
  
  const mem = (performance as any).memory
  const snapshot: MemorySnapshot = {
    timestamp: Date.now(),
    usedJSHeapSize: mem.usedJSHeapSize,
    totalJSHeapSize: mem.totalJSHeapSize,
    heapSizeLimit: mem.jsHeapSizeLimit
  }
  
  memorySnapshots.push(snapshot)
  
  // Keep only last 100 snapshots
  if (memorySnapshots.length > 100) {
    memorySnapshots.shift()
  }
  
  return snapshot
}

export function detectMemoryLeaks(): {
  isLeaking: boolean
  trend: 'increasing' | 'stable' | 'decreasing'
  growthRate: number // bytes per second
} {
  if (memorySnapshots.length < 10) {
    return { isLeaking: false, trend: 'stable', growthRate: 0 }
  }
  
  const recent = memorySnapshots.slice(-10)
  const first = recent[0]
  const last = recent[recent.length - 1]
  
  const timeDiff = (last.timestamp - first.timestamp) / 1000 // seconds
  const memDiff = last.usedJSHeapSize - first.usedJSHeapSize
  const growthRate = memDiff / timeDiff
  
  // Consider it a leak if growing > 1MB per minute
  const isLeaking = growthRate > (1024 * 1024 / 60)
  
  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
  if (growthRate > 1000) trend = 'increasing'
  else if (growthRate < -1000) trend = 'decreasing'
  
  return { isLeaking, trend, growthRate }
}

export function getMemorySnapshots(): MemorySnapshot[] {
  return [...memorySnapshots]
}

export function clearMemorySnapshots(): void {
  memorySnapshots.length = 0
}

// === FPS MONITORING ===

let fpsFrames = 0
let fpsLastTime = performance.now()
let fpsHistory: number[] = []

export function startFpsMonitoring(): void {
  function measureFps() {
    const now = performance.now()
    fpsFrames++
    
    if (now >= fpsLastTime + 1000) {
      const fps = Math.round((fpsFrames * 1000) / (now - fpsLastTime))
      fpsHistory.push(fps)
      
      // Keep only last 60 seconds
      if (fpsHistory.length > 60) {
        fpsHistory.shift()
      }
      
      fpsFrames = 0
      fpsLastTime = now
    }
    
    requestAnimationFrame(measureFps)
  }
  
  requestAnimationFrame(measureFps)
}

export function getFpsMetrics(): {
  current: number
  avg: number
  min: number
  max: number
  history: number[]
} {
  if (fpsHistory.length === 0) {
    return { current: 0, avg: 0, min: 0, max: 0, history: [] }
  }
  
  const current = fpsHistory[fpsHistory.length - 1]
  const avg = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length
  const min = Math.min(...fpsHistory)
  const max = Math.max(...fpsHistory)
  
  return { current, avg, min, max, history: [...fpsHistory] }
}

export function clearFpsHistory(): void {
  fpsHistory = []
  fpsFrames = 0
  fpsLastTime = performance.now()
}

// === LONG TASKS DETECTION ===

export interface LongTask {
  name: string
  duration: number
  startTime: number
}

const longTasks: LongTask[] = []

export function trackLongTask(name: string, duration: number, startTime: number): void {
  if (duration > 50) { // Tasks longer than 50ms
    longTasks.push({ name, duration, startTime })
    
    // Keep only last 50 long tasks
    if (longTasks.length > 50) {
      longTasks.shift()
    }
  }
}

export function getLongTasks(): LongTask[] {
  return [...longTasks]
}

export function clearLongTasks(): void {
  longTasks.length = 0
}

// === COMPREHENSIVE REPORT ===

export interface PerformanceReport {
  timestamp: string
  metrics: PerformanceMetrics
  profiles: ProfileResult[]
  renders: RenderMetrics[]
  network: ReturnType<typeof getNetworkStats>
  fps: ReturnType<typeof getFpsMetrics>
  memory: ReturnType<typeof detectMemoryLeaks>
  longTasks: LongTask[]
}

export function generatePerformanceReport(): PerformanceReport {
  return {
    timestamp: new Date().toISOString(),
    metrics: getPerformanceMetrics(),
    profiles: getProfileResults(),
    renders: getRenderMetrics(),
    network: getNetworkStats(),
    fps: getFpsMetrics(),
    memory: detectMemoryLeaks(),
    longTasks: getLongTasks()
  }
}

export function exportPerformanceReport(): string {
  const report = generatePerformanceReport()
  return JSON.stringify(report, null, 2)
}

export function clearAllPerformanceData(): void {
  clearPerformanceMetrics()
  clearProfileData()
  clearRenderMetrics()
  clearNetworkMetrics()
  clearMemorySnapshots()
  clearFpsHistory()
  clearLongTasks()
}

// === REACT PERFORMANCE HOOK ===

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = performance.now()
  
  return () => {
    const renderTime = performance.now() - renderStartTime
    trackRender(componentName, renderTime)
    
    if (renderTime > 16) { // Slower than 60fps
      trackLongTask(`${componentName} render`, renderTime, renderStartTime)
    }
  }
}

// === AUTO PERFORMANCE MONITORING ===

let autoMonitoringInterval: number | undefined

export function startAutoMonitoring(intervalMs: number = 5000): void {
  if (autoMonitoringInterval) {
    window.clearInterval(autoMonitoringInterval)
  }
  
  autoMonitoringInterval = window.setInterval(() => {
    takeMemorySnapshot()
  }, intervalMs)
  
  startFpsMonitoring()
}

export function stopAutoMonitoring(): void {
  if (autoMonitoringInterval) {
    window.clearInterval(autoMonitoringInterval)
    autoMonitoringInterval = undefined
  }
}
