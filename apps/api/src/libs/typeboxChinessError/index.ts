import {
  type ErrorFunctionParameter,
  SetErrorFunction,
  ValueErrorType,
} from '@sinclair/typebox/errors'

export function ChineseErrorFunction(error: ErrorFunctionParameter): string {
  const field = error.path.replace(/^\//, '') || '字段'

  switch (error.errorType) {
    case ValueErrorType.Number:
      return `${field} 必须是数字喵~`
    case ValueErrorType.NumberMinimum:
      return `${field} 必须大于等于 ${error.schema.minimum} 喵~`
    case ValueErrorType.NumberMaximum:
      return `${field} 必须小于等于 ${error.schema.maximum} 喵~`
    case ValueErrorType.Integer:
      return `${field} 必须是整数~`
    case ValueErrorType.String:
      return `${field} 必须是字符串~`
    case ValueErrorType.StringMinLength:
      return `${field} 长度不能小于 ${error.schema.minLength} 喵~`
    case ValueErrorType.StringMaxLength:
      return `${field} 长度不能大于 ${error.schema.maxLength} 喵~`
    case ValueErrorType.ObjectRequiredProperty:
      return `缺少必填字段 ${field} 喵~`
    case ValueErrorType.Boolean:
      return `${field} 必须是布尔值喵~`
    default:
      return `${field} 参数不符合要求喵~`
  }
}

export function initValidationError() {
  SetErrorFunction(ChineseErrorFunction)
}
