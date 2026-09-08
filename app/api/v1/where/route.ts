import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { toWhereDto } from "@/lib/api/v1/serialize";
import { getEditorData } from "@/lib/board/editor";
import { todayInFamilyTz } from "@/lib/dates";

/**
 * The stay editor's data: the places to choose from, and the stays this person may change.
 *
 * Which stays those are is decided by `getEditorData` from the actor's role — a parent maintains
 * everyone's travel, so showing them only their own would hide the rows they most often fix.
 */
export async function GET(): Promise<Response> {
  const result = await requireProfileActor();
  if (!result.ok) return result.response;

  try {
    const data = await getEditorData(result.actor);
    return jsonOk(toWhereDto(todayInFamilyTz(), data));
  } catch (error) {
    console.error("[api/v1/where] failed to load the editor", error);
    return apiError("internal", "Your stays could not be loaded.");
  }
}
