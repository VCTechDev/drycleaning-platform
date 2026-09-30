import { useState } from "react";
import { ImageOff } from "lucide-react";

interface GarmentImageProps {
    src?: string | null;
    alt: string;
    className: string;
}

function GarmentImage({ src, alt, className }: GarmentImageProps) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const failed = Boolean(src) && failedSource === src;

    if (!src || failed) {
        return (
            <div
                className={`${className} flex items-center justify-center text-[#8A96AF]`}
                role="img"
                aria-label={`${alt} image unavailable`}
            >
                <ImageOff className="h-5 w-5" aria-hidden="true" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt || "Garment"}
            className={className}
            onError={() => setFailedSource(src ?? null)}
        />
    );
}

export default GarmentImage;
