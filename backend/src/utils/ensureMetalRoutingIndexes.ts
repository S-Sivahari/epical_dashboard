import { MetalRoutingAnalysisModel } from '../models/MetalRoutingAnalysis';

/**
 * Drop legacy global route identity indexes that omitted projectId.
 * Those indexes block the same cell/signal pair across different projects.
 */
export async function ensureMetalRoutingIndexes(): Promise<void> {
  const collection = MetalRoutingAnalysisModel.collection;
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    const key = idx.key ?? {};
    const keyNames = Object.keys(key);
    const hasProjectId = key.projectId === 1;
    const isLegacyRouteIdentity =
      key.fromCell === 1
      && key.toCell === 1
      && key.fromSignal === 1
      && key.toSignal === 1
      && !hasProjectId;

    if (isLegacyRouteIdentity && idx.unique && idx.name) {
      await collection.dropIndex(idx.name);
      console.log(`✓ Dropped legacy metal routing index "${idx.name}" (project-scoped routes enabled)`);
    }
  }

  await MetalRoutingAnalysisModel.syncIndexes();
}
