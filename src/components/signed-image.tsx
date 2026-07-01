import { useSignedUrl } from "@/lib/signed-url";
import { AvatarImage } from "@/components/ui/avatar";

interface SignedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path: string | null | undefined;
}

/** <img> that resolves a private storage path to a short-lived signed URL. */
export function SignedImage({ bucket, path, ...rest }: SignedImgProps) {
  const url = useSignedUrl(bucket, path);
  if (!url) return null;
  return <img src={url} {...rest} />;
}

interface SignedAvatarProps extends React.ComponentProps<typeof AvatarImage> {
  bucket: string;
  path: string | null | undefined;
}

/** shadcn <AvatarImage> wrapper that re-signs each render. */
export function SignedAvatarImage({ bucket, path, ...rest }: SignedAvatarProps) {
  const url = useSignedUrl(bucket, path);
  return <AvatarImage {...rest} src={url ?? undefined} />;
}

interface SignedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  bucket: string;
  path: string | null | undefined;
}

/** <a> that resolves + refreshes the signed URL for downloads/attachments. */
export function SignedLink({ bucket, path, children, ...rest }: SignedLinkProps) {
  const url = useSignedUrl(bucket, path);
  if (!url) return null;
  return <a {...rest} href={url}>{children}</a>;
}