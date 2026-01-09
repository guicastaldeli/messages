declare module '*.wgsl' {
  const content: string;
  export default content;
}

declare module '@/app/main/renderer/.shaders/*' {
    const content: string;
    export default content;
}