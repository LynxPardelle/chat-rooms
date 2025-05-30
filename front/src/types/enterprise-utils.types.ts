/**
 * Enterprise Utils Types
 * 
 * Advanced TypeScript utility types and helper functions for
 * enterprise-grade type safety and development experience.
 * 
 * @fileoverview Comprehensive utility types for chat-rooms application
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

// ================================
// Core Utility Types
// ================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Make all properties readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Exclude null and undefined from type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Extract non-nullable properties from type
 */
export type NonNullableProperties<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Get all keys of type T that are of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Get all keys of type T that are not of type U
 */
export type KeysNotOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? never : K;
}[keyof T];

/**
 * Extract properties of specific type from object
 */
export type PropertiesOfType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Exclude properties of specific type from object
 */
export type PropertiesNotOfType<T, U> = Pick<T, KeysNotOfType<T, U>>;

// ================================
// Function Utility Types
// ================================

/**
 * Extract function parameters
 */
export type FunctionParameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * Extract function return type
 */
export type FunctionReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R ? R : never;

/**
 * Make function parameters optional
 */
export type OptionalParameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => infer R
  ? (...args: Partial<P>) => R
  : never;

/**
 * Async version of function type
 */
export type AsyncFunction<T extends (...args: any[]) => any> = T extends (...args: infer P) => infer R
  ? (...args: P) => Promise<R>
  : never;

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (event: T) => void;

/**
 * Async event handler function type
 */
export type AsyncEventHandler<T = any> = (event: T) => Promise<void>;

/**
 * Callback function with error handling
 */
export type ErrorCallback<T = any, E = Error> = (error: E | null, result?: T) => void;

// ================================
// Array and Object Utility Types
// ================================

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Extract object values type
 */
export type ObjectValues<T> = T[keyof T];

/**
 * Create tuple from array
 */
export type Tuple<T extends readonly unknown[]> = T;

/**
 * Get array length
 */
export type Length<T extends readonly unknown[]> = T['length'];

/**
 * Get first element of array
 */
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;

/**
 * Get last element of array
 */
export type Tail<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;

/**
 * Flatten nested array type
 */
export type Flatten<T> = T extends (infer U)[] ? Flatten<U> : T;

/**
 * Create union from object keys
 */
export type KeysAsUnion<T> = keyof T;

/**
 * Create union from object values
 */
export type ValuesAsUnion<T> = T[keyof T];

// ================================
// String Utility Types
// ================================

/**
 * Capitalize first letter
 */
export type Capitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S;

/**
 * Uncapitalize first letter
 */
export type Uncapitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : S;

/**
 * Convert snake_case to camelCase
 */
export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S;

/**
 * Convert camelCase to snake_case
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${SnakeCase<U>}`
  : S;

/**
 * Convert to kebab-case
 */
