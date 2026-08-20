import { describe, expect, it } from 'vitest';

import {
  ValidationError,
  array,
  boolean,
  integer,
  number,
  object,
  oneOf,
  optional,
  parse,
  record,
  string,
  unknownObject,
} from '../index.js';

describe('string', () => {
  it('accepts strings', () => {
    const result = string()('hello');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('rejects non-strings', () => {
    const result = string()(42);
    expect(result).toEqual({
      ok: false,
      issues: [{ path: '', message: 'expected a string' }],
    });
  });

  it('enforces min and max length', () => {
    expect(string({ maxLength: 3 })('toolong').ok).toBe(false);
    expect(string({ minLength: 3 })('ab').ok).toBe(false);
    expect(string({ minLength: 2, maxLength: 3 })('abc').ok).toBe(true);
  });

  it('enforces a pattern', () => {
    expect(string({ pattern: /^[a-z]+$/ })('lowercase').ok).toBe(true);
    expect(string({ pattern: /^[a-z]+$/ })('UPPERCASE').ok).toBe(false);
  });
});

describe('number', () => {
  it('accepts finite numbers', () => {
    expect(number()(1.5)).toEqual({ ok: true, value: 1.5 });
  });

  it('rejects non-numbers and non-finite values', () => {
    expect(number()('1').ok).toBe(false);
    expect(number()(Number.NaN).ok).toBe(false);
    expect(number()(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it('enforces min and max', () => {
    expect(number({ min: 0 })(-1).ok).toBe(false);
    expect(number({ max: 10 })(11).ok).toBe(false);
    expect(number({ min: 0, max: 10 })(5).ok).toBe(true);
  });
});

describe('integer', () => {
  it('rejects non-integers', () => {
    expect(integer()(1.5).ok).toBe(false);
  });

  it('accepts integers', () => {
    expect(integer()(7)).toEqual({ ok: true, value: 7 });
  });

  it('applies number constraints', () => {
    expect(integer({ min: 0 })(-3).ok).toBe(false);
  });
});

describe('boolean', () => {
  it('accepts booleans only', () => {
    expect(boolean()(true)).toEqual({ ok: true, value: true });
    expect(boolean()('true').ok).toBe(false);
  });
});

describe('oneOf', () => {
  it('accepts one of the allowed literals', () => {
    const validator = oneOf('a', 'b', 'c');
    expect(validator('b')).toEqual({ ok: true, value: 'b' });
    expect(validator('z').ok).toBe(false);
    expect(validator(1).ok).toBe(false);
  });
});

describe('optional', () => {
  it('accepts undefined or a valid value', () => {
    const validator = optional(string());
    expect(validator(undefined)).toEqual({ ok: true, value: undefined });
    expect(validator('value')).toEqual({ ok: true, value: 'value' });
    expect(validator(5).ok).toBe(false);
  });
});

describe('array', () => {
  it('rejects non-arrays', () => {
    expect(array(string())('not-an-array').ok).toBe(false);
  });

  it('validates every entry and prefixes paths with the index', () => {
    const result = array(string())(['a', 42]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: '[1]', message: 'expected a string' },
      ]);
    }
  });
});

describe('object', () => {
  it('rejects non-objects', () => {
    expect(object({ name: string() })(null).ok).toBe(false);
    expect(object({ name: string() })(['array']).ok).toBe(false);
  });

  it('validates a shape and collects prefixed issues', () => {
    const validator = object({ user: object({ id: integer() }) });
    const result = validator({ user: { id: 'not-an-integer' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'user.id', message: 'expected an integer' },
      ]);
    }
  });

  it('rejects unknown keys', () => {
    const result = object({ name: string() })({ name: 'x', extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'extra', message: 'unexpected key' },
      ]);
    }
  });
});

describe('unknownObject', () => {
  it('accepts plain objects', () => {
    expect(unknownObject()({ any: 'thing' })).toEqual({
      ok: true,
      value: { any: 'thing' },
    });
  });

  it('rejects null and arrays', () => {
    expect(unknownObject()(null).ok).toBe(false);
    expect(unknownObject()([1]).ok).toBe(false);
  });
});

describe('record', () => {
  it('accepts an empty record', () => {
    expect(record(string())({}).ok).toBe(true);
  });

  it('validates every value and prefixes paths with the key', () => {
    const result = record(string())({ 'a.md': 'hello', 'b.md': 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'b.md', message: 'expected a string' },
      ]);
    }
  });

  it('rejects non-objects', () => {
    expect(record(string())(['array']).ok).toBe(false);
    expect(record(string())(null).ok).toBe(false);
  });
});

describe('parse', () => {
  it('returns the value on success', () => {
    expect(parse(string(), 'ok')).toBe('ok');
  });

  it('throws a typed ValidationError on failure', () => {
    try {
      parse(string({ maxLength: 2 }), 'toolong');
      expect.unreachable('expected parse to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.issues).toHaveLength(1);
        expect(error.issues[0].path).toBe('');
        expect(error.issues[0].message).toBe('must be at most 2 characters');
      }
    }
  });
});
