export default function BrandLogo({
  size = 48,
  className = '',
  showText = false,
  text = 'CamCards',
  src = '/logo.png',
  alt = 'App logo',
  rounded = true,
}) {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <div className={`flex items-center ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className={`${rounded ? 'rounded-full' : ''} object-cover`.trim()}
        style={{ width: px, height: px }}
      />
      {showText && (
        <span className="ml-2 font-bold text-green-800 text-base">{text}</span>
      )}
    </div>
  );
}
