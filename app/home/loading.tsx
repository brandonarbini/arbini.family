export default function LoadingBoard() {
  return (
    <div className="animate-pulse space-y-6" aria-busy>
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-56 rounded-xl bg-muted" />
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );
}
