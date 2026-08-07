/**
 * Koil local brain — normative module name (Architecture Governance §6).
 * Implementation currently lives in the historical `kowil-local-brain` alias.
 */
export {
  answerKowilLocal as answerKoilLocal,
  type KowilLocalReply as KoilLocalReply,
} from '@/src/utils/kowil-local-brain';

/** Historical alias — prefer KoilLocalReply / answerKoilLocal in new code. */
export {
  answerKowilLocal,
  type KowilLocalReply,
} from '@/src/utils/kowil-local-brain';
