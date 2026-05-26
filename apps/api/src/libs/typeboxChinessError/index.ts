import {
  type ErrorFunctionParameter,
  SetErrorFunction,
  ValueErrorType,
} from '@sinclair/typebox/errors'

export function ChineseErrorFunction(error: ErrorFunctionParameter): string {
  const field = error.path.replace(/^\//, '') || '字段'

  switch (error.errorType) {
    case ValueErrorType.ArrayContains:
      return `${field} 必须包含至少一个匹配的值喵~`
    case ValueErrorType.ArrayMaxContains:
      return `${field} 包含的匹配值不能超过 ${error.schema.maxContains} 个喵~`
    case ValueErrorType.ArrayMinContains:
      return `${field} 包含的匹配值不能少于 ${error.schema.minContains} 个喵~`
    case ValueErrorType.ArrayMaxItems:
      return `${field} 数组长度不能超过 ${error.schema.maxItems} 喵~`
    case ValueErrorType.ArrayMinItems:
      return `${field} 数组长度不能少于 ${error.schema.minItems} 喵~`
    case ValueErrorType.ArrayUniqueItems:
      return `${field} 数组元素必须唯一喵~`
    case ValueErrorType.Array:
      return `${field} 必须是数组喵~`
    case ValueErrorType.AsyncIterator:
      return `${field} 必须是 AsyncIterator 喵~`
    case ValueErrorType.BigIntExclusiveMaximum:
      return `${field} 必须小于 ${error.schema.exclusiveMaximum} 喵~`
    case ValueErrorType.BigIntExclusiveMinimum:
      return `${field} 必须大于 ${error.schema.exclusiveMinimum} 喵~`
    case ValueErrorType.BigIntMaximum:
      return `${field} 必须小于等于 ${error.schema.maximum} 喵~`
    case ValueErrorType.BigIntMinimum:
      return `${field} 必须大于等于 ${error.schema.minimum} 喵~`
    case ValueErrorType.BigIntMultipleOf:
      return `${field} 必须是 ${error.schema.multipleOf} 的倍数喵~`
    case ValueErrorType.BigInt:
      return `${field} 必须是 BigInt 喵~`
    case ValueErrorType.Boolean:
      return `${field} 必须是布尔值喵~`
    case ValueErrorType.DateExclusiveMaximumTimestamp:
      return `${field} 时间戳必须小于 ${error.schema.exclusiveMaximumTimestamp} 喵~`
    case ValueErrorType.DateExclusiveMinimumTimestamp:
      return `${field} 时间戳必须大于 ${error.schema.exclusiveMinimumTimestamp} 喵~`
    case ValueErrorType.DateMaximumTimestamp:
      return `${field} 时间戳必须小于等于 ${error.schema.maximumTimestamp} 喵~`
    case ValueErrorType.DateMinimumTimestamp:
      return `${field} 时间戳必须大于等于 ${error.schema.minimumTimestamp} 喵~`
    case ValueErrorType.DateMultipleOfTimestamp:
      return `${field} 时间戳必须是 ${error.schema.multipleOfTimestamp} 的倍数喵~`
    case ValueErrorType.Date:
      return `${field} 必须是日期喵~`
    case ValueErrorType.Function:
      return `${field} 必须是函数喵~`
    case ValueErrorType.IntegerExclusiveMaximum:
      return `${field} 必须小于 ${error.schema.exclusiveMaximum} 喵~`
    case ValueErrorType.IntegerExclusiveMinimum:
      return `${field} 必须大于 ${error.schema.exclusiveMinimum} 喵~`
    case ValueErrorType.IntegerMaximum:
      return `${field} 必须小于等于 ${error.schema.maximum} 喵~`
    case ValueErrorType.IntegerMinimum:
      return `${field} 必须大于等于 ${error.schema.minimum} 喵~`
    case ValueErrorType.IntegerMultipleOf:
      return `${field} 必须是 ${error.schema.multipleOf} 的倍数喵~`
    case ValueErrorType.Integer:
      return `${field} 必须是整数喵~`
    case ValueErrorType.IntersectUnevaluatedProperties:
      return `${field} 含有不允许的属性喵~`
    case ValueErrorType.Intersect:
      return `${field} 必须匹配所有类型喵~`
    case ValueErrorType.Iterator:
      return `${field} 必须是 Iterator 喵~`
    case ValueErrorType.Kind:
      return `${field} 类型不符合要求喵~`
    case ValueErrorType.Literal:
      return `${field} 必须是 ${typeof error.schema.const === 'string' ? `"${error.schema.const}"` : error.schema.const} 喵~`
    case ValueErrorType.Never:
      return `${field} 不允许任何值喵~`
    case ValueErrorType.Not:
      return `${field} 不应该匹配此类型喵~`
    case ValueErrorType.Null:
      return `${field} 必须是 null 喵~`
    case ValueErrorType.NumberExclusiveMaximum:
      return `${field} 必须小于 ${error.schema.exclusiveMaximum} 喵~`
    case ValueErrorType.NumberExclusiveMinimum:
      return `${field} 必须大于 ${error.schema.exclusiveMinimum} 喵~`
    case ValueErrorType.NumberMaximum:
      return `${field} 必须小于等于 ${error.schema.maximum} 喵~`
    case ValueErrorType.NumberMinimum:
      return `${field} 必须大于等于 ${error.schema.minimum} 喵~`
    case ValueErrorType.NumberMultipleOf:
      return `${field} 必须是 ${error.schema.multipleOf} 的倍数喵~`
    case ValueErrorType.Number:
      return `${field} 必须是数字喵~`
    case ValueErrorType.ObjectAdditionalProperties:
      return `${field} 含有不允许的额外属性喵~`
    case ValueErrorType.ObjectMaxProperties:
      return `${field} 属性数量不能超过 ${error.schema.maxProperties} 个喵~`
    case ValueErrorType.ObjectMinProperties:
      return `${field} 属性数量不能少于 ${error.schema.minProperties} 个喵~`
    case ValueErrorType.ObjectRequiredProperty:
      return `缺少必填字段 ${field} 喵~`
    case ValueErrorType.Object:
      return `${field} 必须是对象喵~`
    case ValueErrorType.Promise:
      return `${field} 必须是 Promise 喵~`
    case ValueErrorType.RegExp:
      return `${field} 不符合正则表达式喵~`
    case ValueErrorType.StringFormatUnknown:
      return `${field} 的格式 "${error.schema.format}" 未知喵~`
    case ValueErrorType.StringFormat:
      return `${field} 必须匹配 "${error.schema.format}" 格式喵~`
    case ValueErrorType.StringMaxLength:
      return `${field} 长度不能大于 ${error.schema.maxLength} 喵~`
    case ValueErrorType.StringMinLength:
      return `${field} 长度不能小于 ${error.schema.minLength} 喵~`
    case ValueErrorType.StringPattern:
      return `${field} 必须匹配模式 "${error.schema.pattern}" 喵~`
    case ValueErrorType.String:
      return `${field} 必须是字符串喵~`
    case ValueErrorType.Symbol:
      return `${field} 必须是 Symbol 喵~`
    case ValueErrorType.TupleLength:
      return `${field} 元组必须有 ${error.schema.maxItems || 0} 个元素喵~`
    case ValueErrorType.Tuple:
      return `${field} 必须是元组喵~`
    case ValueErrorType.Uint8ArrayMaxByteLength:
      return `${field} 字节长度不能大于 ${error.schema.maxByteLength} 喵~`
    case ValueErrorType.Uint8ArrayMinByteLength:
      return `${field} 字节长度不能小于 ${error.schema.minByteLength} 喵~`
    case ValueErrorType.Uint8Array:
      return `${field} 必须是 Uint8Array 喵~`
    case ValueErrorType.Undefined:
      return `${field} 必须是 undefined 喵~`
    case ValueErrorType.Union:
      return `${field} 必须匹配联合类型中的至少一种喵~`
    case ValueErrorType.Void:
      return `${field} 必须是 void 喵~`
    default:
      return `${field} 参数不符合要求喵~`
  }
}

export function initValidationError() {
  SetErrorFunction(ChineseErrorFunction)
}
