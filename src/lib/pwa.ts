import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwa() {
  const online = ref(navigator.onLine)
  const installed = ref(window.matchMedia('(display-mode: standalone)').matches)
  const installEvent = shallowRef<InstallEvent | null>(null)
  const registrationError = ref(!('serviceWorker' in navigator) || !window.isSecureContext)
  let registration: ServiceWorkerRegistration | undefined
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registered) {
      registration = registered
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready
          .then(() => {
            offlineReady.value = true
          })
          .catch(() => {
            registrationError.value = true
          })
      }
    },
    onRegisterError() {
      registrationError.value = true
    },
  })
  const syncOnline = () => {
    online.value = navigator.onLine
  }
  const beforeInstall = (event: Event) => {
    event.preventDefault()
    installEvent.value = event as InstallEvent
  }
  const onInstalled = () => {
    installed.value = true
    installEvent.value = null
  }
  const checkUpdates = () => {
    if (navigator.onLine) void registration?.update().catch(() => {})
  }
  let interval: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('focus', checkUpdates)
    interval = setInterval(checkUpdates, 60 * 60 * 1000)
  })
  onUnmounted(() => {
    window.removeEventListener('online', syncOnline)
    window.removeEventListener('offline', syncOnline)
    window.removeEventListener('beforeinstallprompt', beforeInstall)
    window.removeEventListener('appinstalled', onInstalled)
    window.removeEventListener('focus', checkUpdates)
    clearInterval(interval)
  })
  async function install() {
    const event = installEvent.value
    if (!event) return false
    await event.prompt()
    await event.userChoice
    installEvent.value = null
    return true
  }
  return {
    online,
    installed,
    installEvent,
    offlineReady,
    needRefresh,
    registrationError,
    install,
    updateServiceWorker,
  }
}
