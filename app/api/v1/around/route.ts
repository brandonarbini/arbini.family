import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { toAroundDto } from "@/lib/api/v1/serialize";
import { getStripData } from "@/lib/board/editor";
import { todayInFamilyTz } from "@/lib/dates";

/**
 * The Around screen's data: whose strips this person may paint, and what is already on them.
 *
 * Which strips those are is decided by `getStripData` from the actor's role — a parent maintains
 * everyone's travel, so showing them only their own would hide the rows they most often fix.
 */
export async function GET(): Promise<Response> {
  const result = await requireProfileActor();
  if (!result.ok) return result.response;

  try {
    const data = await getStripData(result.actor, todayInFamilyTz());
    return jsonOk(toAroundDto(data, result.actor.profileId));
  } catch (error) {
    console.error("[api/v1/around] failed to load the strips", error);
    return apiError("internal", "Your calendar could not be loaded.");
  }
}
