/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.json' {
  const value: unknown
  export default value
}

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.md?raw' {
  const content: string
  export default content
}
