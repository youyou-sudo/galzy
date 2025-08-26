import type React from "react";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
  children?: React.ReactNode;
}

export function Footer({ className, children }: FooterProps) {
  const startYear = 2022;
  const currentYear = new Date().getFullYear();
  const years = currentYear - startYear;
  return (
    <footer
      className={cn(
        " border-t border-border px-6 py-4 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {children || (
        <div className="flex flex-col gap-2 items-center">
          <p>
            &copy;
            {years > 0 ? `${startYear}-${currentYear}` : `${startYear}`} Galzy
          </p>
          <div className="flex gap-4 justify-center">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      )}
    </footer>
  );
}
