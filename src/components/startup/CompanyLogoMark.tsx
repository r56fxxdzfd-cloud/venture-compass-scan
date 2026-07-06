import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const COMPANY_LOGO_BUCKET = 'startup-logos';

type CompanyLogoMarkProps = {
  name: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

export function CompanyLogoMark({ name, logoUrl, className, imageClassName }: CompanyLogoMarkProps) {
  const [failed, setFailed] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');
  const [signedRetryAttempted, setSignedRetryAttempted] = useState(false);
  const shouldShowLogo = !!displayUrl && !failed;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSignedRetryAttempted(false);

    const loadLogoUrl = async () => {
      if (!logoUrl) {
        setDisplayUrl('');
        return;
      }

      const storagePath = getStartupLogoStoragePath(logoUrl);
      if (storagePath && !isHttpUrl(logoUrl)) {
        const signedUrl = await createSignedLogoUrl(storagePath);
        if (!cancelled) setDisplayUrl(signedUrl || logoUrl);
        return;
      }

      setDisplayUrl(logoUrl);
    };

    loadLogoUrl();

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const retryWithSignedUrl = async () => {
    if (signedRetryAttempted) {
      setFailed(true);
      return;
    }

    const storagePath = getStartupLogoStoragePath(logoUrl || displayUrl);
    if (!storagePath) {
      setFailed(true);
      return;
    }

    setSignedRetryAttempted(true);
    const signedUrl = await createSignedLogoUrl(storagePath);
    if (signedUrl) {
      setDisplayUrl(signedUrl);
      return;
    }

    setFailed(true);
  };

  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary', className)}>
      {shouldShowLogo ? (
        <img
          src={displayUrl}
          alt={`Logo ${name}`}
          className={cn('h-full w-full object-contain p-1.5', imageClassName)}
          loading="lazy"
          onError={retryWithSignedUrl}
        />
      ) : (
        <Building2 className="h-5 w-5" />
      )}
    </div>
  );
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function getStartupLogoStoragePath(value?: string | null) {
  if (!value) return null;
  if (!isHttpUrl(value)) {
    return value.replace(/^\/+/, '').replace(new RegExp(`^${COMPANY_LOGO_BUCKET}/`), '');
  }

  try {
    const url = new URL(value);
    const decodedPath = decodeURIComponent(url.pathname);
    const publicMarker = `/object/public/${COMPANY_LOGO_BUCKET}/`;
    const signMarker = `/object/sign/${COMPANY_LOGO_BUCKET}/`;
    const marker = decodedPath.includes(publicMarker) ? publicMarker : decodedPath.includes(signMarker) ? signMarker : '';
    if (!marker) return null;
    return decodedPath.split(marker)[1] || null;
  } catch {
    return null;
  }
}

async function createSignedLogoUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
