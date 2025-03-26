
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
 * Model galRcAlist_search_nodes
 * 
 */
export type galRcAlist_search_nodes = $Result.DefaultSelection<Prisma.$galRcAlist_search_nodesPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more GalRcAlist_search_nodes
 * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findMany()
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
   * // Fetch zero or more GalRcAlist_search_nodes
   * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findMany()
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
   * `prisma.galRcAlist_search_nodes`: Exposes CRUD operations for the **galRcAlist_search_nodes** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GalRcAlist_search_nodes
    * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findMany()
    * ```
    */
  get galRcAlist_search_nodes(): Prisma.galRcAlist_search_nodesDelegate<ExtArgs, ClientOptions>;
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
   * Prisma Client JS version: 6.5.0
   * Query Engine version: 173f8d54f8d52e692c7e27e72a88314ec7aeff60
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
    galRcAlist_search_nodes: 'galRcAlist_search_nodes'
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
      modelProps: "galRcAlist_search_nodes"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      galRcAlist_search_nodes: {
        payload: Prisma.$galRcAlist_search_nodesPayload<ExtArgs>
        fields: Prisma.galRcAlist_search_nodesFieldRefs
        operations: {
          findUnique: {
            args: Prisma.galRcAlist_search_nodesFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.galRcAlist_search_nodesFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          findFirst: {
            args: Prisma.galRcAlist_search_nodesFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.galRcAlist_search_nodesFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          findMany: {
            args: Prisma.galRcAlist_search_nodesFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>[]
          }
          create: {
            args: Prisma.galRcAlist_search_nodesCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          createMany: {
            args: Prisma.galRcAlist_search_nodesCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.galRcAlist_search_nodesCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>[]
          }
          delete: {
            args: Prisma.galRcAlist_search_nodesDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          update: {
            args: Prisma.galRcAlist_search_nodesUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          deleteMany: {
            args: Prisma.galRcAlist_search_nodesDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.galRcAlist_search_nodesUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.galRcAlist_search_nodesUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>[]
          }
          upsert: {
            args: Prisma.galRcAlist_search_nodesUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$galRcAlist_search_nodesPayload>
          }
          aggregate: {
            args: Prisma.GalRcAlist_search_nodesAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGalRcAlist_search_nodes>
          }
          groupBy: {
            args: Prisma.galRcAlist_search_nodesGroupByArgs<ExtArgs>
            result: $Utils.Optional<GalRcAlist_search_nodesGroupByOutputType>[]
          }
          count: {
            args: Prisma.galRcAlist_search_nodesCountArgs<ExtArgs>
            result: $Utils.Optional<GalRcAlist_search_nodesCountAggregateOutputType> | number
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
    galRcAlist_search_nodes?: galRcAlist_search_nodesOmit
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
   * Model galRcAlist_search_nodes
   */

  export type AggregateGalRcAlist_search_nodes = {
    _count: GalRcAlist_search_nodesCountAggregateOutputType | null
    _avg: GalRcAlist_search_nodesAvgAggregateOutputType | null
    _sum: GalRcAlist_search_nodesSumAggregateOutputType | null
    _min: GalRcAlist_search_nodesMinAggregateOutputType | null
    _max: GalRcAlist_search_nodesMaxAggregateOutputType | null
  }

  export type GalRcAlist_search_nodesAvgAggregateOutputType = {
    size: number | null
  }

  export type GalRcAlist_search_nodesSumAggregateOutputType = {
    size: number | null
  }

  export type GalRcAlist_search_nodesMinAggregateOutputType = {
    parent: string | null
    name: string | null
    is_dir: boolean | null
    size: number | null
  }

  export type GalRcAlist_search_nodesMaxAggregateOutputType = {
    parent: string | null
    name: string | null
    is_dir: boolean | null
    size: number | null
  }

  export type GalRcAlist_search_nodesCountAggregateOutputType = {
    parent: number
    name: number
    is_dir: number
    size: number
    _all: number
  }


  export type GalRcAlist_search_nodesAvgAggregateInputType = {
    size?: true
  }

  export type GalRcAlist_search_nodesSumAggregateInputType = {
    size?: true
  }

  export type GalRcAlist_search_nodesMinAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
  }

  export type GalRcAlist_search_nodesMaxAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
  }

  export type GalRcAlist_search_nodesCountAggregateInputType = {
    parent?: true
    name?: true
    is_dir?: true
    size?: true
    _all?: true
  }

  export type GalRcAlist_search_nodesAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galRcAlist_search_nodes to aggregate.
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galRcAlist_search_nodes to fetch.
     */
    orderBy?: galRcAlist_search_nodesOrderByWithRelationInput | galRcAlist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: galRcAlist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galRcAlist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galRcAlist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned galRcAlist_search_nodes
    **/
    _count?: true | GalRcAlist_search_nodesCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: GalRcAlist_search_nodesAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: GalRcAlist_search_nodesSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GalRcAlist_search_nodesMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GalRcAlist_search_nodesMaxAggregateInputType
  }

  export type GetGalRcAlist_search_nodesAggregateType<T extends GalRcAlist_search_nodesAggregateArgs> = {
        [P in keyof T & keyof AggregateGalRcAlist_search_nodes]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGalRcAlist_search_nodes[P]>
      : GetScalarType<T[P], AggregateGalRcAlist_search_nodes[P]>
  }




  export type galRcAlist_search_nodesGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: galRcAlist_search_nodesWhereInput
    orderBy?: galRcAlist_search_nodesOrderByWithAggregationInput | galRcAlist_search_nodesOrderByWithAggregationInput[]
    by: GalRcAlist_search_nodesScalarFieldEnum[] | GalRcAlist_search_nodesScalarFieldEnum
    having?: galRcAlist_search_nodesScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GalRcAlist_search_nodesCountAggregateInputType | true
    _avg?: GalRcAlist_search_nodesAvgAggregateInputType
    _sum?: GalRcAlist_search_nodesSumAggregateInputType
    _min?: GalRcAlist_search_nodesMinAggregateInputType
    _max?: GalRcAlist_search_nodesMaxAggregateInputType
  }

  export type GalRcAlist_search_nodesGroupByOutputType = {
    parent: string
    name: string
    is_dir: boolean
    size: number
    _count: GalRcAlist_search_nodesCountAggregateOutputType | null
    _avg: GalRcAlist_search_nodesAvgAggregateOutputType | null
    _sum: GalRcAlist_search_nodesSumAggregateOutputType | null
    _min: GalRcAlist_search_nodesMinAggregateOutputType | null
    _max: GalRcAlist_search_nodesMaxAggregateOutputType | null
  }

  type GetGalRcAlist_search_nodesGroupByPayload<T extends galRcAlist_search_nodesGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GalRcAlist_search_nodesGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GalRcAlist_search_nodesGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GalRcAlist_search_nodesGroupByOutputType[P]>
            : GetScalarType<T[P], GalRcAlist_search_nodesGroupByOutputType[P]>
        }
      >
    >


  export type galRcAlist_search_nodesSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galRcAlist_search_nodes"]>

  export type galRcAlist_search_nodesSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galRcAlist_search_nodes"]>

  export type galRcAlist_search_nodesSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }, ExtArgs["result"]["galRcAlist_search_nodes"]>

  export type galRcAlist_search_nodesSelectScalar = {
    parent?: boolean
    name?: boolean
    is_dir?: boolean
    size?: boolean
  }

  export type galRcAlist_search_nodesOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"parent" | "name" | "is_dir" | "size", ExtArgs["result"]["galRcAlist_search_nodes"]>

  export type $galRcAlist_search_nodesPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "galRcAlist_search_nodes"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      parent: string
      name: string
      is_dir: boolean
      size: number
    }, ExtArgs["result"]["galRcAlist_search_nodes"]>
    composites: {}
  }

  type galRcAlist_search_nodesGetPayload<S extends boolean | null | undefined | galRcAlist_search_nodesDefaultArgs> = $Result.GetResult<Prisma.$galRcAlist_search_nodesPayload, S>

  type galRcAlist_search_nodesCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<galRcAlist_search_nodesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GalRcAlist_search_nodesCountAggregateInputType | true
    }

  export interface galRcAlist_search_nodesDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['galRcAlist_search_nodes'], meta: { name: 'galRcAlist_search_nodes' } }
    /**
     * Find zero or one GalRcAlist_search_nodes that matches the filter.
     * @param {galRcAlist_search_nodesFindUniqueArgs} args - Arguments to find a GalRcAlist_search_nodes
     * @example
     * // Get one GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends galRcAlist_search_nodesFindUniqueArgs>(args: SelectSubset<T, galRcAlist_search_nodesFindUniqueArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GalRcAlist_search_nodes that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {galRcAlist_search_nodesFindUniqueOrThrowArgs} args - Arguments to find a GalRcAlist_search_nodes
     * @example
     * // Get one GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends galRcAlist_search_nodesFindUniqueOrThrowArgs>(args: SelectSubset<T, galRcAlist_search_nodesFindUniqueOrThrowArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GalRcAlist_search_nodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesFindFirstArgs} args - Arguments to find a GalRcAlist_search_nodes
     * @example
     * // Get one GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends galRcAlist_search_nodesFindFirstArgs>(args?: SelectSubset<T, galRcAlist_search_nodesFindFirstArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GalRcAlist_search_nodes that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesFindFirstOrThrowArgs} args - Arguments to find a GalRcAlist_search_nodes
     * @example
     * // Get one GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends galRcAlist_search_nodesFindFirstOrThrowArgs>(args?: SelectSubset<T, galRcAlist_search_nodesFindFirstOrThrowArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GalRcAlist_search_nodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findMany()
     * 
     * // Get first 10 GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.findMany({ take: 10 })
     * 
     * // Only select the `parent`
     * const galRcAlist_search_nodesWithParentOnly = await prisma.galRcAlist_search_nodes.findMany({ select: { parent: true } })
     * 
     */
    findMany<T extends galRcAlist_search_nodesFindManyArgs>(args?: SelectSubset<T, galRcAlist_search_nodesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesCreateArgs} args - Arguments to create a GalRcAlist_search_nodes.
     * @example
     * // Create one GalRcAlist_search_nodes
     * const GalRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.create({
     *   data: {
     *     // ... data to create a GalRcAlist_search_nodes
     *   }
     * })
     * 
     */
    create<T extends galRcAlist_search_nodesCreateArgs>(args: SelectSubset<T, galRcAlist_search_nodesCreateArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesCreateManyArgs} args - Arguments to create many GalRcAlist_search_nodes.
     * @example
     * // Create many GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends galRcAlist_search_nodesCreateManyArgs>(args?: SelectSubset<T, galRcAlist_search_nodesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GalRcAlist_search_nodes and returns the data saved in the database.
     * @param {galRcAlist_search_nodesCreateManyAndReturnArgs} args - Arguments to create many GalRcAlist_search_nodes.
     * @example
     * // Create many GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GalRcAlist_search_nodes and only return the `parent`
     * const galRcAlist_search_nodesWithParentOnly = await prisma.galRcAlist_search_nodes.createManyAndReturn({
     *   select: { parent: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends galRcAlist_search_nodesCreateManyAndReturnArgs>(args?: SelectSubset<T, galRcAlist_search_nodesCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesDeleteArgs} args - Arguments to delete one GalRcAlist_search_nodes.
     * @example
     * // Delete one GalRcAlist_search_nodes
     * const GalRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.delete({
     *   where: {
     *     // ... filter to delete one GalRcAlist_search_nodes
     *   }
     * })
     * 
     */
    delete<T extends galRcAlist_search_nodesDeleteArgs>(args: SelectSubset<T, galRcAlist_search_nodesDeleteArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesUpdateArgs} args - Arguments to update one GalRcAlist_search_nodes.
     * @example
     * // Update one GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends galRcAlist_search_nodesUpdateArgs>(args: SelectSubset<T, galRcAlist_search_nodesUpdateArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesDeleteManyArgs} args - Arguments to filter GalRcAlist_search_nodes to delete.
     * @example
     * // Delete a few GalRcAlist_search_nodes
     * const { count } = await prisma.galRcAlist_search_nodes.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends galRcAlist_search_nodesDeleteManyArgs>(args?: SelectSubset<T, galRcAlist_search_nodesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GalRcAlist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends galRcAlist_search_nodesUpdateManyArgs>(args: SelectSubset<T, galRcAlist_search_nodesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GalRcAlist_search_nodes and returns the data updated in the database.
     * @param {galRcAlist_search_nodesUpdateManyAndReturnArgs} args - Arguments to update many GalRcAlist_search_nodes.
     * @example
     * // Update many GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GalRcAlist_search_nodes and only return the `parent`
     * const galRcAlist_search_nodesWithParentOnly = await prisma.galRcAlist_search_nodes.updateManyAndReturn({
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
    updateManyAndReturn<T extends galRcAlist_search_nodesUpdateManyAndReturnArgs>(args: SelectSubset<T, galRcAlist_search_nodesUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GalRcAlist_search_nodes.
     * @param {galRcAlist_search_nodesUpsertArgs} args - Arguments to update or create a GalRcAlist_search_nodes.
     * @example
     * // Update or create a GalRcAlist_search_nodes
     * const galRcAlist_search_nodes = await prisma.galRcAlist_search_nodes.upsert({
     *   create: {
     *     // ... data to create a GalRcAlist_search_nodes
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GalRcAlist_search_nodes we want to update
     *   }
     * })
     */
    upsert<T extends galRcAlist_search_nodesUpsertArgs>(args: SelectSubset<T, galRcAlist_search_nodesUpsertArgs<ExtArgs>>): Prisma__galRcAlist_search_nodesClient<$Result.GetResult<Prisma.$galRcAlist_search_nodesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GalRcAlist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesCountArgs} args - Arguments to filter GalRcAlist_search_nodes to count.
     * @example
     * // Count the number of GalRcAlist_search_nodes
     * const count = await prisma.galRcAlist_search_nodes.count({
     *   where: {
     *     // ... the filter for the GalRcAlist_search_nodes we want to count
     *   }
     * })
    **/
    count<T extends galRcAlist_search_nodesCountArgs>(
      args?: Subset<T, galRcAlist_search_nodesCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GalRcAlist_search_nodesCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GalRcAlist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GalRcAlist_search_nodesAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends GalRcAlist_search_nodesAggregateArgs>(args: Subset<T, GalRcAlist_search_nodesAggregateArgs>): Prisma.PrismaPromise<GetGalRcAlist_search_nodesAggregateType<T>>

    /**
     * Group by GalRcAlist_search_nodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {galRcAlist_search_nodesGroupByArgs} args - Group by arguments.
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
      T extends galRcAlist_search_nodesGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: galRcAlist_search_nodesGroupByArgs['orderBy'] }
        : { orderBy?: galRcAlist_search_nodesGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, galRcAlist_search_nodesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGalRcAlist_search_nodesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the galRcAlist_search_nodes model
   */
  readonly fields: galRcAlist_search_nodesFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for galRcAlist_search_nodes.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__galRcAlist_search_nodesClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the galRcAlist_search_nodes model
   */ 
  interface galRcAlist_search_nodesFieldRefs {
    readonly parent: FieldRef<"galRcAlist_search_nodes", 'String'>
    readonly name: FieldRef<"galRcAlist_search_nodes", 'String'>
    readonly is_dir: FieldRef<"galRcAlist_search_nodes", 'Boolean'>
    readonly size: FieldRef<"galRcAlist_search_nodes", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * galRcAlist_search_nodes findUnique
   */
  export type galRcAlist_search_nodesFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galRcAlist_search_nodes to fetch.
     */
    where: galRcAlist_search_nodesWhereUniqueInput
  }

  /**
   * galRcAlist_search_nodes findUniqueOrThrow
   */
  export type galRcAlist_search_nodesFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galRcAlist_search_nodes to fetch.
     */
    where: galRcAlist_search_nodesWhereUniqueInput
  }

  /**
   * galRcAlist_search_nodes findFirst
   */
  export type galRcAlist_search_nodesFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galRcAlist_search_nodes to fetch.
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galRcAlist_search_nodes to fetch.
     */
    orderBy?: galRcAlist_search_nodesOrderByWithRelationInput | galRcAlist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galRcAlist_search_nodes.
     */
    cursor?: galRcAlist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galRcAlist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galRcAlist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galRcAlist_search_nodes.
     */
    distinct?: GalRcAlist_search_nodesScalarFieldEnum | GalRcAlist_search_nodesScalarFieldEnum[]
  }

  /**
   * galRcAlist_search_nodes findFirstOrThrow
   */
  export type galRcAlist_search_nodesFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galRcAlist_search_nodes to fetch.
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galRcAlist_search_nodes to fetch.
     */
    orderBy?: galRcAlist_search_nodesOrderByWithRelationInput | galRcAlist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for galRcAlist_search_nodes.
     */
    cursor?: galRcAlist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galRcAlist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galRcAlist_search_nodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of galRcAlist_search_nodes.
     */
    distinct?: GalRcAlist_search_nodesScalarFieldEnum | GalRcAlist_search_nodesScalarFieldEnum[]
  }

  /**
   * galRcAlist_search_nodes findMany
   */
  export type galRcAlist_search_nodesFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter, which galRcAlist_search_nodes to fetch.
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of galRcAlist_search_nodes to fetch.
     */
    orderBy?: galRcAlist_search_nodesOrderByWithRelationInput | galRcAlist_search_nodesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing galRcAlist_search_nodes.
     */
    cursor?: galRcAlist_search_nodesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` galRcAlist_search_nodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` galRcAlist_search_nodes.
     */
    skip?: number
    distinct?: GalRcAlist_search_nodesScalarFieldEnum | GalRcAlist_search_nodesScalarFieldEnum[]
  }

  /**
   * galRcAlist_search_nodes create
   */
  export type galRcAlist_search_nodesCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * The data needed to create a galRcAlist_search_nodes.
     */
    data: XOR<galRcAlist_search_nodesCreateInput, galRcAlist_search_nodesUncheckedCreateInput>
  }

  /**
   * galRcAlist_search_nodes createMany
   */
  export type galRcAlist_search_nodesCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many galRcAlist_search_nodes.
     */
    data: galRcAlist_search_nodesCreateManyInput | galRcAlist_search_nodesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galRcAlist_search_nodes createManyAndReturn
   */
  export type galRcAlist_search_nodesCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * The data used to create many galRcAlist_search_nodes.
     */
    data: galRcAlist_search_nodesCreateManyInput | galRcAlist_search_nodesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * galRcAlist_search_nodes update
   */
  export type galRcAlist_search_nodesUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * The data needed to update a galRcAlist_search_nodes.
     */
    data: XOR<galRcAlist_search_nodesUpdateInput, galRcAlist_search_nodesUncheckedUpdateInput>
    /**
     * Choose, which galRcAlist_search_nodes to update.
     */
    where: galRcAlist_search_nodesWhereUniqueInput
  }

  /**
   * galRcAlist_search_nodes updateMany
   */
  export type galRcAlist_search_nodesUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update galRcAlist_search_nodes.
     */
    data: XOR<galRcAlist_search_nodesUpdateManyMutationInput, galRcAlist_search_nodesUncheckedUpdateManyInput>
    /**
     * Filter which galRcAlist_search_nodes to update
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * Limit how many galRcAlist_search_nodes to update.
     */
    limit?: number
  }

  /**
   * galRcAlist_search_nodes updateManyAndReturn
   */
  export type galRcAlist_search_nodesUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * The data used to update galRcAlist_search_nodes.
     */
    data: XOR<galRcAlist_search_nodesUpdateManyMutationInput, galRcAlist_search_nodesUncheckedUpdateManyInput>
    /**
     * Filter which galRcAlist_search_nodes to update
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * Limit how many galRcAlist_search_nodes to update.
     */
    limit?: number
  }

  /**
   * galRcAlist_search_nodes upsert
   */
  export type galRcAlist_search_nodesUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * The filter to search for the galRcAlist_search_nodes to update in case it exists.
     */
    where: galRcAlist_search_nodesWhereUniqueInput
    /**
     * In case the galRcAlist_search_nodes found by the `where` argument doesn't exist, create a new galRcAlist_search_nodes with this data.
     */
    create: XOR<galRcAlist_search_nodesCreateInput, galRcAlist_search_nodesUncheckedCreateInput>
    /**
     * In case the galRcAlist_search_nodes was found with the provided `where` argument, update it with this data.
     */
    update: XOR<galRcAlist_search_nodesUpdateInput, galRcAlist_search_nodesUncheckedUpdateInput>
  }

  /**
   * galRcAlist_search_nodes delete
   */
  export type galRcAlist_search_nodesDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
    /**
     * Filter which galRcAlist_search_nodes to delete.
     */
    where: galRcAlist_search_nodesWhereUniqueInput
  }

  /**
   * galRcAlist_search_nodes deleteMany
   */
  export type galRcAlist_search_nodesDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which galRcAlist_search_nodes to delete
     */
    where?: galRcAlist_search_nodesWhereInput
    /**
     * Limit how many galRcAlist_search_nodes to delete.
     */
    limit?: number
  }

  /**
   * galRcAlist_search_nodes without action
   */
  export type galRcAlist_search_nodesDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the galRcAlist_search_nodes
     */
    select?: galRcAlist_search_nodesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the galRcAlist_search_nodes
     */
    omit?: galRcAlist_search_nodesOmit<ExtArgs> | null
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


  export const GalRcAlist_search_nodesScalarFieldEnum: {
    parent: 'parent',
    name: 'name',
    is_dir: 'is_dir',
    size: 'size'
  };

  export type GalRcAlist_search_nodesScalarFieldEnum = (typeof GalRcAlist_search_nodesScalarFieldEnum)[keyof typeof GalRcAlist_search_nodesScalarFieldEnum]


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


  export type galRcAlist_search_nodesWhereInput = {
    AND?: galRcAlist_search_nodesWhereInput | galRcAlist_search_nodesWhereInput[]
    OR?: galRcAlist_search_nodesWhereInput[]
    NOT?: galRcAlist_search_nodesWhereInput | galRcAlist_search_nodesWhereInput[]
    parent?: StringFilter<"galRcAlist_search_nodes"> | string
    name?: StringFilter<"galRcAlist_search_nodes"> | string
    is_dir?: BoolFilter<"galRcAlist_search_nodes"> | boolean
    size?: IntFilter<"galRcAlist_search_nodes"> | number
  }

  export type galRcAlist_search_nodesOrderByWithRelationInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galRcAlist_search_nodesWhereUniqueInput = Prisma.AtLeast<{
    parent_name?: galRcAlist_search_nodesParentNameCompoundUniqueInput
    AND?: galRcAlist_search_nodesWhereInput | galRcAlist_search_nodesWhereInput[]
    OR?: galRcAlist_search_nodesWhereInput[]
    NOT?: galRcAlist_search_nodesWhereInput | galRcAlist_search_nodesWhereInput[]
    parent?: StringFilter<"galRcAlist_search_nodes"> | string
    name?: StringFilter<"galRcAlist_search_nodes"> | string
    is_dir?: BoolFilter<"galRcAlist_search_nodes"> | boolean
    size?: IntFilter<"galRcAlist_search_nodes"> | number
  }, "parent_name">

  export type galRcAlist_search_nodesOrderByWithAggregationInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
    _count?: galRcAlist_search_nodesCountOrderByAggregateInput
    _avg?: galRcAlist_search_nodesAvgOrderByAggregateInput
    _max?: galRcAlist_search_nodesMaxOrderByAggregateInput
    _min?: galRcAlist_search_nodesMinOrderByAggregateInput
    _sum?: galRcAlist_search_nodesSumOrderByAggregateInput
  }

  export type galRcAlist_search_nodesScalarWhereWithAggregatesInput = {
    AND?: galRcAlist_search_nodesScalarWhereWithAggregatesInput | galRcAlist_search_nodesScalarWhereWithAggregatesInput[]
    OR?: galRcAlist_search_nodesScalarWhereWithAggregatesInput[]
    NOT?: galRcAlist_search_nodesScalarWhereWithAggregatesInput | galRcAlist_search_nodesScalarWhereWithAggregatesInput[]
    parent?: StringWithAggregatesFilter<"galRcAlist_search_nodes"> | string
    name?: StringWithAggregatesFilter<"galRcAlist_search_nodes"> | string
    is_dir?: BoolWithAggregatesFilter<"galRcAlist_search_nodes"> | boolean
    size?: IntWithAggregatesFilter<"galRcAlist_search_nodes"> | number
  }

  export type galRcAlist_search_nodesCreateInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galRcAlist_search_nodesUncheckedCreateInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galRcAlist_search_nodesUpdateInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galRcAlist_search_nodesUncheckedUpdateInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galRcAlist_search_nodesCreateManyInput = {
    parent: string
    name: string
    is_dir: boolean
    size: number
  }

  export type galRcAlist_search_nodesUpdateManyMutationInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
  }

  export type galRcAlist_search_nodesUncheckedUpdateManyInput = {
    parent?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    is_dir?: BoolFieldUpdateOperationsInput | boolean
    size?: IntFieldUpdateOperationsInput | number
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

  export type galRcAlist_search_nodesParentNameCompoundUniqueInput = {
    parent: string
    name: string
  }

  export type galRcAlist_search_nodesCountOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galRcAlist_search_nodesAvgOrderByAggregateInput = {
    size?: SortOrder
  }

  export type galRcAlist_search_nodesMaxOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galRcAlist_search_nodesMinOrderByAggregateInput = {
    parent?: SortOrder
    name?: SortOrder
    is_dir?: SortOrder
    size?: SortOrder
  }

  export type galRcAlist_search_nodesSumOrderByAggregateInput = {
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