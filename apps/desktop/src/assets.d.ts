/** Rohdateien als Text bzw. Daten-URL (Vite: `?raw`, `?inline`) — T-M46-13/14. */
declare module '*.svg?raw' {
  const content: string
  export default content
}
declare module '*.ogg?inline' {
  const url: string
  export default url
}
