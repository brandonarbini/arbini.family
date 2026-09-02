export default function LoadingSignIn() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm animate-pulse space-y-4" aria-busy>
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-9 rounded-md bg-muted" />
        <div className="h-9 rounded-md bg-muted" />
      </div>
    </main>
  );
}