export type KebabCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '-' : ''}${Lowercase<T>}${KebabCase<U>}`
  : S;

/**
 * Split string by delimiter
 */
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

/**
 * Join string array with delimiter
 */
export type Join<T extends string[], D extends string> = T extends [infer F, ...infer R]
  ? R extends string[]
    ? R['length'] extends 0
      ? F
      : `${F & string}${D}${Join<R, D>}`
    : never
  : '';

// ================================
// Brand Types
// ================================

/**
 * Create branded type for type safety
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * User ID brand
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Room ID brand
 */
export type RoomId = Brand<string, 'RoomId'>;

/**
 * Message ID brand
 */
export type MessageId = Brand<string, 'MessageId'>;

/**
 * Session ID brand
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Token brand
 */
export type Token = Brand<string, 'Token'>;

/**
 * Email brand
 */
export type Email = Brand<string, 'Email'>;

/**
 * URL brand
 */
export type URL = Brand<string, 'URL'>;

/**
 * Timestamp brand
 */
export type Timestamp = Brand<string, 'Timestamp'>;

/**
 * Currency brand
 */
export type Currency = Brand<number, 'Currency'>;

/**
 * Percentage brand
 */
export type Percentage = Brand<number, 'Percentage'>;

// ================================
// Conditional Types
// ================================

/**
 * Check if type is any
 */
export type IsAny<T> = unknown extends T ? (T extends {} ? true : false) : false;

/**
 * Check if type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if type is unknown
 */
export type IsUnknown<T> = unknown extends T ? (IsAny<T> extends true ? false : true) : false;

/**
 * Check if type is exact
 */
export type IsExact<T, U> = T extends U ? (U extends T ? true : false) : false;

/**
 * Check if type is empty object
 */
export type IsEmptyObject<T> = T extends Record<PropertyKey, never> ? true : false;

/**
 * Check if type is array
 */
export type IsArray<T> = T extends readonly unknown[] ? true : false;

/**
 * Check if type is function
 */
export type IsFunction<T> = T extends (...args: any[]) => any ? true : false;

/**
 * Check if type is promise
 */
export type IsPromise<T> = T extends Promise<any> ? true : false;

// ================================
// Template Literal Types
// ================================

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTP status codes
 */
export type HttpStatusCode = 
  | 200 | 201 | 202 | 204
  | 300 | 301 | 302 | 304
  | 400 | 401 | 403 | 404 | 409 | 422 | 429
  | 500 | 501 | 502 | 503 | 504;

/**
 * Event name pattern
 */
export type EventName<T extends string = string> = `on${Capitalize<T>}`;

/**
 * API endpoint pattern
 */
export type ApiEndpoint<T extends string = string> = `/api/v1/${T}`;

/**
 * WebSocket event pattern
 */
export type SocketEvent<T extends string = string> = `socket:${T}`;

/**
 * CSS class name pattern
 */
export type CssClassName<T extends string = string> = `${T}` | `${T}--${string}` | `${T}__${string}`;

/**
 * Environment variable pattern
 */
export type EnvVar<T extends string = string> = `${Uppercase<T>}` | `VITE_${Uppercase<T>}`;

// ================================
// Mapped Types
// ================================

/**
 * Make all properties optional and nullable
 */
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Make all properties optional and nullable recursively
 */
export type DeepNullable<T> = {
  [P in keyof T]: T[P] extends object ? DeepNullable<T[P]> : T[P] | null;
};

/**
 * Create mutable version of readonly type
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Create mutable version recursively
 */
export type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

/**
 * Prefix all keys with string
 */
export type PrefixKeys<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
};

/**
 * Suffix all keys with string
 */
export type SuffixKeys<T, S extends string> = {
  [K in keyof T as `${string & K}${S}`]: T[K];
};

/**
 * Transform keys using template literal
 */
export type TransformKeys<T, F extends string, T_ extends string> = {
  [K in keyof T as K extends `${F}${infer R}` ? `${T_}${R}` : K]: T[K];
};

// ================================
// Advanced Utility Types
// ================================

/**
 * Create discriminated union type
 */
export type DiscriminatedUnion<T, K extends keyof T> = T extends any
  ? { [P in K]: T[P] } & Partial<T>
  : never;

/**
 * Exhaustive switch case helper
 */
export type ExhaustiveCheck<T> = T extends never ? T : never;

/**
 * Create overloaded function type
 */
export type Overload<T> = T extends {
  (...args: infer A1): infer R1;
  (...args: infer A2): infer R2;
}
  ? ((...args: A1) => R1) & ((...args: A2) => R2)
  : never;

/**
 * Create intersection of all union members
 */
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/**
 * Get last union member
 */
export type LastOfUnion<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

/**
 * Convert union to tuple
 */
export type UnionToTuple<T, L = LastOfUnion<T>, N = [T] extends [never] ? true : false> = true extends N
  ? []
  : [...UnionToTuple<Exclude<T, L>>, L];

/**
 * Get all possible paths through object
 */
export type Paths<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number ? `${K}` | `${K}.${Paths<T[K]>}` : never;
    }[keyof T]
  : never;

/**
 * Get value at path
 */
export type PathValue<T, P extends Paths<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Paths<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

// ================================
// Validation Types
// ================================

/**
 * Validation result
 */
export interface ValidationResult<T = any> {
  valid: boolean;
  data?: T;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Validator function
 */
export type Validator<T = any> = (value: T) => ValidationResult<T>;

/**
 * Async validator function
 */
export type AsyncValidator<T = any> = (value: T) => Promise<ValidationResult<T>>;

/**
 * Schema validation
 */
export interface SchemaValidator<T = any> {
  validate(data: any): ValidationResult<T>;
  validateAsync?(data: any): Promise<ValidationResult<T>>;
  schema: SchemaDefinition;
}

/**
 * Schema definition
 */
export interface SchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
  additionalProperties?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: any[];
  format?: string;
}

// ================================
// Meta Types
// ================================

/**
 * Type metadata
 */
export interface TypeMetadata<T = any> {
  name: string;
  type: string;
  description?: string;
  examples?: T[];
  schema?: SchemaDefinition;
  version?: string;
  deprecated?: boolean;
  since?: string;
}

/**
 * API endpoint metadata
 */
export interface ApiEndpointMetadata {
  method: HttpMethod;
  path: string;
  description: string;
  parameters?: ParameterMetadata[];
  requestBody?: TypeMetadata;
  responses: Record<HttpStatusCode, TypeMetadata>;
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirement[];
}

/**
 * Parameter metadata
 */
export interface ParameterMetadata {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SchemaDefinition;
  example?: any;
}

/**
 * Security requirement
 */
export interface SecurityRequirement {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

/**
 * OAuth flows
 */
export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

/**
 * OAuth flow
 */
export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

// ================================
// Type Utilities
// ================================

/**
 * Create type-safe event emitter
 */
export interface TypedEventEmitter<T extends Record<string, any[]>> {
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  emit<K extends keyof T>(event: K, ...args: T[K]): boolean;
  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  listenerCount<K extends keyof T>(event: K): number;
  removeAllListeners<K extends keyof T>(event?: K): this;
}

/**
 * Create type-safe store
 */
export interface TypedStore<T> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  has<K extends keyof T>(key: K): boolean;
  delete<K extends keyof T>(key: K): boolean;
  clear(): void;
  keys(): (keyof T)[];
  values(): T[keyof T][];
  entries(): [keyof T, T[keyof T]][];
}

/**
 * Create type-safe configuration
 */
export interface TypedConfig<T> {
  get<K extends Paths<T>>(path: K): PathValue<T, K>;
  set<K extends Paths<T>>(path: K, value: PathValue<T, K>): void;
  has<K extends Paths<T>>(path: K): boolean;
  merge(config: DeepPartial<T>): void;
  reset(): void;
  toObject(): T;
}

// ================================
// Helper Functions
// ================================

/**
 * Type guard creator
 */
export function createTypeGuard<T>(predicate: (value: any) => boolean): (value: any) => value is T {
  return (value: any): value is T => predicate(value);
}

/**
 * Assert type at runtime
 */
export function assertType<T>(value: any, guard: (value: any) => value is T, message?: string): asserts value is T {
  if (!guard(value)) {
    throw new Error(message || `Type assertion failed`);
  }
}

/**
 * Exhaustive check helper
 */
export function exhaustiveCheck(value: never): never {
  throw new Error(`Exhaustive check failed: ${value}`);
}

/**
 * Safe JSON parse with type validation
 */
export function safeJsonParse<T>(
  json: string,
  validator?: (value: any) => value is T
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(json);
    if (validator && !validator(parsed)) {
      return {
        valid: false,
        errors: [{ field: 'root', message: 'Invalid type', code: 'INVALID_TYPE' }]
      };
    }
    return { valid: true, data: parsed, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [{ field: 'root', message: error instanceof Error ? error.message : 'Parse error', code: 'PARSE_ERROR' }]
    };
  }
}

/**
 * Deep clone with type preservation
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const copy = {} as T;
    Object.keys(obj).forEach(key => {
      (copy as any)[key] = deepClone((obj as any)[key]);
    });
    return copy;
  }
  return obj;
}

/**
 * Type-safe object merge
 */
export function typedMerge<T extends object, U extends object>(
  target: T,
  source: U
): T & U {
  return { ...target, ...source };
}

/**
 * Create branded value
 */
export function createBrand<T, B>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

/**
 * Extract brand from branded type
 */
export function extractBrand<T extends Brand<any, any>>(value: T): T extends Brand<infer U, any> ? U : never {
  return value as any;
}
