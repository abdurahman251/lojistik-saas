interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  alt?: string;
}

export default function Logo({
  variant = 'full',
  size = 'lg',
  className = '',
  alt = 'Lojistik OS • Liman & Saha Otomasyonu',
}: LogoProps) {
  // Monogram İkon Boyutları
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    custom: '',
  };

  // Tam Logo Boyutları (Responsive & Okunaklı)
  const fullSizes = {
    sm: 'max-w-[240px]',
    md: 'max-w-[300px]',
    lg: 'max-w-[380px]',
    xl: 'max-w-[460px]',
    custom: '',
  };

  if (variant === 'icon') {
    const sizeClass = iconSizes[size] || 'w-12 h-12';
    return (
      <img
        src="/lojistik-os-icon.png"
        alt="LOS"
        className={`object-contain shrink-0 select-none ${sizeClass} ${className}`}
        loading="eager"
      />
    );
  }

  const widthClass = fullSizes[size] || 'max-w-[380px]';

  return (
    <div className={`relative inline-flex items-center justify-center w-full ${widthClass} ${className}`}>
      <img
        src="/lojistik-os-logo.png"
        alt={alt}
        className="w-full h-auto object-contain select-none filter drop-shadow-xs transition-transform duration-300 hover:scale-[1.02]"
        loading="eager"
      />
    </div>
  );
}
