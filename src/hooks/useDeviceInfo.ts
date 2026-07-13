// Enhanced responsive utilities for iPhone, iPad, and web
import { useEffect, useState } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface DeviceInfo {
  type: DeviceType
  orientation: Orientation
  isIOS: boolean
  isIPad: boolean
  isIPhone: boolean
  hasNotch: boolean
  screenWidth: number
  screenHeight: number
}

export function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo())

  useEffect(() => {
    const handleResize = () => setDeviceInfo(getDeviceInfo())
    const handleOrientationChange = () => setDeviceInfo(getDeviceInfo())

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return deviceInfo
}

function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth
  const height = window.innerHeight
  const ua = navigator.userAgent
  
  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  // Detect specific devices
  const isIPad = isIOS && (
    /iPad/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
  const isIPhone = isIOS && /iPhone/.test(ua)
  
  // Detect notch (iPhone X and newer)
  const hasNotch = isIPhone && (
    height >= 812 || width >= 812 // iPhone X/XS/11 Pro and larger
  )
  
  // Determine device type
  let type: DeviceType = 'mobile'
  if (width >= 1024) {
    type = 'desktop'
  } else if (width >= 768 || isIPad) {
    type = 'tablet'
  }
  
  // Determine orientation
  const orientation: Orientation = height > width ? 'portrait' : 'landscape'
  
  return {
    type,
    orientation,
    isIOS,
    isIPad,
    isIPhone,
    hasNotch,
    screenWidth: width,
    screenHeight: height,
  }
}

// Responsive value hook
export function useResponsiveValue<T>(values: {
  mobile?: T
  tablet?: T
  desktop?: T
  default: T
}): T {
  const { type } = useDeviceInfo()
  
  switch (type) {
    case 'mobile':
      return values.mobile ?? values.default
    case 'tablet':
      return values.tablet ?? values.mobile ?? values.default
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile ?? values.default
  }
}

// Touch-optimized sizes
export const TOUCH_SIZES = {
  minTouchTarget: 44, // iOS minimum
  buttonHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  inputHeight: {
    sm: 40,
    md: 48,
    lg: 56,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const

// Breakpoints matching Tailwind
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

// Check if device supports hover
export function supportsHover(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

// Check if device prefers reduced motion
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Safe area insets (for notch, home indicator)
export function getSafeAreaInsets() {
  const root = document.documentElement
  return {
    top: parseInt(getComputedStyle(root).getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(getComputedStyle(root).getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(getComputedStyle(root).getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(getComputedStyle(root).getPropertyValue('env(safe-area-inset-left)') || '0'),
  }
}
