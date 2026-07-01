import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="relative overflow-hidden border-b border-hairline/70">
      <div aria-hidden className="absolute inset-0 bg-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative flex items-end justify-between gap-4 px-6 md:px-8 pt-10 pb-7">
        <div className="min-w-0 animate-reveal">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight leading-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 animate-reveal" style={{ animationDelay: "80ms" }}>{actions}</div>}
      </div>
    </div>
  );
}