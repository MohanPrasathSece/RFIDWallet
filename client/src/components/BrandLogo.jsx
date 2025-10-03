export default function BrandLogo({
  size = 48,
  className = '',
  showText = false,
  text = 'RFID Wallet',
  src = '/logo.svg',
  alt = 'App logo',
}) {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <div className={`flex items-center ${className}`.trim()}>
      <img src={src} alt={alt} style={{ width: px, height: px }} />
      {showText && (
        <span className="ml-2 font-bold text-green-800 text-base">{text}</span>
      )}
    </div>
  );
}
