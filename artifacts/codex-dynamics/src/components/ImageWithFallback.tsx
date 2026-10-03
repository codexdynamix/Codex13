import { useState, useEffect, type CSSProperties } from "react";

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className,
  style,
  fallback = "/hero/web-apps.jpg",
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        if (!hasError) {
          setHasError(true);
          setImgSrc(fallback);
        }
      }}
      loading="lazy"
      decoding="async"
    />
  );
}
