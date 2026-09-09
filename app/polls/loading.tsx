import { SkeletonSection } from "@/components/ui/skeleton";

export default function LoadingAsks() {
  return (
    <div aria-busy>
      <SkeletonSection lines={3} />
      <SkeletonSection lines={2} />
    </div>
  );
}
