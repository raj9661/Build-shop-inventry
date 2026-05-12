import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Mask email for display (shows last 3 characters before @ and full domain)
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) return email; // If local part is 3 or fewer chars, show full
  
  const maskedLocalPart = '*'.repeat(localPart.length - 3) + localPart.slice(-3);
  return `${maskedLocalPart}@${domain}`;
}
