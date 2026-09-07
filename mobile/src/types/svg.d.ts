/**
 * Declares the shape Metro's SVG transformer produces, so `import Wordmark from './x.svg'` is a
 * component to TypeScript as well as to the bundler. Without this, tsc sees an untyped module.
 */
declare module '*.svg' {
  import type * as React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
