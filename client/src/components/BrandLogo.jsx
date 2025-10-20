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
  const logoSrc = '/logo.svg';

  return (
    <div className={`flex items-center ${className}`.trim()}>
      <div
        className={`object-contain`.trim()}
        style={{
          maxWidth: px,
          maxHeight: px,
          backgroundImage: isDark ? 'url(/black_bg.png)' : 'url(/white_bg.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          width: px,
          height: px,
        }}
      />
      {showText && (
        <span className="ml-2 font-bold text-green-800 dark:text-green-400 text-base">{text}</span>
      )}
    </div>
  );
}
