export interface ConnectivityOptions {
  online: boolean
  isDev: boolean
  registrationError: boolean
  offlineReady: boolean
}

export interface ConnectivityStatus {
  badge: string
  network: string
  cache: string
}

export function getConnectivityStatus({
  online,
  isDev,
  registrationError,
  offlineReady,
}: ConnectivityOptions): ConnectivityStatus {
  if (!online) {
    return {
      badge: '当前离线',
      network: '离线',
      cache: offlineReady ? '正在使用已缓存内容' : '仅已打开的内容可用',
    }
  }

  if (isDev) {
    return {
      badge: '本地预览',
      network: '在线',
      cache: '本地预览不启用离线缓存',
    }
  }

  if (registrationError) {
    return {
      badge: '在线 · 仅在线',
      network: '在线',
      cache: '当前浏览器未启用离线缓存',
    }
  }

  if (offlineReady) {
    return {
      badge: '在线 · 可离线',
      network: '在线',
      cache: '已缓存，可离线打开',
    }
  }

  return {
    badge: '在线 · 正在缓存',
    network: '在线',
    cache: '正在缓存必要内容',
  }
}
