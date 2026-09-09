import { SkeletonSection } from "@/components/ui/skeleton";

export default function LoadingAsk() {
  return (
    <div aria-busy>
      <SkeletonSection lines={2} />
      <SkeletonSection lines={6} />
      <SkeletonSection lines={4} />
    </div>
  );
}
