export {
  listCredentials,
  verifyDraft,
  verifyCredential,
  createCredential,
  renameCredential,
  rotateSecret,
  setCredentialActive,
  deleteCredential,
} from "./service"
export { syncCatalog } from "./sync"
export type { SyncResult } from "./sync"
export { getAdapter, availableProviders } from "./providers/registry"
export type {
  ProductProvider,
  VerifyResult,
  NormalizedProduct,
  NormalizedCollection,
} from "./providers/types"
export type { ProviderCredential } from "./repository"
