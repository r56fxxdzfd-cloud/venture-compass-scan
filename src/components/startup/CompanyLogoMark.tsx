import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type CompanyLogoMarkProps = {
  name: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

export function CompanyLogoMark({ name, logoUrl, className, imageClassName }: CompanyLogoMarkProps) {
  const [failed, setFailed] = useState(false);
  const shouldShowLogo = !!logoUrl && !failed;

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary', className)}>
      {shouldShowLogo ? (
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          className={cn('h-full w-full object-contain p-1.5', imageClassName)}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2 className="h-5 w-5" />
      )}
    </div>
  );
}
