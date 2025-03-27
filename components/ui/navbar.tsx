import * as React from "react";
import { cn } from "@/lib/utils";

const Navbar = (
  {
    ref,
    className,
    ...props
  }: React.HTMLAttributes<HTMLElement> & {
    ref: React.RefObject<HTMLElement>;
  }
) => (<nav
  className={cn("flex items-center justify-between py-4", className)}
  {...props}
  ref={ref}
/>);
Navbar.displayName = "Navbar";

const NavbarLeft = (
  {
    ref,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => (<nav
  className={cn("flex items-center gap-4 justify-start", className)}
  {...props}
  ref={ref}
/>);
NavbarLeft.displayName = "NavbarLeft";

const NavbarRight = (
  {
    ref,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => (<nav
  className={cn("flex items-center gap-4 justify-end", className)}
  {...props}
  ref={ref}
/>);
NavbarRight.displayName = "NavbarRight";

const NavbarCenter = (
  {
    ref,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => (<nav
  className={cn("flex items-center gap-4 justify-center", className)}
  {...props}
  ref={ref}
/>);
NavbarCenter.displayName = "NavbarCenter";

export { Navbar, NavbarLeft, NavbarRight, NavbarCenter };
