"use client"

import { useAuthRedirect } from "@/lib/hooks/useAuthRedirect";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthRedirect(true)

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>

      <div className="max-lg:hidden flex-1 h-full flex items-center justify-center bg-muted/80">
        <figure className="max-w-md p-8">
          <blockquote className="relative">
            <div className="font-serif text-2xl text-muted-foreground italic leading-relaxed">
              “The future is not something we enter. The future is something we create.”
            </div>
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted-foreground/80 font-medium">
            — Leonard Sweet
          </figcaption>
        </figure>
      </div>
    </div>
  )
}