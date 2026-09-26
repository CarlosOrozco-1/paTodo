import { Link } from 'react-router';
import { cn } from '@/utils/cn';

interface LogoProps {
  className?: string;
  imgClassName?: string;
  variant?: 'default' | 'alternative'; // Permite elegir entre /log.png y /logos1.jpg
  showBoth?: boolean; // Permite mostrar ambas imágenes juntas si se requiere
}

export function Logo({ className, imgClassName, variant = 'default', showBoth = false }: LogoProps) {
  // Rutas de tus imágenes en la carpeta public/
  const primarySrc = '/log.png';
  const secondarySrc = '/logos1.png'; 

  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 group', className)}>
      {showBoth ? (
        <>
          <img
            src={primarySrc}
            alt="PaTodo Logo Principal"
            className={cn('h-10 w-auto object-contain transition-transform group-hover:scale-105', imgClassName)}
          />
          <img
            src={secondarySrc}
            alt="PaTodo Logo Secundario"
            className={cn('h-10 w-auto object-contain transition-transform group-hover:scale-105', imgClassName)}
          />
        </>
      ) : (
        <img
          src={variant === 'alternative' ? secondarySrc : primarySrc}
          alt="PaTodo Logo"
          className={cn('h-10 w-auto object-contain transition-transform group-hover:scale-105', imgClassName)}
        />
      )}
    </Link>
  );
}