import type { Language } from './config.types'

interface NotificationStrings {
  title: string
  body: (triggerDisplay: string) => string
}

const notificationStrings: Record<Language, NotificationStrings> = {
  en: {
    title: 'Action Ring',
    body: (trigger) => `Running in the system tray. Press [${trigger}] to open the Action Ring.`,
  },
  ko: {
    title: 'Action Ring',
    body: (trigger) => `시스템 트레이에서 실행 중입니다. [${trigger}] 를 눌러 액션 링을 열 수 있습니다.`,
  },
}

export function getNotificationStrings(lang: Language | undefined): NotificationStrings {
  return notificationStrings[lang ?? 'en'] ?? notificationStrings.en
}
