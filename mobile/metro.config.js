// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Teaches Metro to import `.svg` files as React components, via
 * `react-native-svg-transformer`. There is exactly one consumer today — the masthead wordmark in
 * `src/components/wordmark.tsx` — but it has to be a real vector: the wordmark is the one piece of
 * the identity that cannot be re-derived from tokens, and a PNG of it would go soft on every
 * display it was not exported for.
 *
 * The two edits below are a pair. `assetExts` must lose `svg` at the same moment `sourceExts`
 * gains it, or Metro keeps treating the file as a binary asset and the import resolves to a URI
 * instead of a component.
 */
module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
  };

  return config;
})();
