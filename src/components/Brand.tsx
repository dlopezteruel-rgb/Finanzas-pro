import React from 'react';
import { useI18n } from '../i18n';
import { paths } from '../app/paths';
export function Brand({ description = false }: { description?: boolean }) {
  const { t } = useI18n();
  return <span className="brand" aria-label="FinanZas">
    <img src={paths.logo} width="40" height="40" alt="" />
    <span className="brand-wordmark">FinanZas{description && <span className="brand-description">{t('brand.description')}</span>}</span>
  </span>;
}
