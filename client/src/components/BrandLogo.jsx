import { useTheme } from '../shared/ThemeContext.jsx';

export default function BrandLogo({
  size = 48,
  className = '',
  showText = false,
  text = 'CamCards',
  alt = 'App logo',
  rounded = false,
}) {
  const { isDark } = useTheme();
  const px = typeof size === 'number' ? `${size}px` : size;

  // Use theme-appropriate logos
  const logoSrc = isDark ? '/black_bg.png' : '/white_bg.png';

  return (
    <div className={`flex items-center ${className}`.trim()}>
      <img
        src={logoSrc}
        alt={alt}
        className={`${rounded ? 'rounded-full' : ''} object-contain`.trim()}
        style={{ maxWidth: px, maxHeight: px }}
      />
      {showText && (
        <span className="ml-2 font-bold text-green-800 dark:text-green-400 text-base">{text}</span>
      )}
    </div>
  );
}
