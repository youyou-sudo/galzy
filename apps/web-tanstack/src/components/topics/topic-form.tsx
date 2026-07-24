import { useForm } from '@tanstack/react-form'
import { MarkdownEditor } from '@web/components/editor/MarkdownEditor'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from '@web/components/ui/field'
import { Input } from '@web/components/ui/input'
import { Loader2 } from 'lucide-react'

interface TopicFormProps {
  defaultValues?: {
    title: string
    content: string
  }
  onSubmit: (values: { title: string; content: string }) => Promise<void>
  submitLabel?: string
  title?: string
}

export function TopicForm({
  defaultValues = { title: '', content: '' },
  onSubmit,
  submitLabel = '发布',
  title = '发帖',
}: TopicFormProps) {
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      form.handleSubmit()
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
            className="flex flex-col gap-6"
          >
            <form.Field name="title">
              {(field) => (
                <Field orientation="vertical">
                  <FieldLabel>
                    <FieldTitle>标题</FieldTitle>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      placeholder="输入帖子标题"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="text-base h-10"
                    />
                  </FieldContent>
                </Field>
              )}
            </form.Field>

            <form.Field name="content">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field orientation="vertical">
                    <FieldLabel>
                      <FieldTitle>内容</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <MarkdownEditor
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val ?? '')}
                        onKeyDown={handleKeyDown}
                        placeholder="输入帖子内容喵～ 支持 Markdown 语法（Ctrl+Enter 提交）"
                        aria-invalid={isInvalid}
                        minHeight={500}
                      />
                    </FieldContent>
                  </Field>
                )
              }}
            </form.Field>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    submitLabel
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
