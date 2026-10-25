import { describe, expect, it } from 'vitest'
import { getConnectivityStatus } from '../src/lib/connectivity'

describe('网络与离线缓存状态', () => {
  it('缓存完成时同时说明在线和可离线使用', () => {
    expect(
      getConnectivityStatus({
        online: true,
        isDev: false,
        registrationError: false,
        offlineReady: true,
      }),
    ).toEqual({
      badge: '在线 · 可离线',
      network: '在线',
      cache: '已缓存，可离线打开',
    })
  })

  it('断网时显示真实离线状态和缓存可用性', () => {
    expect(
      getConnectivityStatus({
        online: false,
        isDev: false,
        registrationError: false,
        offlineReady: true,
      }),
    ).toEqual({
      badge: '当前离线',
      network: '离线',
      cache: '正在使用已缓存内容',
    })
  })

  it('注册失败时说明只能在线阅读', () => {
    expect(
      getConnectivityStatus({
        online: true,
        isDev: false,
        registrationError: true,
        offlineReady: false,
      }),
    ).toEqual({
      badge: '在线 · 仅在线',
      network: '在线',
      cache: '当前浏览器未启用离线缓存',
    })
  })
})
