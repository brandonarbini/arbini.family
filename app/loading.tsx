/**
 * Root fallback. Every page here reads the session, which is request data, so under Cache
 * Components each needs a Suspense boundary above it or the build fails with the blocking-route
 * error. Deliberately near-empty: the landing page is one line of text, and a skeleton of it
 * would flash more than it reassured.
 */
export default function Loading() {
  return null;
}
