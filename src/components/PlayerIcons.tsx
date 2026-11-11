import type { ReactNode } from "react";

function Icon({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" aria-hidden="true" focusable="false">{children}</svg>;
}

export function PlayIcon({ className, filled = true }: { className?: string | undefined; filled?: boolean } = {}) {
  return <Icon className={className}><path d="M7 4 20 12 7 20Z" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} /></Icon>;
}
export function PauseIcon() {
  return <Icon><path d="M6 3h4v18H6ZM14 3h4v18h-4Z" fill="currentColor" stroke="none" /></Icon>;
}
const speaker = "M3 9h4l6-5v16l-6-5H3Z";
export function VolumeIcon() {
  return <Icon><path d={speaker} /><path d="m16 8 3 4-3 4m3-11 4 7-4 7" /></Icon>;
}
export function MuteIcon() {
  return <Icon><path d={speaker} /><path d="M3 3 21 21" /></Icon>;
}
export function GridIcon() {
  return <Icon><path d="M4 4h5v5H4ZM15 4h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5Z" /></Icon>;
}
export function FullscreenIcon({ exit = false }: { exit?: boolean }) {
  return <Icon><path d={exit ? "M3 9h6V3m6 0v6h6m0 6h-6v6m-6 0v-6H3" : "M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"} /></Icon>;
}
export function CloseIcon() {
  return <Icon><path d="M5 5 19 19M19 5 5 19" /></Icon>;
}
export function CheckIcon() {
  return <Icon><path d="m5 12 5 5L20 7" /></Icon>;
}
export function SaveIcon() {
  return <Icon><path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5" /></Icon>;
}
export function ReplayIcon({ className, filled = false }: { className?: string | undefined; filled?: boolean } = {}) {
  return <Icon className={className}>{filled
    ? <path d="M4 7 11 2v4h10v15H3V12h3v6h12V9h-7v3Z" fill="currentColor" stroke="none" />
    : <path d="M7 7h13v13H4V7m7-4L7 7l4 4" />}</Icon>;
}