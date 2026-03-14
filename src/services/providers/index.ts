/**
 * Provider adapter registry.
 * To add a new provider: implement IJobProvider, then add to getProvider() below.
 */

import type { IJobProvider } from "./types";
import type { ProviderName } from "./types";
import { greenhouseProvider } from "./greenhouseProvider";
import { leverProvider } from "./leverProvider";
import { workableProvider } from "./workableProvider";
import { linkedinProvider } from "./linkedinProvider";

const providers: Record<ProviderName, IJobProvider> = {
  greenhouse: greenhouseProvider,
  lever: leverProvider,
  workable: workableProvider,
  linkedin: linkedinProvider,
  custom: null as unknown as IJobProvider
};

export function getProvider(name: ProviderName): IJobProvider | null {
  if (name === "custom") return null;
  return providers[name] ?? null;
}

export { greenhouseProvider, leverProvider, workableProvider, linkedinProvider };
export type { BoardConfig, IJobProvider, RawJob, ProviderName } from "./types";
