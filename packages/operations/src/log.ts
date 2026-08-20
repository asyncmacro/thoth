/**
 * Append-only operation log.
 *
 * A log is an ordered list of operations whose revisions chain
 * contiguously from zero. The log is immutable; appending produces a new
 * log and never mutates the input.
 */

import type { Operation } from '@thoth/protocol';
import { logSchema } from '@thoth/validation';
import { ValidationError } from '@thoth/validation';

export interface OperationLog {
  operations: Operation[];
}

export type AppendResult =
  { ok: true; log: OperationLog } | { ok: false; error: 'REVISION_MISMATCH' };

export function createOperationLog(): OperationLog {
  return { operations: [] };
}

/**
 * Appends an operation to the log. The operation's revision must equal
 * the number of operations already in the log so revisions stay
 * contiguous.
 */
export function appendOperation(
  log: OperationLog,
  op: Operation
): AppendResult {
  const expectedRevision = log.operations.length;
  if (op.revision !== expectedRevision) {
    return { ok: false, error: 'REVISION_MISMATCH' };
  }
  return { ok: true, log: { operations: [...log.operations, op] } };
}

export function serializeLog(log: OperationLog): string {
  return JSON.stringify(log);
}

/**
 * Parses a persisted log.
 *
 * Throws a `SyntaxError` for malformed JSON and a `ValidationError` for
 * JSON that does not match LogSchema.
 */
export function deserializeLog(raw: string): OperationLog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SyntaxError('malformed operation log JSON', { cause: error });
  }
  const result = logSchema(parsed);
  if (!result.ok) {
    throw new ValidationError(result.issues);
  }
  // logSchema is structurally identical to OperationLog.
  return result.value;
}
