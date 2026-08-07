/**
 * Koil platform dispatch — normative module name (Architecture Governance §6).
 * Re-exports the historical Kowil prepare→deep-link helper.
 */
export {
  dispatchAfterOwnerApproval,
  type PreparedMessages,
} from '@/src/utils/kowil-platform-dispatch';
