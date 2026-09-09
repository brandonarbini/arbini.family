import { SkeletonSection } from "@/components/ui/skeleton";

export default function LoadingNewAsk() {
  return (
    <div aria-busy>
      <SkeletonSection lines={2} />
      <SkeletonSection lines={6} />
    </div>
  );
}
