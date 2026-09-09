import { SkeletonSection } from "@/components/ui/skeleton";

export default function LoadingBoard() {
  return (
    <div aria-busy>
      <SkeletonSection lines={2} />
      <SkeletonSection lines={5} />
      <SkeletonSection lines={3} />
    </div>
  );
}
