/**
 * Dependency-free runtime validation helpers.
 *
 * Validators are pure functions from unknown input to a discriminated
 * ValidationResult. They never throw and never mutate their input, so
 * they are safe to share between the server and the Obsidian plugin.
 */

import type { ValidationIssue } from '@thoth/protocol';

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export type Validator<T> = (value: unknown) => ValidationResult<T>;

function failure<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function issueAt(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prefixIssues(
  issues: ValidationIssue[],
  prefix: string
): ValidationIssue[] {
  return issues.map((issue) => ({
    // Array paths are introduced with "[" so they join without a dot,
    // e.g. prefix "operations" + path "[0].type" -> "operations[0].type".
    path:
      issue.path.length === 0
        ? prefix
        : issue.path.startsWith('[')
          ? `${prefix}${issue.path}`
          : `${prefix}.${issue.path}`,
    message: issue.message,
  }));
}

export interface StringOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

export function string(options: StringOptions = {}): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return failure([issueAt('', 'expected a string')]);
    }
    if (options.minLength !== undefined && value.length < options.minLength) {
      return failure([
        issueAt('', `must be at least ${options.minLength} characters`),
      ]);
    }
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      return failure([
        issueAt('', `must be at most ${options.maxLength} characters`),
      ]);
    }
    if (options.pattern !== undefined && !options.pattern.test(value)) {
      return failure([issueAt('', 'does not match the required pattern')]);
    }
    return success(value);
  };
}

export interface NumberOptions {
  min?: number;
  max?: number;
}

export function number(options: NumberOptions = {}): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return failure([issueAt('', 'expected a finite number')]);
    }
    if (options.min !== undefined && value < options.min) {
      return failure([issueAt('', `must be >= ${options.min}`)]);
    }
    if (options.max !== undefined && value > options.max) {
      return failure([issueAt('', `must be <= ${options.max}`)]);
    }
    return success(value);
  };
}

export function integer(options: NumberOptions = {}): Validator<number> {
  return (value: unknown) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value)
    ) {
      return failure([issueAt('', 'expected an integer')]);
    }
    if (options.min !== undefined && value < options.min) {
      return failure([issueAt('', `must be >= ${options.min}`)]);
    }
    if (options.max !== undefined && value > options.max) {
      return failure([issueAt('', `must be <= ${options.max}`)]);
    }
    return success(value);
  };
}

export function boolean(): Validator<boolean> {
  return (value: unknown) => {
    if (typeof value !== 'boolean') {
      return failure([issueAt('', 'expected a boolean')]);
    }
    return success(value);
  };
}

/** Accepts one of the given string literals. */
export function oneOf<const T extends readonly string[]>(
  ...allowed: T
): Validator<T[number]> {
  return (value: unknown) => {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      return failure([issueAt('', `expected one of: ${allowed.join(', ')}`)]);
    }
    return success(value as T[number]);
  };
}

/** Accepts `undefined` or a value passing the inner validator. */
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value: unknown) => {
    if (value === undefined) {
      return success(undefined);
    }
    return validator(value);
  };
}

export function array<T>(item: Validator<T>): Validator<T[]> {
  return (value: unknown) => {
    if (!Array.isArray(value)) {
      return failure([issueAt('', 'expected an array')]);
    }
    const issues: ValidationIssue[] = [];
    const out: T[] = [];
    value.forEach((entry, index) => {
      const result = item(entry);
      if (result.ok) {
        out.push(result.value);
      } else {
        issues.push(...prefixIssues(result.issues, `[${index}]`));
      }
    });
    return issues.length > 0 ? failure(issues) : success(out);
  };
}

/**
 * Validates a plain object against a shape.
 *
 * Unknown keys are rejected so the server fails safely on unexpected
 * input instead of silently ignoring it.
 */
export function object<T extends Record<string, unknown>>(shape: {
  [K in keyof T]: Validator<T[K]>;
}): Validator<T> {
  return (value: unknown) => {
    if (!isRecord(value)) {
      return failure([issueAt('', 'expected an object')]);
    }
    const issues: ValidationIssue[] = [];
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const result = shape[key as keyof typeof shape](value[key]);
      if (result.ok) {
        out[key] = result.value;
      } else {
        issues.push(...prefixIssues(result.issues, key));
      }
    }
    for (const key of Object.keys(value)) {
      if (!(key in shape)) {
        issues.push(issueAt(key, 'unexpected key'));
      }
    }
    return issues.length > 0 ? failure(issues) : success(out as T);
  };
}

/**
 * Accepts any non-null, non-array object.
 *
 * Used for the operation payload until Phase 4 defines concrete payload
 * models.
 */
export function unknownObject(): Validator<Record<string, unknown>> {
  return (value: unknown) => {
    if (!isRecord(value)) {
      return failure([issueAt('', 'expected an object')]);
    }
    return success(value);
  };
}

/**
 * Validates a string-keyed record whose values all pass the entry
 * validator, e.g. `record(string())` for a file map.
 */
export function record<T>(entry: Validator<T>): Validator<Record<string, T>> {
  return (value: unknown) => {
    if (!isRecord(value)) {
      return failure([issueAt('', 'expected an object')]);
    }
    const issues: ValidationIssue[] = [];
    const out: Record<string, T> = {};
    for (const key of Object.keys(value)) {
      const result = entry(value[key]);
      if (result.ok) {
        out[key] = result.value;
      } else {
        issues.push(...prefixIssues(result.issues, key));
      }
    }
    return issues.length > 0 ? failure(issues) : success(out);
  };
}

/** Typed error thrown by `parse` when validation fails. */
export class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`validation failed with ${issues.length} issue(s)`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** Validates and returns the value, or throws a typed ValidationError. */
export function parse<T>(validator: Validator<T>, value: unknown): T {
  const result = validator(value);
  if (result.ok) {
    return result.value;
  }
  throw new ValidationError(result.issues);
}
