import { User } from "../../database/src/models/User";
import type { AccountPreferences } from "../../frontend/src/types/preferences";
import { HttpError } from "./middleware/errors";

function preferencesFor(user: { preferences?: Partial<AccountPreferences> } | null): AccountPreferences {
  if (!user) throw new HttpError(404, "Account not found.");
  return {
    makersAndCollections: user.preferences?.makersAndCollections ?? true,
    studioStories: user.preferences?.studioStories ?? true,
  };
}

export async function getPreferences(userId: string): Promise<AccountPreferences> {
  return preferencesFor(await User.findOne({ id: userId }).select("+preferences").lean<{ preferences?: Partial<AccountPreferences> } | null>());
}

export async function savePreferences(userId: string, preferences: AccountPreferences): Promise<AccountPreferences> {
  return preferencesFor(await User.findOneAndUpdate(
    { id: userId },
    { $set: { preferences } },
    { returnDocument: "after", runValidators: true },
  ).select("+preferences").lean<{ preferences?: Partial<AccountPreferences> } | null>());
}