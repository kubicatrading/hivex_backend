import React from "react";
import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  className?: string;
  href?: string;
}

export function Logo({ className = "", href }: LogoProps) {
  const logoContent = (
    <Image
      src="/logo_transparent.png"
      alt="HIVEX Logo"
      width={120}
      height={62}
      priority
      className="nav-logo-img"
    />
  );

  if (href) {
    return (
      <Link href={href} className={`nav-logo ${className}`}>
        {logoContent}
      </Link>
    );
  }

  return (
    <div className={`nav-logo ${className}`}>
      {logoContent}
    </div>
  );
}
