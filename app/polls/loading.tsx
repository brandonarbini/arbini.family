export default function LoadingPolls() {
  return (
    <div className="animate-pulse space-y-6" aria-busy>
      <div className="h-16 rounded-xl bg-muted" />
      <div className="h-48 rounded-xl bg-muted" />
    </div>
  );
}
