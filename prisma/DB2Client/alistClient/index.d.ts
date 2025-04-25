
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model galrcalist_search_nodes
 * 
 */
export type galrcalist_search_nodes = $Result.DefaultSelection<Prisma.$galrcalist_search_nodesPayload>
/**
 * Model galrcalist_setting_items
 * 
 */
export type galrcalist_setting_items = $Result.DefaultSelection<Prisma.$galrcalist_setting_itemsPayload>
/**
 * Model galrcalist_meta
 * 
 */
export type galrcalist_meta = $Result.DefaultSelection<Prisma.$galrcalist_metaPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Galrcalist_search_nodes
 * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Galrcalist_search_nodes
   * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.galrcalist_search_nodes`: Exposes CRUD operations for the **galrcalist_search_nodes** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Galrcalist_search_nodes
    * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findMany()
    * ```
    */
  get galrcalist_search_nodes(): Prisma.galrcalist_search_nodesDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.galrcalist_setting_items`: Exposes CRUD operations for the **galrcalist_setting_items** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Galrcalist_setting_items
    * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findMany()
    * ```
    */
  get galrcalist_setting_items(): Prisma.galrcalist_setting_itemsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.galrcalist_meta`: Exposes CRUD operations for the **galrcalist_meta** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Galrcalist_metas
    * const galrcalist_metas = await prisma.galrcalist_meta.findMany()
    * ```
    */
  get galrcalist_meta(): Prisma.galrcalist_metaDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.6.0
   * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    galrcalist_search_nodes: 'galrcalist_search_nodes',
    galrcalist_setting_items: 'galrcalist_setting_items',
    galrcalist_meta: 'galrcalist_meta'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db2?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "galrcalist_search_nodes" | "galrcalist_setting_items" | "galrcalist_meta"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      galrcalist_search_nodes: {
        payload: Prisma.$galrcalist_search_nodesPayload<ExtArgs>
        fields: Prisma.galrcalist_search_nodesFieldRefs
        operations: {
          findUnique: {
            args: Prisma.galrcalist_search_nodesFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.galrcalist_search_nodesFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          findFirst: {
            args: Prisma.galrcalist_search_nodesFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.galrcalist_search_nodesFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          findMany: {
            args: Prisma.galrcalist_search_nodesFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>[]
          }
          create: {
            args: Prisma.galrcalist_search_nodesCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          createMany: {
            args: Prisma.galrcalist_search_nodesCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.galrcalist_search_nodesCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>[]
          }
          delete: {
            args: Prisma.galrcalist_search_nodesDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          update: {
            args: Prisma.galrcalist_search_nodesUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          deleteMany: {
            args: Prisma.galrcalist_search_nodesDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.galrcalist_search_nodesUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.galrcalist_search_nodesUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>[]
          }
          upsert: {
            args: Prisma.galrcalist_search_nodesUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_search_nodesPayload>
          }
          aggregate: {
            args: Prisma.Galrcalist_search_nodesAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGalrcalist_search_nodes>
          }
          groupBy: {
            args: Prisma.galrcalist_search_nodesGroupByArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_search_nodesGroupByOutputType>[]
          }
          count: {
            args: Prisma.galrcalist_search_nodesCountArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_search_nodesCountAggregateOutputType> | number
          }
        }
      }
      galrcalist_setting_items: {
        payload: Prisma.$galrcalist_setting_itemsPayload<ExtArgs>
        fields: Prisma.galrcalist_setting_itemsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.galrcalist_setting_itemsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.galrcalist_setting_itemsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          findFirst: {
            args: Prisma.galrcalist_setting_itemsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.galrcalist_setting_itemsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          findMany: {
            args: Prisma.galrcalist_setting_itemsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>[]
          }
          create: {
            args: Prisma.galrcalist_setting_itemsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          createMany: {
            args: Prisma.galrcalist_setting_itemsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.galrcalist_setting_itemsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>[]
          }
          delete: {
            args: Prisma.galrcalist_setting_itemsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          update: {
            args: Prisma.galrcalist_setting_itemsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          deleteMany: {
            args: Prisma.galrcalist_setting_itemsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.galrcalist_setting_itemsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.galrcalist_setting_itemsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>[]
          }
          upsert: {
            args: Prisma.galrcalist_setting_itemsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_setting_itemsPayload>
          }
          aggregate: {
            args: Prisma.Galrcalist_setting_itemsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGalrcalist_setting_items>
          }
          groupBy: {
            args: Prisma.galrcalist_setting_itemsGroupByArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_setting_itemsGroupByOutputType>[]
          }
          count: {
            args: Prisma.galrcalist_setting_itemsCountArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_setting_itemsCountAggregateOutputType> | number
          }
        }
      }
      galrcalist_meta: {
        payload: Prisma.$galrcalist_metaPayload<ExtArgs>
        fields: Prisma.galrcalist_metaFieldRefs
        operations: {
          findUnique: {
            args: Prisma.galrcalist_metaFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.galrcalist_metaFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          findFirst: {
            args: Prisma.galrcalist_metaFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.galrcalist_metaFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          findMany: {
            args: Prisma.galrcalist_metaFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>[]
          }
          create: {
            args: Prisma.galrcalist_metaCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          createMany: {
            args: Prisma.galrcalist_metaCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.galrcalist_metaCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>[]
          }
          delete: {
            args: Prisma.galrcalist_metaDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          update: {
            args: Prisma.galrcalist_metaUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          deleteMany: {
            args: Prisma.galrcalist_metaDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.galrcalist_metaUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.galrcalist_metaUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>[]
          }
          upsert: {
            args: Prisma.galrcalist_metaUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galrcalist_metaPayload>
          }
          aggregate: {
            args: Prisma.Galrcalist_metaAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGalrcalist_meta>
          }
          groupBy: {
            args: Prisma.galrcalist_metaGroupByArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_metaGroupByOutputType>[]
          }
          count: {
            args: Prisma.galrcalist_metaCountArgs<ExtArgs>
            result: $Utils.Optional<Galrcalist_metaCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    galrcalist_search_nodes?: galrcalist_search_nodesOmit
    galrcalist_setting_items?: galrcalist_setting_itemsOmit
    galrcalist_meta?: galrcalist_metaOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model galrcalist_search_nodes
   */

  export type AggregateGalrcalist_search_nodes = {
    _count: Galrcalist_search_nodesCountAggregateOutputType | null
    _avg: Galrcalist_search_nodesAvgAggregateOutputType | null
    _sum: Galrcalist_search_nodesSumAggregateOutputType | null
    _min: Galrcalist_search_nodesMinAggregateOutputType | null
    _max: Galrcalist_search_nodesMaxAggregateOutputType | null
  }

  export type Galrcalist_search_nodesAvgAggregateOutputType = {
    size: number | null
  }

  export type Galrcalist_search_nodesSumAggregateOutputType = {
    size: number | null
  }

  export type Galrcalist_search_nodesMinAggregateOutputType = {
    parent: string | null
    name: string | null
    is_dir: boolean | null
    size: number | null
  }

  export type Galrcalist_search_nodesMaxAggregateOutputType = {
    parent: string | null
    name: string | null
    is_dir: boolean | null
    size: number | null
  }

  export type Galrcalist_search_nodesCountAggregateOutputType = {
    parent: number
    name: number
    is_dir: number
    size: number
    _all: number
  }


  export type Galrcalist_search_nodesAvgAggregateInputType = {
    size?: true
  }

  export type Galrcalist_search_nodesSumAggregateInputType = {
    size?: true
  }

  export type Galrcalist_search_nodesMinAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
  }

  export type Galrcalist_search_nodesMaxAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
  }

  export type Galrcalist_search_nodesCountAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
    _all?: true
  }

  export type Galrcalist_search_nodesAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_search_nodes to aggregate.
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_search_nodes to fetch.
     */
    orderBy?: galrcalist_search_nodesOrderByWithRelationInput | galrcalist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: galrcalist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned galrcalist_search_nodes
    **/
    _count?: true | Galrcalist_search_nodesCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Galrcalist_search_nodesAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Galrcalist_search_nodesSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Galrcalist_search_nodesMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Galrcalist_search_nodesMaxAggregateInputType
  }

  export type GetGalrcalist_search_nodesAggregateType<T extends Galrcalist_search_nodesAggregateArgs> = {
        [P in keyof T & keyof AggregateGalrcalist_search_nodes]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGalrcalist_search_nodes[P]>
      : GetScalarType<T[P], AggregateGalrcalist_search_nodes[P]>
  }




  export type galrcalist_search_nodesGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: galrcalist_search_nodesWhereInput
    orderBy?: galrcalist_search_nodesOrderByWithAggregationInput | galrcalist_search_nodesOrderByWithAggregationInput[]
    by: Galrcalist_search_nodesScalarFieldEnum[] | Galrcalist_search_nodesScalarFieldEnum
    having?: galrcalist_search_nodesScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Galrcalist_search_nodesCountAggregateInputType | true
    _avg?: Galrcalist_search_nodesAvgAggregateInputType
    _sum?: Galrcalist_search_nodesSumAggregateInputType
    _min?: Galrcalist_search_nodesMinAggregateInputType
    _max?: Galrcalist_search_nodesMaxAggregateInputType
  }

  export type Galrcalist_search_nodesGroupByOutputType = {
    parent: string
    name: string
    is_dir: boolean
    size: number
    _count: Galrcalist_search_nodesCountAggregateOutputType | null
    _avg: Galrcalist_search_nodesAvgAggregateOutputType | null
    _sum: Galrcalist_search_nodesSumAggregateOutputType | null
    _min: Galrcalist_search_nodesMinAggregateOutputType | null
    _max: Galrcalist_search_nodesMaxAggregateOutputType | null
  }

  type GetGalrcalist_search_nodesGroupByPayload<T extends galrcalist_search_nodesGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Galrcalist_search_nodesGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Galrcalist_search_nodesGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Galrcalist_search_nodesGroupByOutputType[P]>
            : GetScalarType<T[P], Galrcalist_search_nodesGroupByOutputType[P]>
        }
      >
    >


  export type galrcalist_search_nodesSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galrcalist_search_nodes"]>

  export type galrcalist_search_nodesSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galrcalist_search_nodes"]>

  export type galrcalist_search_nodesSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galrcalist_search_nodes"]>

  export type galrcalist_search_nodesSelectScalar = {
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }

  export type galrcalist_search_nodesOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"parent" | "name" | "is_dir" | "size", ExtArgs["result"]["galrcalist_search_nodes"]>

  export type $galrcalist_search_nodesPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "galrcalist_search_nodes"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      parent: string
      name: string
      is_dir: boolean
      size: number
    }, ExtArgs["result"]["galrcalist_search_nodes"]>
    composites: {}
  }

  type galrcalist_search_nodesGetPayload<S extends boolean | null | undefined | galrcalist_search_nodesDefaultArgs> = $Result.GetResult<Prisma.$galrcalist_search_nodesPayload, S>

  type galrcalist_search_nodesCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<galrcalist_search_nodesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Galrcalist_search_nodesCountAggregateInputType | true
    }

  export interface galrcalist_search_nodesDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['galrcalist_search_nodes'], meta: { name: 'galrcalist_search_nodes' } }
    /**
     * Find zero or one Galrcalist_search_nodes that matches the filter.
     * @param {galrcalist_search_nodesFindUniqueArgs} args - Arguments to find a Galrcalist_search_nodes
     * @example
     * // Get one Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends galrcalist_search_nodesFindUniqueArgs>(args: SelectSubset<T, galrcalist_search_nodesFindUniqueArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Galrcalist_search_nodes that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {galrcalist_search_nodesFindUniqueOrThrowArgs} args - Arguments to find a Galrcalist_search_nodes
     * @example
     * // Get one Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends galrcalist_search_nodesFindUniqueOrThrowArgs>(args: SelectSubset<T, galrcalist_search_nodesFindUniqueOrThrowArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_search_nodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesFindFirstArgs} args - Arguments to find a Galrcalist_search_nodes
     * @example
     * // Get one Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends galrcalist_search_nodesFindFirstArgs>(args?: SelectSubset<T, galrcalist_search_nodesFindFirstArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_search_nodes that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesFindFirstOrThrowArgs} args - Arguments to find a Galrcalist_search_nodes
     * @example
     * // Get one Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends galrcalist_search_nodesFindFirstOrThrowArgs>(args?: SelectSubset<T, galrcalist_search_nodesFindFirstOrThrowArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Galrcalist_search_nodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findMany()
     * 
     * // Get first 10 Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.findMany({ take: 10 })
     * 
     * // Only select the `parent`
     * const galrcalist_search_nodesWithParentOnly = await prisma.galrcalist_search_nodes.findMany({ select: { parent: true } })
     * 
     */
    findMany<T extends galrcalist_search_nodesFindManyArgs>(args?: SelectSubset<T, galrcalist_search_nodesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesCreateArgs} args - Arguments to create a Galrcalist_search_nodes.
     * @example
     * // Create one Galrcalist_search_nodes
     * const Galrcalist_search_nodes = await prisma.galrcalist_search_nodes.create({
     *   data: {
     *     // ... data to create a Galrcalist_search_nodes
     *   }
     * })
     * 
     */
    create<T extends galrcalist_search_nodesCreateArgs>(args: SelectSubset<T, galrcalist_search_nodesCreateArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesCreateManyArgs} args - Arguments to create many Galrcalist_search_nodes.
     * @example
     * // Create many Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends galrcalist_search_nodesCreateManyArgs>(args?: SelectSubset<T, galrcalist_search_nodesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Galrcalist_search_nodes and returns the data saved in the database.
     * @param {galrcalist_search_nodesCreateManyAndReturnArgs} args - Arguments to create many Galrcalist_search_nodes.
     * @example
     * // Create many Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Galrcalist_search_nodes and only return the `parent`
     * const galrcalist_search_nodesWithParentOnly = await prisma.galrcalist_search_nodes.createManyAndReturn({
     *   select: { parent: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends galrcalist_search_nodesCreateManyAndReturnArgs>(args?: SelectSubset<T, galrcalist_search_nodesCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesDeleteArgs} args - Arguments to delete one Galrcalist_search_nodes.
     * @example
     * // Delete one Galrcalist_search_nodes
     * const Galrcalist_search_nodes = await prisma.galrcalist_search_nodes.delete({
     *   where: {
     *     // ... filter to delete one Galrcalist_search_nodes
     *   }
     * })
     * 
     */
    delete<T extends galrcalist_search_nodesDeleteArgs>(args: SelectSubset<T, galrcalist_search_nodesDeleteArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesUpdateArgs} args - Arguments to update one Galrcalist_search_nodes.
     * @example
     * // Update one Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends galrcalist_search_nodesUpdateArgs>(args: SelectSubset<T, galrcalist_search_nodesUpdateArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesDeleteManyArgs} args - Arguments to filter Galrcalist_search_nodes to delete.
     * @example
     * // Delete a few Galrcalist_search_nodes
     * const { count } = await prisma.galrcalist_search_nodes.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends galrcalist_search_nodesDeleteManyArgs>(args?: SelectSubset<T, galrcalist_search_nodesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends galrcalist_search_nodesUpdateManyArgs>(args: SelectSubset<T, galrcalist_search_nodesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_search_nodes and returns the data updated in the database.
     * @param {galrcalist_search_nodesUpdateManyAndReturnArgs} args - Arguments to update many Galrcalist_search_nodes.
     * @example
     * // Update many Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Galrcalist_search_nodes and only return the `parent`
     * const galrcalist_search_nodesWithParentOnly = await prisma.galrcalist_search_nodes.updateManyAndReturn({
     *   select: { parent: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends galrcalist_search_nodesUpdateManyAndReturnArgs>(args: SelectSubset<T, galrcalist_search_nodesUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Galrcalist_search_nodes.
     * @param {galrcalist_search_nodesUpsertArgs} args - Arguments to update or create a Galrcalist_search_nodes.
     * @example
     * // Update or create a Galrcalist_search_nodes
     * const galrcalist_search_nodes = await prisma.galrcalist_search_nodes.upsert({
     *   create: {
     *     // ... data to create a Galrcalist_search_nodes
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Galrcalist_search_nodes we want to update
     *   }
     * })
     */
    upsert<T extends galrcalist_search_nodesUpsertArgs>(args: SelectSubset<T, galrcalist_search_nodesUpsertArgs<ExtArgs>>): Prisma__galrcalist_search_nodesClient<$Result.GetResult<Prisma.$galrcalist_search_nodesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Galrcalist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesCountArgs} args - Arguments to filter Galrcalist_search_nodes to count.
     * @example
     * // Count the number of Galrcalist_search_nodes
     * const count = await prisma.galrcalist_search_nodes.count({
     *   where: {
     *     // ... the filter for the Galrcalist_search_nodes we want to count
     *   }
     * })
    **/
    count<T extends galrcalist_search_nodesCountArgs>(
      args?: Subset<T, galrcalist_search_nodesCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Galrcalist_search_nodesCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Galrcalist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Galrcalist_search_nodesAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Galrcalist_search_nodesAggregateArgs>(args: Subset<T, Galrcalist_search_nodesAggregateArgs>): Prisma.PrismaPromise<GetGalrcalist_search_nodesAggregateType<T>>

    /**
     * Group by Galrcalist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_search_nodesGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends galrcalist_search_nodesGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: galrcalist_search_nodesGroupByArgs['orderBy'] }
        : { orderBy?: galrcalist_search_nodesGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, galrcalist_search_nodesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGalrcalist_search_nodesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the galrcalist_search_nodes model
   */
  readonly fields: galrcalist_search_nodesFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for galrcalist_search_nodes.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__galrcalist_search_nodesClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the galrcalist_search_nodes model
   */
  interface galrcalist_search_nodesFieldRefs {
    readonly parent: FieldRef<"galrcalist_search_nodes", 'String'>
    readonly name: FieldRef<"galrcalist_search_nodes", 'String'>
    readonly is_dir: FieldRef<"galrcalist_search_nodes", 'Boolean'>
    readonly size: FieldRef<"galrcalist_search_nodes", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * galrcalist_search_nodes findUnique
   */
  export type galrcalist_search_nodesFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_search_nodes to fetch.
     */
    where: galrcalist_search_nodesWhereUniqueInput
  }

  /**
   * galrcalist_search_nodes findUniqueOrThrow
   */
  export type galrcalist_search_nodesFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_search_nodes to fetch.
     */
    where: galrcalist_search_nodesWhereUniqueInput
  }

  /**
   * galrcalist_search_nodes findFirst
   */
  export type galrcalist_search_nodesFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_search_nodes to fetch.
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_search_nodes to fetch.
     */
    orderBy?: galrcalist_search_nodesOrderByWithRelationInput | galrcalist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_search_nodes.
     */
    cursor?: galrcalist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_search_nodes.
     */
    distinct?: Galrcalist_search_nodesScalarFieldEnum | Galrcalist_search_nodesScalarFieldEnum[]
  }

  /**
   * galrcalist_search_nodes findFirstOrThrow
   */
  export type galrcalist_search_nodesFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_search_nodes to fetch.
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_search_nodes to fetch.
     */
    orderBy?: galrcalist_search_nodesOrderByWithRelationInput | galrcalist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_search_nodes.
     */
    cursor?: galrcalist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_search_nodes.
     */
    distinct?: Galrcalist_search_nodesScalarFieldEnum | Galrcalist_search_nodesScalarFieldEnum[]
  }

  /**
   * galrcalist_search_nodes findMany
   */
  export type galrcalist_search_nodesFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_search_nodes to fetch.
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_search_nodes to fetch.
     */
    orderBy?: galrcalist_search_nodesOrderByWithRelationInput | galrcalist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing galrcalist_search_nodes.
     */
    cursor?: galrcalist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_search_nodes.
     */
    skip?: number
    distinct?: Galrcalist_search_nodesScalarFieldEnum | Galrcalist_search_nodesScalarFieldEnum[]
  }

  /**
   * galrcalist_search_nodes create
   */
  export type galrcalist_search_nodesCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * The data needed to create a galrcalist_search_nodes.
     */
    data: XOR<galrcalist_search_nodesCreateInput, galrcalist_search_nodesUncheckedCreateInput>
  }

  /**
   * galrcalist_search_nodes createMany
   */
  export type galrcalist_search_nodesCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many galrcalist_search_nodes.
     */
    data: galrcalist_search_nodesCreateManyInput | galrcalist_search_nodesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_search_nodes createManyAndReturn
   */
  export type galrcalist_search_nodesCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * The data used to create many galrcalist_search_nodes.
     */
    data: galrcalist_search_nodesCreateManyInput | galrcalist_search_nodesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_search_nodes update
   */
  export type galrcalist_search_nodesUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * The data needed to update a galrcalist_search_nodes.
     */
    data: XOR<galrcalist_search_nodesUpdateInput, galrcalist_search_nodesUncheckedUpdateInput>
    /**
     * Choose, which galrcalist_search_nodes to update.
     */
    where: galrcalist_search_nodesWhereUniqueInput
  }

  /**
   * galrcalist_search_nodes updateMany
   */
  export type galrcalist_search_nodesUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update galrcalist_search_nodes.
     */
    data: XOR<galrcalist_search_nodesUpdateManyMutationInput, galrcalist_search_nodesUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_search_nodes to update
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * Limit how many galrcalist_search_nodes to update.
     */
    limit?: number
  }

  /**
   * galrcalist_search_nodes updateManyAndReturn
   */
  export type galrcalist_search_nodesUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * The data used to update galrcalist_search_nodes.
     */
    data: XOR<galrcalist_search_nodesUpdateManyMutationInput, galrcalist_search_nodesUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_search_nodes to update
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * Limit how many galrcalist_search_nodes to update.
     */
    limit?: number
  }

  /**
   * galrcalist_search_nodes upsert
   */
  export type galrcalist_search_nodesUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * The filter to search for the galrcalist_search_nodes to update in case it exists.
     */
    where: galrcalist_search_nodesWhereUniqueInput
    /**
     * In case the galrcalist_search_nodes found by the `where` argument doesn't exist, create a new galrcalist_search_nodes with this data.
     */
    create: XOR<galrcalist_search_nodesCreateInput, galrcalist_search_nodesUncheckedCreateInput>
    /**
     * In case the galrcalist_search_nodes was found with the provided `where` argument, update it with this data.
     */
    update: XOR<galrcalist_search_nodesUpdateInput, galrcalist_search_nodesUncheckedUpdateInput>
  }

  /**
   * galrcalist_search_nodes delete
   */
  export type galrcalist_search_nodesDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter which galrcalist_search_nodes to delete.
     */
    where: galrcalist_search_nodesWhereUniqueInput
  }

  /**
   * galrcalist_search_nodes deleteMany
   */
  export type galrcalist_search_nodesDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_search_nodes to delete
     */
    where?: galrcalist_search_nodesWhereInput
    /**
     * Limit how many galrcalist_search_nodes to delete.
     */
    limit?: number
  }

  /**
   * galrcalist_search_nodes without action
   */
  export type galrcalist_search_nodesDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_search_nodes
     */
    select?: galrcalist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_search_nodes
     */
    omit?: galrcalist_search_nodesOmit<ExtArgs> | null
  }


  /**
   * Model galrcalist_setting_items
   */

  export type AggregateGalrcalist_setting_items = {
    _count: Galrcalist_setting_itemsCountAggregateOutputType | null
    _avg: Galrcalist_setting_itemsAvgAggregateOutputType | null
    _sum: Galrcalist_setting_itemsSumAggregateOutputType | null
    _min: Galrcalist_setting_itemsMinAggregateOutputType | null
    _max: Galrcalist_setting_itemsMaxAggregateOutputType | null
  }

  export type Galrcalist_setting_itemsAvgAggregateOutputType = {
    group: number | null
    flag: number | null
    index: number | null
  }

  export type Galrcalist_setting_itemsSumAggregateOutputType = {
    group: number | null
    flag: number | null
    index: number | null
  }

  export type Galrcalist_setting_itemsMinAggregateOutputType = {
    key: string | null
    value: string | null
    help: string | null
    type: string | null
    options: string | null
    group: number | null
    flag: number | null
    index: number | null
  }

  export type Galrcalist_setting_itemsMaxAggregateOutputType = {
    key: string | null
    value: string | null
    help: string | null
    type: string | null
    options: string | null
    group: number | null
    flag: number | null
    index: number | null
  }

  export type Galrcalist_setting_itemsCountAggregateOutputType = {
    key: number
    value: number
    help: number
    type: number
    options: number
    group: number
    flag: number
    index: number
    _all: number
  }


  export type Galrcalist_setting_itemsAvgAggregateInputType = {
    group?: true
    flag?: true
    index?: true
  }

  export type Galrcalist_setting_itemsSumAggregateInputType = {
    group?: true
    flag?: true
    index?: true
  }

  export type Galrcalist_setting_itemsMinAggregateInputType = {
    key?: true
    value?: true
    help?: true
    type?: true
    options?: true
    group?: true
    flag?: true
    index?: true
  }

  export type Galrcalist_setting_itemsMaxAggregateInputType = {
    key?: true
    value?: true
    help?: true
    type?: true
    options?: true
    group?: true
    flag?: true
    index?: true
  }

  export type Galrcalist_setting_itemsCountAggregateInputType = {
    key?: true
    value?: true
    help?: true
    type?: true
    options?: true
    group?: true
    flag?: true
    index?: true
    _all?: true
  }

  export type Galrcalist_setting_itemsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_setting_items to aggregate.
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_setting_items to fetch.
     */
    orderBy?: galrcalist_setting_itemsOrderByWithRelationInput | galrcalist_setting_itemsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: galrcalist_setting_itemsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_setting_items from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_setting_items.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned galrcalist_setting_items
    **/
    _count?: true | Galrcalist_setting_itemsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Galrcalist_setting_itemsAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Galrcalist_setting_itemsSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Galrcalist_setting_itemsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Galrcalist_setting_itemsMaxAggregateInputType
  }

  export type GetGalrcalist_setting_itemsAggregateType<T extends Galrcalist_setting_itemsAggregateArgs> = {
        [P in keyof T & keyof AggregateGalrcalist_setting_items]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGalrcalist_setting_items[P]>
      : GetScalarType<T[P], AggregateGalrcalist_setting_items[P]>
  }




  export type galrcalist_setting_itemsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: galrcalist_setting_itemsWhereInput
    orderBy?: galrcalist_setting_itemsOrderByWithAggregationInput | galrcalist_setting_itemsOrderByWithAggregationInput[]
    by: Galrcalist_setting_itemsScalarFieldEnum[] | Galrcalist_setting_itemsScalarFieldEnum
    having?: galrcalist_setting_itemsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Galrcalist_setting_itemsCountAggregateInputType | true
    _avg?: Galrcalist_setting_itemsAvgAggregateInputType
    _sum?: Galrcalist_setting_itemsSumAggregateInputType
    _min?: Galrcalist_setting_itemsMinAggregateInputType
    _max?: Galrcalist_setting_itemsMaxAggregateInputType
  }

  export type Galrcalist_setting_itemsGroupByOutputType = {
    key: string
    value: string | null
    help: string | null
    type: string | null
    options: string | null
    group: number | null
    flag: number | null
    index: number | null
    _count: Galrcalist_setting_itemsCountAggregateOutputType | null
    _avg: Galrcalist_setting_itemsAvgAggregateOutputType | null
    _sum: Galrcalist_setting_itemsSumAggregateOutputType | null
    _min: Galrcalist_setting_itemsMinAggregateOutputType | null
    _max: Galrcalist_setting_itemsMaxAggregateOutputType | null
  }

  type GetGalrcalist_setting_itemsGroupByPayload<T extends galrcalist_setting_itemsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Galrcalist_setting_itemsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Galrcalist_setting_itemsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Galrcalist_setting_itemsGroupByOutputType[P]>
            : GetScalarType<T[P], Galrcalist_setting_itemsGroupByOutputType[P]>
        }
      >
    >


  export type galrcalist_setting_itemsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    help?: boolean
    type?: boolean
    options?: boolean
    group?: boolean
    flag?: boolean
    index?: boolean
  }, ExtArgs["result"]["galrcalist_setting_items"]>

  export type galrcalist_setting_itemsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    help?: boolean
    type?: boolean
    options?: boolean
    group?: boolean
    flag?: boolean
    index?: boolean
  }, ExtArgs["result"]["galrcalist_setting_items"]>

  export type galrcalist_setting_itemsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    help?: boolean
    type?: boolean
    options?: boolean
    group?: boolean
    flag?: boolean
    index?: boolean
  }, ExtArgs["result"]["galrcalist_setting_items"]>

  export type galrcalist_setting_itemsSelectScalar = {
    key?: boolean
    value?: boolean
    help?: boolean
    type?: boolean
    options?: boolean
    group?: boolean
    flag?: boolean
    index?: boolean
  }

  export type galrcalist_setting_itemsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"key" | "value" | "help" | "type" | "options" | "group" | "flag" | "index", ExtArgs["result"]["galrcalist_setting_items"]>

  export type $galrcalist_setting_itemsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "galrcalist_setting_items"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      key: string
      value: string | null
      help: string | null
      type: string | null
      options: string | null
      group: number | null
      flag: number | null
      index: number | null
    }, ExtArgs["result"]["galrcalist_setting_items"]>
    composites: {}
  }

  type galrcalist_setting_itemsGetPayload<S extends boolean | null | undefined | galrcalist_setting_itemsDefaultArgs> = $Result.GetResult<Prisma.$galrcalist_setting_itemsPayload, S>

  type galrcalist_setting_itemsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<galrcalist_setting_itemsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Galrcalist_setting_itemsCountAggregateInputType | true
    }

  export interface galrcalist_setting_itemsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['galrcalist_setting_items'], meta: { name: 'galrcalist_setting_items' } }
    /**
     * Find zero or one Galrcalist_setting_items that matches the filter.
     * @param {galrcalist_setting_itemsFindUniqueArgs} args - Arguments to find a Galrcalist_setting_items
     * @example
     * // Get one Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends galrcalist_setting_itemsFindUniqueArgs>(args: SelectSubset<T, galrcalist_setting_itemsFindUniqueArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Galrcalist_setting_items that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {galrcalist_setting_itemsFindUniqueOrThrowArgs} args - Arguments to find a Galrcalist_setting_items
     * @example
     * // Get one Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends galrcalist_setting_itemsFindUniqueOrThrowArgs>(args: SelectSubset<T, galrcalist_setting_itemsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_setting_items that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsFindFirstArgs} args - Arguments to find a Galrcalist_setting_items
     * @example
     * // Get one Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends galrcalist_setting_itemsFindFirstArgs>(args?: SelectSubset<T, galrcalist_setting_itemsFindFirstArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_setting_items that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsFindFirstOrThrowArgs} args - Arguments to find a Galrcalist_setting_items
     * @example
     * // Get one Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends galrcalist_setting_itemsFindFirstOrThrowArgs>(args?: SelectSubset<T, galrcalist_setting_itemsFindFirstOrThrowArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Galrcalist_setting_items that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findMany()
     * 
     * // Get first 10 Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.findMany({ take: 10 })
     * 
     * // Only select the `key`
     * const galrcalist_setting_itemsWithKeyOnly = await prisma.galrcalist_setting_items.findMany({ select: { key: true } })
     * 
     */
    findMany<T extends galrcalist_setting_itemsFindManyArgs>(args?: SelectSubset<T, galrcalist_setting_itemsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsCreateArgs} args - Arguments to create a Galrcalist_setting_items.
     * @example
     * // Create one Galrcalist_setting_items
     * const Galrcalist_setting_items = await prisma.galrcalist_setting_items.create({
     *   data: {
     *     // ... data to create a Galrcalist_setting_items
     *   }
     * })
     * 
     */
    create<T extends galrcalist_setting_itemsCreateArgs>(args: SelectSubset<T, galrcalist_setting_itemsCreateArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsCreateManyArgs} args - Arguments to create many Galrcalist_setting_items.
     * @example
     * // Create many Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends galrcalist_setting_itemsCreateManyArgs>(args?: SelectSubset<T, galrcalist_setting_itemsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Galrcalist_setting_items and returns the data saved in the database.
     * @param {galrcalist_setting_itemsCreateManyAndReturnArgs} args - Arguments to create many Galrcalist_setting_items.
     * @example
     * // Create many Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Galrcalist_setting_items and only return the `key`
     * const galrcalist_setting_itemsWithKeyOnly = await prisma.galrcalist_setting_items.createManyAndReturn({
     *   select: { key: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends galrcalist_setting_itemsCreateManyAndReturnArgs>(args?: SelectSubset<T, galrcalist_setting_itemsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsDeleteArgs} args - Arguments to delete one Galrcalist_setting_items.
     * @example
     * // Delete one Galrcalist_setting_items
     * const Galrcalist_setting_items = await prisma.galrcalist_setting_items.delete({
     *   where: {
     *     // ... filter to delete one Galrcalist_setting_items
     *   }
     * })
     * 
     */
    delete<T extends galrcalist_setting_itemsDeleteArgs>(args: SelectSubset<T, galrcalist_setting_itemsDeleteArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsUpdateArgs} args - Arguments to update one Galrcalist_setting_items.
     * @example
     * // Update one Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends galrcalist_setting_itemsUpdateArgs>(args: SelectSubset<T, galrcalist_setting_itemsUpdateArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsDeleteManyArgs} args - Arguments to filter Galrcalist_setting_items to delete.
     * @example
     * // Delete a few Galrcalist_setting_items
     * const { count } = await prisma.galrcalist_setting_items.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends galrcalist_setting_itemsDeleteManyArgs>(args?: SelectSubset<T, galrcalist_setting_itemsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_setting_items.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends galrcalist_setting_itemsUpdateManyArgs>(args: SelectSubset<T, galrcalist_setting_itemsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_setting_items and returns the data updated in the database.
     * @param {galrcalist_setting_itemsUpdateManyAndReturnArgs} args - Arguments to update many Galrcalist_setting_items.
     * @example
     * // Update many Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Galrcalist_setting_items and only return the `key`
     * const galrcalist_setting_itemsWithKeyOnly = await prisma.galrcalist_setting_items.updateManyAndReturn({
     *   select: { key: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends galrcalist_setting_itemsUpdateManyAndReturnArgs>(args: SelectSubset<T, galrcalist_setting_itemsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Galrcalist_setting_items.
     * @param {galrcalist_setting_itemsUpsertArgs} args - Arguments to update or create a Galrcalist_setting_items.
     * @example
     * // Update or create a Galrcalist_setting_items
     * const galrcalist_setting_items = await prisma.galrcalist_setting_items.upsert({
     *   create: {
     *     // ... data to create a Galrcalist_setting_items
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Galrcalist_setting_items we want to update
     *   }
     * })
     */
    upsert<T extends galrcalist_setting_itemsUpsertArgs>(args: SelectSubset<T, galrcalist_setting_itemsUpsertArgs<ExtArgs>>): Prisma__galrcalist_setting_itemsClient<$Result.GetResult<Prisma.$galrcalist_setting_itemsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Galrcalist_setting_items.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsCountArgs} args - Arguments to filter Galrcalist_setting_items to count.
     * @example
     * // Count the number of Galrcalist_setting_items
     * const count = await prisma.galrcalist_setting_items.count({
     *   where: {
     *     // ... the filter for the Galrcalist_setting_items we want to count
     *   }
     * })
    **/
    count<T extends galrcalist_setting_itemsCountArgs>(
      args?: Subset<T, galrcalist_setting_itemsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Galrcalist_setting_itemsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Galrcalist_setting_items.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Galrcalist_setting_itemsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Galrcalist_setting_itemsAggregateArgs>(args: Subset<T, Galrcalist_setting_itemsAggregateArgs>): Prisma.PrismaPromise<GetGalrcalist_setting_itemsAggregateType<T>>

    /**
     * Group by Galrcalist_setting_items.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_setting_itemsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends galrcalist_setting_itemsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: galrcalist_setting_itemsGroupByArgs['orderBy'] }
        : { orderBy?: galrcalist_setting_itemsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, galrcalist_setting_itemsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGalrcalist_setting_itemsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the galrcalist_setting_items model
   */
  readonly fields: galrcalist_setting_itemsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for galrcalist_setting_items.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__galrcalist_setting_itemsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the galrcalist_setting_items model
   */
  interface galrcalist_setting_itemsFieldRefs {
    readonly key: FieldRef<"galrcalist_setting_items", 'String'>
    readonly value: FieldRef<"galrcalist_setting_items", 'String'>
    readonly help: FieldRef<"galrcalist_setting_items", 'String'>
    readonly type: FieldRef<"galrcalist_setting_items", 'String'>
    readonly options: FieldRef<"galrcalist_setting_items", 'String'>
    readonly group: FieldRef<"galrcalist_setting_items", 'Int'>
    readonly flag: FieldRef<"galrcalist_setting_items", 'Int'>
    readonly index: FieldRef<"galrcalist_setting_items", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * galrcalist_setting_items findUnique
   */
  export type galrcalist_setting_itemsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_setting_items to fetch.
     */
    where: galrcalist_setting_itemsWhereUniqueInput
  }

  /**
   * galrcalist_setting_items findUniqueOrThrow
   */
  export type galrcalist_setting_itemsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_setting_items to fetch.
     */
    where: galrcalist_setting_itemsWhereUniqueInput
  }

  /**
   * galrcalist_setting_items findFirst
   */
  export type galrcalist_setting_itemsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_setting_items to fetch.
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_setting_items to fetch.
     */
    orderBy?: galrcalist_setting_itemsOrderByWithRelationInput | galrcalist_setting_itemsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_setting_items.
     */
    cursor?: galrcalist_setting_itemsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_setting_items from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_setting_items.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_setting_items.
     */
    distinct?: Galrcalist_setting_itemsScalarFieldEnum | Galrcalist_setting_itemsScalarFieldEnum[]
  }

  /**
   * galrcalist_setting_items findFirstOrThrow
   */
  export type galrcalist_setting_itemsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_setting_items to fetch.
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_setting_items to fetch.
     */
    orderBy?: galrcalist_setting_itemsOrderByWithRelationInput | galrcalist_setting_itemsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_setting_items.
     */
    cursor?: galrcalist_setting_itemsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_setting_items from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_setting_items.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_setting_items.
     */
    distinct?: Galrcalist_setting_itemsScalarFieldEnum | Galrcalist_setting_itemsScalarFieldEnum[]
  }

  /**
   * galrcalist_setting_items findMany
   */
  export type galrcalist_setting_itemsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_setting_items to fetch.
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_setting_items to fetch.
     */
    orderBy?: galrcalist_setting_itemsOrderByWithRelationInput | galrcalist_setting_itemsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing galrcalist_setting_items.
     */
    cursor?: galrcalist_setting_itemsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_setting_items from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_setting_items.
     */
    skip?: number
    distinct?: Galrcalist_setting_itemsScalarFieldEnum | Galrcalist_setting_itemsScalarFieldEnum[]
  }

  /**
   * galrcalist_setting_items create
   */
  export type galrcalist_setting_itemsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * The data needed to create a galrcalist_setting_items.
     */
    data: XOR<galrcalist_setting_itemsCreateInput, galrcalist_setting_itemsUncheckedCreateInput>
  }

  /**
   * galrcalist_setting_items createMany
   */
  export type galrcalist_setting_itemsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many galrcalist_setting_items.
     */
    data: galrcalist_setting_itemsCreateManyInput | galrcalist_setting_itemsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_setting_items createManyAndReturn
   */
  export type galrcalist_setting_itemsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * The data used to create many galrcalist_setting_items.
     */
    data: galrcalist_setting_itemsCreateManyInput | galrcalist_setting_itemsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_setting_items update
   */
  export type galrcalist_setting_itemsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * The data needed to update a galrcalist_setting_items.
     */
    data: XOR<galrcalist_setting_itemsUpdateInput, galrcalist_setting_itemsUncheckedUpdateInput>
    /**
     * Choose, which galrcalist_setting_items to update.
     */
    where: galrcalist_setting_itemsWhereUniqueInput
  }

  /**
   * galrcalist_setting_items updateMany
   */
  export type galrcalist_setting_itemsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update galrcalist_setting_items.
     */
    data: XOR<galrcalist_setting_itemsUpdateManyMutationInput, galrcalist_setting_itemsUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_setting_items to update
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * Limit how many galrcalist_setting_items to update.
     */
    limit?: number
  }

  /**
   * galrcalist_setting_items updateManyAndReturn
   */
  export type galrcalist_setting_itemsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * The data used to update galrcalist_setting_items.
     */
    data: XOR<galrcalist_setting_itemsUpdateManyMutationInput, galrcalist_setting_itemsUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_setting_items to update
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * Limit how many galrcalist_setting_items to update.
     */
    limit?: number
  }

  /**
   * galrcalist_setting_items upsert
   */
  export type galrcalist_setting_itemsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * The filter to search for the galrcalist_setting_items to update in case it exists.
     */
    where: galrcalist_setting_itemsWhereUniqueInput
    /**
     * In case the galrcalist_setting_items found by the `where` argument doesn't exist, create a new galrcalist_setting_items with this data.
     */
    create: XOR<galrcalist_setting_itemsCreateInput, galrcalist_setting_itemsUncheckedCreateInput>
    /**
     * In case the galrcalist_setting_items was found with the provided `where` argument, update it with this data.
     */
    update: XOR<galrcalist_setting_itemsUpdateInput, galrcalist_setting_itemsUncheckedUpdateInput>
  }

  /**
   * galrcalist_setting_items delete
   */
  export type galrcalist_setting_itemsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
    /**
     * Filter which galrcalist_setting_items to delete.
     */
    where: galrcalist_setting_itemsWhereUniqueInput
  }

  /**
   * galrcalist_setting_items deleteMany
   */
  export type galrcalist_setting_itemsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_setting_items to delete
     */
    where?: galrcalist_setting_itemsWhereInput
    /**
     * Limit how many galrcalist_setting_items to delete.
     */
    limit?: number
  }

  /**
   * galrcalist_setting_items without action
   */
  export type galrcalist_setting_itemsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_setting_items
     */
    select?: galrcalist_setting_itemsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_setting_items
     */
    omit?: galrcalist_setting_itemsOmit<ExtArgs> | null
  }


  /**
   * Model galrcalist_meta
   */

  export type AggregateGalrcalist_meta = {
    _count: Galrcalist_metaCountAggregateOutputType | null
    _avg: Galrcalist_metaAvgAggregateOutputType | null
    _sum: Galrcalist_metaSumAggregateOutputType | null
    _min: Galrcalist_metaMinAggregateOutputType | null
    _max: Galrcalist_metaMaxAggregateOutputType | null
  }

  export type Galrcalist_metaAvgAggregateOutputType = {
    id: number | null
  }

  export type Galrcalist_metaSumAggregateOutputType = {
    id: number | null
  }

  export type Galrcalist_metaMinAggregateOutputType = {
    id: number | null
    path: string | null
    password: string | null
    p_sub: boolean | null
    write: boolean | null
    w_sub: boolean | null
    hide: string | null
    h_sub: boolean | null
    readme: string | null
    r_sub: boolean | null
    header: string | null
    header_sub: boolean | null
  }

  export type Galrcalist_metaMaxAggregateOutputType = {
    id: number | null
    path: string | null
    password: string | null
    p_sub: boolean | null
    write: boolean | null
    w_sub: boolean | null
    hide: string | null
    h_sub: boolean | null
    readme: string | null
    r_sub: boolean | null
    header: string | null
    header_sub: boolean | null
  }

  export type Galrcalist_metaCountAggregateOutputType = {
    id: number
    path: number
    password: number
    p_sub: number
    write: number
    w_sub: number
    hide: number
    h_sub: number
    readme: number
    r_sub: number
    header: number
    header_sub: number
    _all: number
  }


  export type Galrcalist_metaAvgAggregateInputType = {
    id?: true
  }

  export type Galrcalist_metaSumAggregateInputType = {
    id?: true
  }

  export type Galrcalist_metaMinAggregateInputType = {
    id?: true
    path?: true
    password?: true
    p_sub?: true
    write?: true
    w_sub?: true
    hide?: true
    h_sub?: true
    readme?: true
    r_sub?: true
    header?: true
    header_sub?: true
  }

  export type Galrcalist_metaMaxAggregateInputType = {
    id?: true
    path?: true
    password?: true
    p_sub?: true
    write?: true
    w_sub?: true
    hide?: true
    h_sub?: true
    readme?: true
    r_sub?: true
    header?: true
    header_sub?: true
  }

  export type Galrcalist_metaCountAggregateInputType = {
    id?: true
    path?: true
    password?: true
    p_sub?: true
    write?: true
    w_sub?: true
    hide?: true
    h_sub?: true
    readme?: true
    r_sub?: true
    header?: true
    header_sub?: true
    _all?: true
  }

  export type Galrcalist_metaAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_meta to aggregate.
     */
    where?: galrcalist_metaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_metas to fetch.
     */
    orderBy?: galrcalist_metaOrderByWithRelationInput | galrcalist_metaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: galrcalist_metaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_metas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_metas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned galrcalist_metas
    **/
    _count?: true | Galrcalist_metaCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Galrcalist_metaAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Galrcalist_metaSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Galrcalist_metaMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Galrcalist_metaMaxAggregateInputType
  }

  export type GetGalrcalist_metaAggregateType<T extends Galrcalist_metaAggregateArgs> = {
        [P in keyof T & keyof AggregateGalrcalist_meta]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGalrcalist_meta[P]>
      : GetScalarType<T[P], AggregateGalrcalist_meta[P]>
  }




  export type galrcalist_metaGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: galrcalist_metaWhereInput
    orderBy?: galrcalist_metaOrderByWithAggregationInput | galrcalist_metaOrderByWithAggregationInput[]
    by: Galrcalist_metaScalarFieldEnum[] | Galrcalist_metaScalarFieldEnum
    having?: galrcalist_metaScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Galrcalist_metaCountAggregateInputType | true
    _avg?: Galrcalist_metaAvgAggregateInputType
    _sum?: Galrcalist_metaSumAggregateInputType
    _min?: Galrcalist_metaMinAggregateInputType
    _max?: Galrcalist_metaMaxAggregateInputType
  }

  export type Galrcalist_metaGroupByOutputType = {
    id: number
    path: string
    password: string
    p_sub: boolean
    write: boolean
    w_sub: boolean
    hide: string
    h_sub: boolean
    readme: string
    r_sub: boolean
    header: string
    header_sub: boolean
    _count: Galrcalist_metaCountAggregateOutputType | null
    _avg: Galrcalist_metaAvgAggregateOutputType | null
    _sum: Galrcalist_metaSumAggregateOutputType | null
    _min: Galrcalist_metaMinAggregateOutputType | null
    _max: Galrcalist_metaMaxAggregateOutputType | null
  }

  type GetGalrcalist_metaGroupByPayload<T extends galrcalist_metaGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Galrcalist_metaGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Galrcalist_metaGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Galrcalist_metaGroupByOutputType[P]>
            : GetScalarType<T[P], Galrcalist_metaGroupByOutputType[P]>
        }
      >
    >


  export type galrcalist_metaSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    path?: boolean
    password?: boolean
    p_sub?: boolean
    write?: boolean
    w_sub?: boolean
    hide?: boolean
    h_sub?: boolean
    readme?: boolean
    r_sub?: boolean
    header?: boolean
    header_sub?: boolean
  }, ExtArgs["result"]["galrcalist_meta"]>

  export type galrcalist_metaSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    path?: boolean
    password?: boolean
    p_sub?: boolean
    write?: boolean
    w_sub?: boolean
    hide?: boolean
    h_sub?: boolean
    readme?: boolean
    r_sub?: boolean
    header?: boolean
    header_sub?: boolean
  }, ExtArgs["result"]["galrcalist_meta"]>

  export type galrcalist_metaSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    path?: boolean
    password?: boolean
    p_sub?: boolean
    write?: boolean
    w_sub?: boolean
    hide?: boolean
    h_sub?: boolean
    readme?: boolean
    r_sub?: boolean
    header?: boolean
    header_sub?: boolean
  }, ExtArgs["result"]["galrcalist_meta"]>

  export type galrcalist_metaSelectScalar = {
    id?: boolean
    path?: boolean
    password?: boolean
    p_sub?: boolean
    write?: boolean
    w_sub?: boolean
    hide?: boolean
    h_sub?: boolean
    readme?: boolean
    r_sub?: boolean
    header?: boolean
    header_sub?: boolean
  }

  export type galrcalist_metaOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "path" | "password" | "p_sub" | "write" | "w_sub" | "hide" | "h_sub" | "readme" | "r_sub" | "header" | "header_sub", ExtArgs["result"]["galrcalist_meta"]>

  export type $galrcalist_metaPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "galrcalist_meta"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      path: string
      password: string
      p_sub: boolean
      write: boolean
      w_sub: boolean
      hide: string
      h_sub: boolean
      readme: string
      r_sub: boolean
      header: string
      header_sub: boolean
    }, ExtArgs["result"]["galrcalist_meta"]>
    composites: {}
  }

  type galrcalist_metaGetPayload<S extends boolean | null | undefined | galrcalist_metaDefaultArgs> = $Result.GetResult<Prisma.$galrcalist_metaPayload, S>

  type galrcalist_metaCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<galrcalist_metaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Galrcalist_metaCountAggregateInputType | true
    }

  export interface galrcalist_metaDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['galrcalist_meta'], meta: { name: 'galrcalist_meta' } }
    /**
     * Find zero or one Galrcalist_meta that matches the filter.
     * @param {galrcalist_metaFindUniqueArgs} args - Arguments to find a Galrcalist_meta
     * @example
     * // Get one Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends galrcalist_metaFindUniqueArgs>(args: SelectSubset<T, galrcalist_metaFindUniqueArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Galrcalist_meta that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {galrcalist_metaFindUniqueOrThrowArgs} args - Arguments to find a Galrcalist_meta
     * @example
     * // Get one Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends galrcalist_metaFindUniqueOrThrowArgs>(args: SelectSubset<T, galrcalist_metaFindUniqueOrThrowArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_meta that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaFindFirstArgs} args - Arguments to find a Galrcalist_meta
     * @example
     * // Get one Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends galrcalist_metaFindFirstArgs>(args?: SelectSubset<T, galrcalist_metaFindFirstArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Galrcalist_meta that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaFindFirstOrThrowArgs} args - Arguments to find a Galrcalist_meta
     * @example
     * // Get one Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends galrcalist_metaFindFirstOrThrowArgs>(args?: SelectSubset<T, galrcalist_metaFindFirstOrThrowArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Galrcalist_metas that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Galrcalist_metas
     * const galrcalist_metas = await prisma.galrcalist_meta.findMany()
     * 
     * // Get first 10 Galrcalist_metas
     * const galrcalist_metas = await prisma.galrcalist_meta.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const galrcalist_metaWithIdOnly = await prisma.galrcalist_meta.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends galrcalist_metaFindManyArgs>(args?: SelectSubset<T, galrcalist_metaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Galrcalist_meta.
     * @param {galrcalist_metaCreateArgs} args - Arguments to create a Galrcalist_meta.
     * @example
     * // Create one Galrcalist_meta
     * const Galrcalist_meta = await prisma.galrcalist_meta.create({
     *   data: {
     *     // ... data to create a Galrcalist_meta
     *   }
     * })
     * 
     */
    create<T extends galrcalist_metaCreateArgs>(args: SelectSubset<T, galrcalist_metaCreateArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Galrcalist_metas.
     * @param {galrcalist_metaCreateManyArgs} args - Arguments to create many Galrcalist_metas.
     * @example
     * // Create many Galrcalist_metas
     * const galrcalist_meta = await prisma.galrcalist_meta.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends galrcalist_metaCreateManyArgs>(args?: SelectSubset<T, galrcalist_metaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Galrcalist_metas and returns the data saved in the database.
     * @param {galrcalist_metaCreateManyAndReturnArgs} args - Arguments to create many Galrcalist_metas.
     * @example
     * // Create many Galrcalist_metas
     * const galrcalist_meta = await prisma.galrcalist_meta.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Galrcalist_metas and only return the `id`
     * const galrcalist_metaWithIdOnly = await prisma.galrcalist_meta.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends galrcalist_metaCreateManyAndReturnArgs>(args?: SelectSubset<T, galrcalist_metaCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Galrcalist_meta.
     * @param {galrcalist_metaDeleteArgs} args - Arguments to delete one Galrcalist_meta.
     * @example
     * // Delete one Galrcalist_meta
     * const Galrcalist_meta = await prisma.galrcalist_meta.delete({
     *   where: {
     *     // ... filter to delete one Galrcalist_meta
     *   }
     * })
     * 
     */
    delete<T extends galrcalist_metaDeleteArgs>(args: SelectSubset<T, galrcalist_metaDeleteArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Galrcalist_meta.
     * @param {galrcalist_metaUpdateArgs} args - Arguments to update one Galrcalist_meta.
     * @example
     * // Update one Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends galrcalist_metaUpdateArgs>(args: SelectSubset<T, galrcalist_metaUpdateArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Galrcalist_metas.
     * @param {galrcalist_metaDeleteManyArgs} args - Arguments to filter Galrcalist_metas to delete.
     * @example
     * // Delete a few Galrcalist_metas
     * const { count } = await prisma.galrcalist_meta.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends galrcalist_metaDeleteManyArgs>(args?: SelectSubset<T, galrcalist_metaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_metas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Galrcalist_metas
     * const galrcalist_meta = await prisma.galrcalist_meta.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends galrcalist_metaUpdateManyArgs>(args: SelectSubset<T, galrcalist_metaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Galrcalist_metas and returns the data updated in the database.
     * @param {galrcalist_metaUpdateManyAndReturnArgs} args - Arguments to update many Galrcalist_metas.
     * @example
     * // Update many Galrcalist_metas
     * const galrcalist_meta = await prisma.galrcalist_meta.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Galrcalist_metas and only return the `id`
     * const galrcalist_metaWithIdOnly = await prisma.galrcalist_meta.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends galrcalist_metaUpdateManyAndReturnArgs>(args: SelectSubset<T, galrcalist_metaUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Galrcalist_meta.
     * @param {galrcalist_metaUpsertArgs} args - Arguments to update or create a Galrcalist_meta.
     * @example
     * // Update or create a Galrcalist_meta
     * const galrcalist_meta = await prisma.galrcalist_meta.upsert({
     *   create: {
     *     // ... data to create a Galrcalist_meta
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Galrcalist_meta we want to update
     *   }
     * })
     */
    upsert<T extends galrcalist_metaUpsertArgs>(args: SelectSubset<T, galrcalist_metaUpsertArgs<ExtArgs>>): Prisma__galrcalist_metaClient<$Result.GetResult<Prisma.$galrcalist_metaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Galrcalist_metas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaCountArgs} args - Arguments to filter Galrcalist_metas to count.
     * @example
     * // Count the number of Galrcalist_metas
     * const count = await prisma.galrcalist_meta.count({
     *   where: {
     *     // ... the filter for the Galrcalist_metas we want to count
     *   }
     * })
    **/
    count<T extends galrcalist_metaCountArgs>(
      args?: Subset<T, galrcalist_metaCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Galrcalist_metaCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Galrcalist_meta.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Galrcalist_metaAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Galrcalist_metaAggregateArgs>(args: Subset<T, Galrcalist_metaAggregateArgs>): Prisma.PrismaPromise<GetGalrcalist_metaAggregateType<T>>

    /**
     * Group by Galrcalist_meta.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galrcalist_metaGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends galrcalist_metaGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: galrcalist_metaGroupByArgs['orderBy'] }
        : { orderBy?: galrcalist_metaGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, galrcalist_metaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGalrcalist_metaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the galrcalist_meta model
   */
  readonly fields: galrcalist_metaFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for galrcalist_meta.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__galrcalist_metaClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the galrcalist_meta model
   */
  interface galrcalist_metaFieldRefs {
    readonly id: FieldRef<"galrcalist_meta", 'Int'>
    readonly path: FieldRef<"galrcalist_meta", 'String'>
    readonly password: FieldRef<"galrcalist_meta", 'String'>
    readonly p_sub: FieldRef<"galrcalist_meta", 'Boolean'>
    readonly write: FieldRef<"galrcalist_meta", 'Boolean'>
    readonly w_sub: FieldRef<"galrcalist_meta", 'Boolean'>
    readonly hide: FieldRef<"galrcalist_meta", 'String'>
    readonly h_sub: FieldRef<"galrcalist_meta", 'Boolean'>
    readonly readme: FieldRef<"galrcalist_meta", 'String'>
    readonly r_sub: FieldRef<"galrcalist_meta", 'Boolean'>
    readonly header: FieldRef<"galrcalist_meta", 'String'>
    readonly header_sub: FieldRef<"galrcalist_meta", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * galrcalist_meta findUnique
   */
  export type galrcalist_metaFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_meta to fetch.
     */
    where: galrcalist_metaWhereUniqueInput
  }

  /**
   * galrcalist_meta findUniqueOrThrow
   */
  export type galrcalist_metaFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_meta to fetch.
     */
    where: galrcalist_metaWhereUniqueInput
  }

  /**
   * galrcalist_meta findFirst
   */
  export type galrcalist_metaFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_meta to fetch.
     */
    where?: galrcalist_metaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_metas to fetch.
     */
    orderBy?: galrcalist_metaOrderByWithRelationInput | galrcalist_metaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_metas.
     */
    cursor?: galrcalist_metaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_metas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_metas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_metas.
     */
    distinct?: Galrcalist_metaScalarFieldEnum | Galrcalist_metaScalarFieldEnum[]
  }

  /**
   * galrcalist_meta findFirstOrThrow
   */
  export type galrcalist_metaFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_meta to fetch.
     */
    where?: galrcalist_metaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_metas to fetch.
     */
    orderBy?: galrcalist_metaOrderByWithRelationInput | galrcalist_metaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galrcalist_metas.
     */
    cursor?: galrcalist_metaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_metas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_metas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galrcalist_metas.
     */
    distinct?: Galrcalist_metaScalarFieldEnum | Galrcalist_metaScalarFieldEnum[]
  }

  /**
   * galrcalist_meta findMany
   */
  export type galrcalist_metaFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter, which galrcalist_metas to fetch.
     */
    where?: galrcalist_metaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galrcalist_metas to fetch.
     */
    orderBy?: galrcalist_metaOrderByWithRelationInput | galrcalist_metaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing galrcalist_metas.
     */
    cursor?: galrcalist_metaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galrcalist_metas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galrcalist_metas.
     */
    skip?: number
    distinct?: Galrcalist_metaScalarFieldEnum | Galrcalist_metaScalarFieldEnum[]
  }

  /**
   * galrcalist_meta create
   */
  export type galrcalist_metaCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * The data needed to create a galrcalist_meta.
     */
    data: XOR<galrcalist_metaCreateInput, galrcalist_metaUncheckedCreateInput>
  }

  /**
   * galrcalist_meta createMany
   */
  export type galrcalist_metaCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many galrcalist_metas.
     */
    data: galrcalist_metaCreateManyInput | galrcalist_metaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_meta createManyAndReturn
   */
  export type galrcalist_metaCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * The data used to create many galrcalist_metas.
     */
    data: galrcalist_metaCreateManyInput | galrcalist_metaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galrcalist_meta update
   */
  export type galrcalist_metaUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * The data needed to update a galrcalist_meta.
     */
    data: XOR<galrcalist_metaUpdateInput, galrcalist_metaUncheckedUpdateInput>
    /**
     * Choose, which galrcalist_meta to update.
     */
    where: galrcalist_metaWhereUniqueInput
  }

  /**
   * galrcalist_meta updateMany
   */
  export type galrcalist_metaUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update galrcalist_metas.
     */
    data: XOR<galrcalist_metaUpdateManyMutationInput, galrcalist_metaUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_metas to update
     */
    where?: galrcalist_metaWhereInput
    /**
     * Limit how many galrcalist_metas to update.
     */
    limit?: number
  }

  /**
   * galrcalist_meta updateManyAndReturn
   */
  export type galrcalist_metaUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * The data used to update galrcalist_metas.
     */
    data: XOR<galrcalist_metaUpdateManyMutationInput, galrcalist_metaUncheckedUpdateManyInput>
    /**
     * Filter which galrcalist_metas to update
     */
    where?: galrcalist_metaWhereInput
    /**
     * Limit how many galrcalist_metas to update.
     */
    limit?: number
  }

  /**
   * galrcalist_meta upsert
   */
  export type galrcalist_metaUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * The filter to search for the galrcalist_meta to update in case it exists.
     */
    where: galrcalist_metaWhereUniqueInput
    /**
     * In case the galrcalist_meta found by the `where` argument doesn't exist, create a new galrcalist_meta with this data.
     */
    create: XOR<galrcalist_metaCreateInput, galrcalist_metaUncheckedCreateInput>
    /**
     * In case the galrcalist_meta was found with the provided `where` argument, update it with this data.
     */
    update: XOR<galrcalist_metaUpdateInput, galrcalist_metaUncheckedUpdateInput>
  }

  /**
   * galrcalist_meta delete
   */
  export type galrcalist_metaDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
    /**
     * Filter which galrcalist_meta to delete.
     */
    where: galrcalist_metaWhereUniqueInput
  }

  /**
   * galrcalist_meta deleteMany
   */
  export type galrcalist_metaDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galrcalist_metas to delete
     */
    where?: galrcalist_metaWhereInput
    /**
     * Limit how many galrcalist_metas to delete.
     */
    limit?: number
  }

  /**
   * galrcalist_meta without action
   */
  export type galrcalist_metaDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galrcalist_meta
     */
    select?: galrcalist_metaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galrcalist_meta
     */
    omit?: galrcalist_metaOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const Galrcalist_search_nodesScalarFieldEnum: {
    parent: 'parent',
    name: 'name',
    is_dir: 'is_dir',
    size: 'size'
  };

  export type Galrcalist_search_nodesScalarFieldEnum = (typeof Galrcalist_search_nodesScalarFieldEnum)[keyof typeof Galrcalist_search_nodesScalarFieldEnum]


  export const Galrcalist_setting_itemsScalarFieldEnum: {
    key: 'key',
    value: 'value',
    help: 'help',
    type: 'type',
    options: 'options',
    group: 'group',
    flag: 'flag',
    index: 'index'
  };

  export type Galrcalist_setting_itemsScalarFieldEnum = (typeof Galrcalist_setting_itemsScalarFieldEnum)[keyof typeof Galrcalist_setting_itemsScalarFieldEnum]


  export const Galrcalist_metaScalarFieldEnum: {
    id: 'id',
    path: 'path',
    password: 'password',
    p_sub: 'p_sub',
    write: 'write',
    w_sub: 'w_sub',
    hide: 'hide',
    h_sub: 'h_sub',
    readme: 'readme',
    r_sub: 'r_sub',
    header: 'header',
    header_sub: 'header_sub'
  };

  export type Galrcalist_metaScalarFieldEnum = (typeof Galrcalist_metaScalarFieldEnum)[keyof typeof Galrcalist_metaScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type galrcalist_search_nodesWhereInput = {
    AND?: galrcalist_search_nodesWhereInput | galrcalist_search_nodesWhereInput[]
    OR?: galrcalist_search_nodesWhereInput[]
    NOT?: galrcalist_search_nodesWhereInput | galrcalist_search_nodesWhereInput[]
    parent?: StringFilter<"galrcalist_search_nodes"> | string
    name?: StringFilter<"galrcalist_search_nodes"> | string
    is_dir?: BoolFilter<"galrcalist_search_nodes"> | boolean
    size?: IntFilter<"galrcalist_search_nodes"> | number
  }

  export type galrcalist_search_nodesOrderByWithRelationInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galrcalist_search_nodesWhereUniqueInput = Prisma.AtLeast<{
    parent_name?: galrcalist_search_nodesParentNameCompoundUniqueInput
    AND?: galrcalist_search_nodesWhereInput | galrcalist_search_nodesWhereInput[]
    OR?: galrcalist_search_nodesWhereInput[]
    NOT?: galrcalist_search_nodesWhereInput | galrcalist_search_nodesWhereInput[]
    parent?: StringFilter<"galrcalist_search_nodes"> | string
    name?: StringFilter<"galrcalist_search_nodes"> | string
    is_dir?: BoolFilter<"galrcalist_search_nodes"> | boolean
    size?: IntFilter<"galrcalist_search_nodes"> | number
  }, "parent_name">

  export type galrcalist_search_nodesOrderByWithAggregationInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
    _count?: galrcalist_search_nodesCountOrderByAggregateInput
    _avg?: galrcalist_search_nodesAvgOrderByAggregateInput
    _max?: galrcalist_search_nodesMaxOrderByAggregateInput
    _min?: galrcalist_search_nodesMinOrderByAggregateInput
    _sum?: galrcalist_search_nodesSumOrderByAggregateInput
  }

  export type galrcalist_search_nodesScalarWhereWithAggregatesInput = {
    AND?: galrcalist_search_nodesScalarWhereWithAggregatesInput | galrcalist_search_nodesScalarWhereWithAggregatesInput[]
    OR?: galrcalist_search_nodesScalarWhereWithAggregatesInput[]
    NOT?: galrcalist_search_nodesScalarWhereWithAggregatesInput | galrcalist_search_nodesScalarWhereWithAggregatesInput[]
    parent?: StringWithAggregatesFilter<"galrcalist_search_nodes"> | string
    name?: StringWithAggregatesFilter<"galrcalist_search_nodes"> | string
    is_dir?: BoolWithAggregatesFilter<"galrcalist_search_nodes"> | boolean
    size?: IntWithAggregatesFilter<"galrcalist_search_nodes"> | number
  }

  export type galrcalist_setting_itemsWhereInput = {
    AND?: galrcalist_setting_itemsWhereInput | galrcalist_setting_itemsWhereInput[]
    OR?: galrcalist_setting_itemsWhereInput[]
    NOT?: galrcalist_setting_itemsWhereInput | galrcalist_setting_itemsWhereInput[]
    key?: StringFilter<"galrcalist_setting_items"> | string
    value?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    help?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    type?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    options?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    group?: IntNullableFilter<"galrcalist_setting_items"> | number | null
    flag?: IntNullableFilter<"galrcalist_setting_items"> | number | null
    index?: IntNullableFilter<"galrcalist_setting_items"> | number | null
  }

  export type galrcalist_setting_itemsOrderByWithRelationInput = {
    key?: SortOrder
    value?: SortOrderInput | SortOrder
    help?: SortOrderInput | SortOrder
    type?: SortOrderInput | SortOrder
    options?: SortOrderInput | SortOrder
    group?: SortOrderInput | SortOrder
    flag?: SortOrderInput | SortOrder
    index?: SortOrderInput | SortOrder
  }

  export type galrcalist_setting_itemsWhereUniqueInput = Prisma.AtLeast<{
    key?: string
    AND?: galrcalist_setting_itemsWhereInput | galrcalist_setting_itemsWhereInput[]
    OR?: galrcalist_setting_itemsWhereInput[]
    NOT?: galrcalist_setting_itemsWhereInput | galrcalist_setting_itemsWhereInput[]
    value?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    help?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    type?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    options?: StringNullableFilter<"galrcalist_setting_items"> | string | null
    group?: IntNullableFilter<"galrcalist_setting_items"> | number | null
    flag?: IntNullableFilter<"galrcalist_setting_items"> | number | null
    index?: IntNullableFilter<"galrcalist_setting_items"> | number | null
  }, "key">

  export type galrcalist_setting_itemsOrderByWithAggregationInput = {
    key?: SortOrder
    value?: SortOrderInput | SortOrder
    help?: SortOrderInput | SortOrder
    type?: SortOrderInput | SortOrder
    options?: SortOrderInput | SortOrder
    group?: SortOrderInput | SortOrder
    flag?: SortOrderInput | SortOrder
    index?: SortOrderInput | SortOrder
    _count?: galrcalist_setting_itemsCountOrderByAggregateInput
    _avg?: galrcalist_setting_itemsAvgOrderByAggregateInput
    _max?: galrcalist_setting_itemsMaxOrderByAggregateInput
    _min?: galrcalist_setting_itemsMinOrderByAggregateInput
    _sum?: galrcalist_setting_itemsSumOrderByAggregateInput
  }

  export type galrcalist_setting_itemsScalarWhereWithAggregatesInput = {
    AND?: galrcalist_setting_itemsScalarWhereWithAggregatesInput | galrcalist_setting_itemsScalarWhereWithAggregatesInput[]
    OR?: galrcalist_setting_itemsScalarWhereWithAggregatesInput[]
    NOT?: galrcalist_setting_itemsScalarWhereWithAggregatesInput | galrcalist_setting_itemsScalarWhereWithAggregatesInput[]
    key?: StringWithAggregatesFilter<"galrcalist_setting_items"> | string
    value?: StringNullableWithAggregatesFilter<"galrcalist_setting_items"> | string | null
    help?: StringNullableWithAggregatesFilter<"galrcalist_setting_items"> | string | null
    type?: StringNullableWithAggregatesFilter<"galrcalist_setting_items"> | string | null
    options?: StringNullableWithAggregatesFilter<"galrcalist_setting_items"> | string | null
    group?: IntNullableWithAggregatesFilter<"galrcalist_setting_items"> | number | null
    flag?: IntNullableWithAggregatesFilter<"galrcalist_setting_items"> | number | null
    index?: IntNullableWithAggregatesFilter<"galrcalist_setting_items"> | number | null
  }

  export type galrcalist_metaWhereInput = {
    AND?: galrcalist_metaWhereInput | galrcalist_metaWhereInput[]
    OR?: galrcalist_metaWhereInput[]
    NOT?: galrcalist_metaWhereInput | galrcalist_metaWhereInput[]
    id?: IntFilter<"galrcalist_meta"> | number
    path?: StringFilter<"galrcalist_meta"> | string
    password?: StringFilter<"galrcalist_meta"> | string
    p_sub?: BoolFilter<"galrcalist_meta"> | boolean
    write?: BoolFilter<"galrcalist_meta"> | boolean
    w_sub?: BoolFilter<"galrcalist_meta"> | boolean
    hide?: StringFilter<"galrcalist_meta"> | string
    h_sub?: BoolFilter<"galrcalist_meta"> | boolean
    readme?: StringFilter<"galrcalist_meta"> | string
    r_sub?: BoolFilter<"galrcalist_meta"> | boolean
    header?: StringFilter<"galrcalist_meta"> | string
    header_sub?: BoolFilter<"galrcalist_meta"> | boolean
  }

  export type galrcalist_metaOrderByWithRelationInput = {
    id?: SortOrder
    path?: SortOrder
    password?: SortOrder
    p_sub?: SortOrder
    write?: SortOrder
    w_sub?: SortOrder
    hide?: SortOrder
    h_sub?: SortOrder
    readme?: SortOrder
    r_sub?: SortOrder
    header?: SortOrder
    header_sub?: SortOrder
  }

  export type galrcalist_metaWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: galrcalist_metaWhereInput | galrcalist_metaWhereInput[]
    OR?: galrcalist_metaWhereInput[]
    NOT?: galrcalist_metaWhereInput | galrcalist_metaWhereInput[]
    path?: StringFilter<"galrcalist_meta"> | string
    password?: StringFilter<"galrcalist_meta"> | string
    p_sub?: BoolFilter<"galrcalist_meta"> | boolean
    write?: BoolFilter<"galrcalist_meta"> | boolean
    w_sub?: BoolFilter<"galrcalist_meta"> | boolean
    hide?: StringFilter<"galrcalist_meta"> | string
    h_sub?: BoolFilter<"galrcalist_meta"> | boolean
    readme?: StringFilter<"galrcalist_meta"> | string
    r_sub?: BoolFilter<"galrcalist_meta"> | boolean
    header?: StringFilter<"galrcalist_meta"> | string
    header_sub?: BoolFilter<"galrcalist_meta"> | boolean
  }, "id">

  export type galrcalist_metaOrderByWithAggregationInput = {
    id?: SortOrder
    path?: SortOrder
    password?: SortOrder
    p_sub?: SortOrder
    write?: SortOrder
    w_sub?: SortOrder
    hide?: SortOrder
    h_sub?: SortOrder
    readme?: SortOrder
    r_sub?: SortOrder
    header?: SortOrder
    header_sub?: SortOrder
    _count?: galrcalist_metaCountOrderByAggregateInput
    _avg?: galrcalist_metaAvgOrderByAggregateInput
    _max?: galrcalist_metaMaxOrderByAggregateInput
    _min?: galrcalist_metaMinOrderByAggregateInput
    _sum?: galrcalist_metaSumOrderByAggregateInput
  }

  export type galrcalist_metaScalarWhereWithAggregatesInput = {
    AND?: galrcalist_metaScalarWhereWithAggregatesInput | galrcalist_metaScalarWhereWithAggregatesInput[]
    OR?: galrcalist_metaScalarWhereWithAggregatesInput[]
    NOT?: galrcalist_metaScalarWhereWithAggregatesInput | galrcalist_metaScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"galrcalist_meta"> | number
    path?: StringWithAggregatesFilter<"galrcalist_meta"> | string
    password?: StringWithAggregatesFilter<"galrcalist_meta"> | string
    p_sub?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
    write?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
    w_sub?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
    hide?: StringWithAggregatesFilter<"galrcalist_meta"> | string
    h_sub?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
    readme?: StringWithAggregatesFilter<"galrcalist_meta"> | string
    r_sub?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
    header?: StringWithAggregatesFilter<"galrcalist_meta"> | string
    header_sub?: BoolWithAggregatesFilter<"galrcalist_meta"> | boolean
  }

  export type galrcalist_search_nodesCreateInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galrcalist_search_nodesUncheckedCreateInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galrcalist_search_nodesUpdateInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galrcalist_search_nodesUncheckedUpdateInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galrcalist_search_nodesCreateManyInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galrcalist_search_nodesUpdateManyMutationInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galrcalist_search_nodesUncheckedUpdateManyInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galrcalist_setting_itemsCreateInput = {
    key: string
    value?: string | null
    help?: string | null
    type?: string | null
    options?: string | null
    group?: number | null
    flag?: number | null
    index?: number | null
  }

  export type galrcalist_setting_itemsUncheckedCreateInput = {
    key: string
    value?: string | null
    help?: string | null
    type?: string | null
    options?: string | null
    group?: number | null
    flag?: number | null
    index?: number | null
  }

  export type galrcalist_setting_itemsUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    help?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    options?: NullableStringFieldUpdateOperationsInput | string | null
    group?: NullableIntFieldUpdateOperationsInput | number | null
    flag?: NullableIntFieldUpdateOperationsInput | number | null
    index?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type galrcalist_setting_itemsUncheckedUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    help?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    options?: NullableStringFieldUpdateOperationsInput | string | null
    group?: NullableIntFieldUpdateOperationsInput | number | null
    flag?: NullableIntFieldUpdateOperationsInput | number | null
    index?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type galrcalist_setting_itemsCreateManyInput = {
    key: string
    value?: string | null
    help?: string | null
    type?: string | null
    options?: string | null
    group?: number | null
    flag?: number | null
    index?: number | null
  }

  export type galrcalist_setting_itemsUpdateManyMutationInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    help?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    options?: NullableStringFieldUpdateOperationsInput | string | null
    group?: NullableIntFieldUpdateOperationsInput | number | null
    flag?: NullableIntFieldUpdateOperationsInput | number | null
    index?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type galrcalist_setting_itemsUncheckedUpdateManyInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    help?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    options?: NullableStringFieldUpdateOperationsInput | string | null
    group?: NullableIntFieldUpdateOperationsInput | number | null
    flag?: NullableIntFieldUpdateOperationsInput | number | null
    index?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type galrcalist_metaCreateInput = {
    path: string
    password: string
    p_sub: boolean
    write: boolean
    w_sub: boolean
    hide: string
    h_sub: boolean
    readme: string
    r_sub: boolean
    header: string
    header_sub: boolean
  }

  export type galrcalist_metaUncheckedCreateInput = {
    id?: number
    path: string
    password: string
    p_sub: boolean
    write: boolean
    w_sub: boolean
    hide: string
    h_sub: boolean
    readme: string
    r_sub: boolean
    header: string
    header_sub: boolean
  }

  export type galrcalist_metaUpdateInput = {
    path?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    p_sub?: BoolFieldUpdateOperationsInput | boolean
    write?: BoolFieldUpdateOperationsInput | boolean
    w_sub?: BoolFieldUpdateOperationsInput | boolean
    hide?: StringFieldUpdateOperationsInput | string
    h_sub?: BoolFieldUpdateOperationsInput | boolean
    readme?: StringFieldUpdateOperationsInput | string
    r_sub?: BoolFieldUpdateOperationsInput | boolean
    header?: StringFieldUpdateOperationsInput | string
    header_sub?: BoolFieldUpdateOperationsInput | boolean
  }

  export type galrcalist_metaUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    path?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    p_sub?: BoolFieldUpdateOperationsInput | boolean
    write?: BoolFieldUpdateOperationsInput | boolean
    w_sub?: BoolFieldUpdateOperationsInput | boolean
    hide?: StringFieldUpdateOperationsInput | string
    h_sub?: BoolFieldUpdateOperationsInput | boolean
    readme?: StringFieldUpdateOperationsInput | string
    r_sub?: BoolFieldUpdateOperationsInput | boolean
    header?: StringFieldUpdateOperationsInput | string
    header_sub?: BoolFieldUpdateOperationsInput | boolean
  }

  export type galrcalist_metaCreateManyInput = {
    id?: number
    path: string
    password: string
    p_sub: boolean
    write: boolean
    w_sub: boolean
    hide: string
    h_sub: boolean
    readme: string
    r_sub: boolean
    header: string
    header_sub: boolean
  }

  export type galrcalist_metaUpdateManyMutationInput = {
    path?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    p_sub?: BoolFieldUpdateOperationsInput | boolean
    write?: BoolFieldUpdateOperationsInput | boolean
    w_sub?: BoolFieldUpdateOperationsInput | boolean
    hide?: StringFieldUpdateOperationsInput | string
    h_sub?: BoolFieldUpdateOperationsInput | boolean
    readme?: StringFieldUpdateOperationsInput | string
    r_sub?: BoolFieldUpdateOperationsInput | boolean
    header?: StringFieldUpdateOperationsInput | string
    header_sub?: BoolFieldUpdateOperationsInput | boolean
  }

  export type galrcalist_metaUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    path?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    p_sub?: BoolFieldUpdateOperationsInput | boolean
    write?: BoolFieldUpdateOperationsInput | boolean
    w_sub?: BoolFieldUpdateOperationsInput | boolean
    hide?: StringFieldUpdateOperationsInput | string
    h_sub?: BoolFieldUpdateOperationsInput | boolean
    readme?: StringFieldUpdateOperationsInput | string
    r_sub?: BoolFieldUpdateOperationsInput | boolean
    header?: StringFieldUpdateOperationsInput | string
    header_sub?: BoolFieldUpdateOperationsInput | boolean
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type galrcalist_search_nodesParentNameCompoundUniqueInput = {
    parent: string
    name: string
  }

  export type galrcalist_search_nodesCountOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galrcalist_search_nodesAvgOrderByAggregateInput = {
    size?: SortOrder
  }

  export type galrcalist_search_nodesMaxOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galrcalist_search_nodesMinOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galrcalist_search_nodesSumOrderByAggregateInput = {
    size?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type galrcalist_setting_itemsCountOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    help?: SortOrder
    type?: SortOrder
    options?: SortOrder
    group?: SortOrder
    flag?: SortOrder
    index?: SortOrder
  }

  export type galrcalist_setting_itemsAvgOrderByAggregateInput = {
    group?: SortOrder
    flag?: SortOrder
    index?: SortOrder
  }

  export type galrcalist_setting_itemsMaxOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    help?: SortOrder
    type?: SortOrder
    options?: SortOrder
    group?: SortOrder
    flag?: SortOrder
    index?: SortOrder
  }

  export type galrcalist_setting_itemsMinOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    help?: SortOrder
    type?: SortOrder
    options?: SortOrder
    group?: SortOrder
    flag?: SortOrder
    index?: SortOrder
  }

  export type galrcalist_setting_itemsSumOrderByAggregateInput = {
    group?: SortOrder
    flag?: SortOrder
    index?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type galrcalist_metaCountOrderByAggregateInput = {
    id?: SortOrder
    path?: SortOrder
    password?: SortOrder
    p_sub?: SortOrder
    write?: SortOrder
    w_sub?: SortOrder
    hide?: SortOrder
    h_sub?: SortOrder
    readme?: SortOrder
    r_sub?: SortOrder
    header?: SortOrder
    header_sub?: SortOrder
  }

  export type galrcalist_metaAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type galrcalist_metaMaxOrderByAggregateInput = {
    id?: SortOrder
    path?: SortOrder
    password?: SortOrder
    p_sub?: SortOrder
    write?: SortOrder
    w_sub?: SortOrder
    hide?: SortOrder
    h_sub?: SortOrder
    readme?: SortOrder
    r_sub?: SortOrder
    header?: SortOrder
    header_sub?: SortOrder
  }

  export type galrcalist_metaMinOrderByAggregateInput = {
    id?: SortOrder
    path?: SortOrder
    password?: SortOrder
    p_sub?: SortOrder
    write?: SortOrder
    w_sub?: SortOrder
    hide?: SortOrder
    h_sub?: SortOrder
    readme?: SortOrder
    r_sub?: SortOrder
    header?: SortOrder
    header_sub?: SortOrder
  }

  export type galrcalist_metaSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}