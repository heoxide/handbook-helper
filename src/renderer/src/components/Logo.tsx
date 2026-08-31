import logoSrc from '../assets/handbook-helper-logo.png'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src={logoSrc}
      alt="Handbook Helper"
      className={className ? `app-logo ${className}` : 'app-logo'}
      draggable={false}
    />
  )
}
