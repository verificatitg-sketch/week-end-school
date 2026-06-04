'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Language, t as translate } from '@/lib/i18n/translations';

export function useTranslation() {
  const language = useAppStore((s) => s.language);

  const t = useMemo(() => {
    return (key: string): string => {
      return translate(language, key);
    };
  }, [language]);

  return { t, language };
}
