export default function LoadingAccount() {
  return (
    <div className="animate-pulse space-y-6" aria-busy>
      <div className="h-12 w-48 rounded bg-muted" />
      <div className="h-56 rounded-xl bg-muted" />
    </div>
  );
}
