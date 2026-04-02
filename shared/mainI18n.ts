import type { Language } from './config.types'

interface NotificationStrings {
  title: string
  body: (triggerDisplay: string) => string
}

const notificationStrings: Record<Language, NotificationStrings> = {
  en: {
    title: 'Running in System Tray',
    body: (trigger) => `Press [${trigger}] to open Action Ring.`,
  },
  ko: {
    title: '시스템 트레이에서 실행 중',
    body: (trigger) => `[${trigger}] 를 눌러 액션 링을 열 수 있습니다.`,
  },
}

export function getNotificationStrings(lang: Language | undefined): NotificationStrings {
  return notificationStrings[lang ?? 'en'] ?? notificationStrings.en
}
